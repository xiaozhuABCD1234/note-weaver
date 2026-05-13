import { ItemView, MarkdownRenderer, Notice, WorkspaceLeaf } from "obsidian";
import NoteWeaver from "./main";
import {
	ApiMessage,
	ChatMessage,
	ToolCall,
} from "./api";
import {
	getActiveNoteContext,
	getSelectedText,
} from "./note-operations";

export const VIEW_TYPE_CHAT = "note-weaver-chat";

export class ChatView extends ItemView {
	messages: ApiMessage[] = [];
	isLoading = false;
	private plugin: NoteWeaver;
	private messagesEl: HTMLElement | null = null;
	private previewEl: HTMLElement | null = null;
	private inputEl: HTMLTextAreaElement | null = null;
	private sendBtnEl: HTMLButtonElement | null = null;
	private abortController: AbortController | null = null;
	private escapeHandler: ((e: KeyboardEvent) => void) | null = null;
	private pendingSelection: string | null = null;
	private maxToolRounds = 10;

	constructor(leaf: WorkspaceLeaf, plugin: NoteWeaver) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType(): string {
		return VIEW_TYPE_CHAT;
	}

	getDisplayText(): string {
		return "AI 助手";
	}

	setPendingSelection(selection: string): void {
		this.pendingSelection = selection;
		if (this.inputEl) {
			this.inputEl.placeholder = `已选中文本，输入修改要求...`;
			this.inputEl.focus();
		}
	}

	private async buildSystemMessage(userQuery: string): Promise<ChatMessage> {
		const note = getActiveNoteContext(this.app);
		const selection = this.pendingSelection ?? getSelectedText(this.app);

		const sysContent: string[] = [
			"你是 Note Weaver AI 助手，运行在 Obsidian 笔记软件中。你有读取和修改库内任意笔记的能力。",
			"",
			"可用工具：",
			"- read_note(path): 读取库内指定路径的笔记内容",
			"- write_note(path, content): 创建新笔记或覆盖已有笔记",
			"- append_note(path, content): 向已有笔记末尾追加内容",
			"- delete_note(path): 永久删除笔记",
			"- rename_note(path, newPath): 重命名或移动笔记（自动更新内部链接）",
			"- search_notes(query): 按文件名搜索笔记",
			"- search_content(query): 在所有笔记中搜索文本内容",
			"- list_folder(path): 列出库内文件夹中的文件和子文件夹",
			"",
			"使用指南：",
			"- 当用户询问笔记内容时，使用 read_note 或 search_notes 主动读取",
			"- 当用户要求修改/创建/整理笔记时，使用 write_note 等工具直接操作",
			"- 每次操作后向用户说明你做了什么",
		];

		if (note) {
			sysContent.push(
				`\n当前打开的笔记为：「${note.file.basename}」(${note.file.path})`,
				"笔记完整内容：",
				"---",
				note.content,
				"---",
			);
		}

		if (selection) {
			sysContent.push(
				"\n用户的选中文本：",
				"---",
				selection,
				"---",
			);
		}

		if (this.plugin.settings.rag.enabled && userQuery.trim()) {
			const ragContext = await this.plugin.ragEngine.getContextForQuery(
				`${note ? note.file.basename + " " : ""}${userQuery} ${selection ?? ""}`,
			);
			if (ragContext) {
				sysContent.push(
					"\n从 Vault 中检索到的相关笔记内容：",
					ragContext,
				);
			}
		}

		return { role: "system", content: sysContent.join("\n") };
	}

	protected async onOpen(): Promise<void> {
		const container = this.containerEl;
		container.empty();
		container.addClass("chat-container");

		const wrapper = container.createDiv("chat-wrapper");

		this.messagesEl = wrapper.createDiv("messages-wrapper");
		this.previewEl = wrapper.createDiv("modification-preview-wrapper");
		this.createInputArea(wrapper);

		this.messages = [
			{
				role: "assistant",
				content: "你好！我是 Note Weaver AI 助手，有什么可以帮你的吗？",
			},
		];
		await this.renderMessages();
	}

	private createInputArea(parent: HTMLElement): HTMLElement {
		const inputArea = parent.createDiv("input-wrapper");

		this.inputEl = inputArea.createEl("textarea", {
			placeholder: "输入消息...",
		});

		this.sendBtnEl = inputArea.createEl("button", {
			text: "发送",
		});

		this.sendBtnEl.onclick = () => {
			void this.sendMessage();
		};

		this.inputEl.addEventListener("keydown", (e: KeyboardEvent) => {
			if (e.key === "Enter" && !e.shiftKey) {
				e.preventDefault();
				void this.sendMessage();
			}
		});

		return inputArea;
	}

	private async sendMessage(): Promise<void> {
		if (!this.inputEl || !this.sendBtnEl || !this.messagesEl) return;

		const content = this.inputEl.value.trim();
		if (!content || this.isLoading) return;

		if (!this.plugin.settings.apiKey) {
			new Notice("请先在设置中配置 API key");
			return;
		}

		const selection = this.pendingSelection;
		this.pendingSelection = null;

		this.inputEl.value = "";
		this.inputEl.placeholder = "输入消息...";

		this.previewEl?.empty();

		const systemMessage = await this.buildSystemMessage(content);
		const currentDisplayMessages = [...this.messages];

		const userMessage: ChatMessage = { role: "user", content };
		this.messages.push(userMessage);
		await this.renderMessages();
		this.scrollToBottom();

		this.isLoading = true;
		this.updateInputState();

		this.abortController = new AbortController();

		this.escapeHandler = (e: KeyboardEvent) => {
			if (e.key === "Escape" && this.isLoading) {
				this.abortController?.abort();
			}
		};
		window.addEventListener("keydown", this.escapeHandler);

		this.plugin.logger.log({
			level: "info",
			type: "chat",
			message: `用户发送消息`,
			data: { content: content, hasSelection: !!selection },
		});

		const aiMessage: ApiMessage = { role: "assistant", content: "" };
		this.messages.push(aiMessage);

		try {
			let currentMessages: ApiMessage[] = [
				systemMessage,
				...currentDisplayMessages,
				userMessage,
			];
			let fullReply = "";
			let toolRounds = 0;

			while (toolRounds < this.maxToolRounds) {
				const stream = this.plugin.getChatStreamWithTools(
					currentMessages,
					this.abortController.signal,
				);

				let toolCalls: ToolCall[] | null = null;
				let streamedContent = "";
				let reasoningContent = "";

				for await (const event of stream) {
					if (event.type === "content") {
						streamedContent += event.content;
						fullReply += event.content;
						aiMessage.content = fullReply;
						await this.renderMessages();
						this.scrollToBottom();
					} else if (event.type === "tool_calls") {
						toolCalls = event.calls;
						reasoningContent = event.reasoningContent;
					}
				}

				if (toolCalls && toolCalls.length > 0) {
					const toolNames = toolCalls.map(tc => tc.function.name).join(", ");
					new Notice(`🤖 AI 正在执行: ${toolNames}`);

					this.plugin.logger.log({
						level: "info",
						type: "tool",
						message: `AI 调用工具: ${toolNames}`,
						data: { toolCalls: toolCalls.map(tc => ({ name: tc.function.name, args: tc.function.arguments })) },
					});

					const results = await this.plugin.vaultService.executeToolCalls(toolCalls);

					this.plugin.logger.log({
						level: "info",
						type: "tool",
						message: `工具调用完成: ${toolNames}`,
						data: { resultCount: results.length },
					});

					currentMessages = [
						...currentMessages,
						{ role: "assistant", content: streamedContent || null, tool_calls: toolCalls, reasoning_content: reasoningContent || null },
						...results,
					];

					if (this.plugin.vaultService.lastWriteContent) {
						await this.showWritePreview(
							this.plugin.vaultService.lastWritePath ?? "",
							this.plugin.vaultService.lastWriteContent,
						);
					}

					toolRounds++;
					continue;
				}

				break;
			}

			if (toolRounds >= this.maxToolRounds) {
				fullReply += "\n\n*[已超过最大工具调用轮数]*";
				new Notice("AI 工具调用次数过多，已停止");
			}

			aiMessage.content = fullReply;
			await this.renderMessages();

			this.plugin.logger.log({
				level: "info",
				type: "chat",
				message: `AI 回复完成`,
				data: { replyLength: fullReply.length, toolRounds },
			});
		} catch (error) {
			if (error instanceof Error && error.name === "AbortError") {
				if (aiMessage.content) {
					aiMessage.content += "\n\n*[已取消]*";
				} else {
					aiMessage.content = "*[已取消]*";
				}
				this.plugin.logger.log({
					level: "warn",
					type: "chat",
					message: "用户取消了 AI 回复",
				});
			} else {
				aiMessage.content = `错误: ${
					error instanceof Error ? error.message : "未知错误"
				}`;
				new Notice("AI 响应失败，请检查配置");
				this.plugin.logger.log({
					level: "error",
					type: "api",
					message: `AI 响应失败: ${error instanceof Error ? error.message : "未知错误"}`,
				});
			}
		} finally {
			this.isLoading = false;
			this.updateInputState();
			this.abortController = null;
			if (this.escapeHandler) {
				window.removeEventListener("keydown", this.escapeHandler);
				this.escapeHandler = null;
			}
		}
	}

	private async showWritePreview(path: string, content: string): Promise<void> {
		if (!this.previewEl) return;
		this.previewEl.empty();

		const previewContainer = this.previewEl.createDiv("modification-preview");
		const header = previewContainer.createDiv("modification-preview-header");
		header.setText(`已写入: ${path}`);

		const body = previewContainer.createDiv("modification-preview-body");
		await MarkdownRenderer.render(this.app, content, body, "", this);

		const actions = previewContainer.createDiv("modification-preview-actions");
		const closeBtn = actions.createEl("button", {
			text: "关闭预览",
			cls: "mod-preview-btn mod-preview-btn-reject",
		});
		closeBtn.onclick = () => {
			this.previewEl?.empty();
		};
	}

	private updateInputState(): void {
		if (this.inputEl && this.sendBtnEl) {
			this.inputEl.disabled = this.isLoading;
			this.sendBtnEl.disabled = this.isLoading;
			this.sendBtnEl.textContent = this.isLoading ? "取消" : "发送";
		}
	}

	private async renderMessages(): Promise<void> {
		if (!this.messagesEl) return;
		this.messagesEl.empty();

		for (const msg of this.messages) {
			if (msg.role === "tool") continue;
			if (msg.role === "assistant" && (msg as { tool_calls?: ToolCall[] }).tool_calls && !msg.content) continue;

			const bubble = this.messagesEl.createDiv("message");
			bubble.addClass(
				msg.role === "user" ? "message-user" : "message-assistant",
			);

			if (msg.role === "assistant") {
				if (msg.content) {
					await MarkdownRenderer.render(
						this.app,
						msg.content,
						bubble,
						"",
						this,
					);
				}
			} else {
				bubble.setText(msg.content);
			}
		}
	}

	private scrollToBottom(): void {
		if (this.messagesEl) {
			this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
		}
	}

	async onClose(): Promise<void> {
		if (this.abortController) {
			this.abortController.abort();
		}
		if (this.escapeHandler) {
			window.removeEventListener("keydown", this.escapeHandler);
		}
		this.previewEl = null;
	}
}
