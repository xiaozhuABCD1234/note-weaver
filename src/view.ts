import { ItemView, MarkdownRenderer, Notice, WorkspaceLeaf } from "obsidian";
import NoteWeaver from "./main";
import { ChatMessage } from "./api";
import {
	getActiveNoteContext,
	getSelectedText,
	applyModification,
	createNewNote,
	MODIFICATION_MARKER_START,
	MODIFICATION_MARKER_END,
} from "./note-operations";

export const VIEW_TYPE_EXAMPLE = "example-view";

export class ChatView extends ItemView {
	messages: ChatMessage[] = [];
	isLoading = false;
	private plugin: NoteWeaver;
	private messagesEl: HTMLElement | null = null;
	private inputEl: HTMLInputElement | null = null;
	private sendBtnEl: HTMLButtonElement | null = null;
	private abortController: AbortController | null = null;
	private escapeHandler: ((e: KeyboardEvent) => void) | null = null;
	private pendingSelection: string | null = null;

	constructor(leaf: WorkspaceLeaf, plugin: NoteWeaver) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType(): string {
		return VIEW_TYPE_EXAMPLE;
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

	private buildSystemMessage(): ChatMessage {
		const note = getActiveNoteContext(this.app);
		const selection = this.pendingSelection ?? getSelectedText(this.app);

		let systemContent =
			"你是 Note Weaver AI 助手，运行在 Obsidian 笔记软件中。你具有读取和修改当前笔记的能力。";

		if (note) {
			systemContent += `\n\n当前打开的笔记为：「${note.file.basename}」\n笔记完整内容：\n---\n${note.content}\n---`;
		}

		if (selection) {
			systemContent += `\n\n用户的选中文本：\n---\n${selection}\n---`;
		}

		systemContent += `\n\n当用户要求你修改笔记时，请遵循以下规则：
1. 阅读并理解当前笔记/选中文本的内容
2. 根据用户要求进行修改
3. 将**修改后的完整内容**（整篇笔记或相关部分）包裹在以下标记中：
${MODIFICATION_MARKER_START}
[修改后的内容]
${MODIFICATION_MARKER_END}
4. 在标记之外，简要说明你做了哪些修改`;

		return { role: "system", content: systemContent };
	}

	protected async onOpen(): Promise<void> {
		const container = this.containerEl;
		container.empty();
		container.addClass("chat-container");

		const wrapper = container.createDiv("chat-wrapper");

		this.messagesEl = wrapper.createDiv("messages-wrapper");
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

		this.inputEl = inputArea.createEl("input", {
			type: "text",
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
			new Notice("请先在设置中配置 API Key");
			return;
		}

		const selection = this.pendingSelection;
		this.pendingSelection = null;

		this.inputEl.value = "";
		this.inputEl.placeholder = "输入消息...";

		const systemMessage = this.buildSystemMessage();
		const apiMessages: ChatMessage[] = [
			systemMessage,
			...this.messages,
			{ role: "user", content },
		];

		this.messages.push({ role: "user", content });
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

		const aiMessage: ChatMessage = { role: "assistant", content: "" };
		this.messages.push(aiMessage);

		try {
			const stream = this.plugin.getChatStream(
				selection ? apiMessages : apiMessages,
				this.abortController.signal,
			);
			for await (const chunk of stream) {
				aiMessage.content += chunk;
				await this.renderMessages();
				this.scrollToBottom();
			}

			const modifiedContent = this.extractModifiedContent(aiMessage.content);
			if (modifiedContent) {
				aiMessage.content = aiMessage.content
					.replace(
						new RegExp(
							`${MODIFICATION_MARKER_START}[\\s\\S]*?${MODIFICATION_MARKER_END}`,
						),
						"",
					)
					.trim();
				await this.renderMessages();
				this.showModificationPreview(modifiedContent);
			}
		} catch (error) {
			if (error instanceof Error && error.name === "AbortError") {
				aiMessage.content += "\n[已取消]";
			} else {
				aiMessage.content = `错误: ${
					error instanceof Error ? error.message : "未知错误"
				}`;
				new Notice("AI 响应失败，请检查配置");
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

	private extractModifiedContent(text: string): string | null {
		const pattern = new RegExp(
			`${MODIFICATION_MARKER_START}\\s*([\\s\\S]*?)\\s*${MODIFICATION_MARKER_END}`,
		);
		const match = text.match(pattern);
		return match?.[1]?.trim() ?? null;
	}

	private showModificationPreview(content: string): void {
		if (!this.messagesEl) return;

		const previewContainer = this.messagesEl.createDiv("modification-preview");

		const header = previewContainer.createDiv(
			"modification-preview-header",
		);
		header.setText("修改预览");

		const body = previewContainer.createDiv("modification-preview-body");
		void MarkdownRenderer.render(this.app, content, body, "", this);

		const actions = previewContainer.createDiv("modification-preview-actions");

		const applyBtn = actions.createEl("button", {
			text: "应用修改",
			cls: "mod-preview-btn mod-preview-btn-apply",
		});

		const rejectBtn = actions.createEl("button", {
			text: "忽略",
			cls: "mod-preview-btn mod-preview-btn-reject",
		});

		const note = getActiveNoteContext(this.app);
		if (note) {
			applyBtn.setText("应用修改");
			applyBtn.onclick = async () => {
				try {
					await applyModification(note.file, content);
					new Notice("笔记已更新");
					previewContainer.remove();
				} catch (e) {
					new Notice(
						`修改失败: ${e instanceof Error ? e.message : "未知错误"}`,
					);
				}
			};
		} else {
			applyBtn.setText("创建新笔记");
			applyBtn.onclick = async () => {
				const file = await createNewNote(this.app, content);
				if (file) {
					new Notice("新笔记已创建");
					previewContainer.remove();
				}
			};
		}

		rejectBtn.onclick = () => {
			previewContainer.remove();
		};

		this.scrollToBottom();
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
			const bubble = this.messagesEl.createDiv("message");
			bubble.addClass(
				msg.role === "user" ? "message-user" : "message-assistant",
			);

			if (msg.role === "assistant") {
				const displayContent = msg.content.includes(MODIFICATION_MARKER_START)
					? msg.content.replace(
							new RegExp(
								`${MODIFICATION_MARKER_START}[\\s\\S]*?${MODIFICATION_MARKER_END}`,
							),
							"",
					  ).trim() || ""
					: msg.content;
				if (displayContent) {
					await MarkdownRenderer.render(
						this.app,
						displayContent,
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
	}
}
