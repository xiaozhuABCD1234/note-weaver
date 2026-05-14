import type { App } from "obsidian";
import type { ApiMessage, ChatMessage, StreamEvent, ToolCall, ToolResultMessage } from "../types";
import { getActiveNoteContext, getSelectedText } from "../services/note-operations";
import { buildSystemPrompt } from "../prompts/system-prompt";

export interface ChatDeps {
	getChatStreamWithTools(
		messages: ApiMessage[],
		signal?: AbortSignal,
	): AsyncGenerator<StreamEvent>;
	vaultService: {
		executeToolCalls(calls: ToolCall[]): Promise<ToolResultMessage[]>;
		readonly lastWritePath: string | null;
		readonly lastWriteContent: string | null;
	};
	ragEngine: {
		getContextForQuery(query: string): Promise<string>;
	};
	readonly settings: {
		apiKey: string;
		rag: { enabled: boolean };
	};
	logger: {
		log(entry: {
			level: string;
			type: string;
			message: string;
			data?: Record<string, unknown>;
		}): void;
	};
}

export interface ChatEventHandler {
	onMessagesChanged(messages: ApiMessage[]): Promise<void>;
	onLoadingChanged(loading: boolean): void;
	onWritePreview(path: string, content: string): Promise<void>;
	onNotice(message: string): void;
}

export class ChatOrchestrator {
	messages: ApiMessage[] = [];
	isLoading = false;
	pendingSelection: string | null = null;

	private abortController: AbortController | null = null;
	private escapeHandler: ((e: KeyboardEvent) => void) | null = null;
	private maxToolRounds = 10;

	constructor(
		private deps: ChatDeps,
		private handler: ChatEventHandler,
	) {}

	initialize(): void {
		this.messages = [
			{
				role: "assistant",
				content: "你好！我是 Note Weaver AI 助手，有什么可以帮你的吗？",
			},
		];
		this.isLoading = false;
		this.pendingSelection = null;
	}

	setPendingSelection(selection: string): void {
		this.pendingSelection = selection;
	}

	async sendMessage(content: string, app: App): Promise<void> {
		if (!content || this.isLoading) return;

		if (!this.deps.settings.apiKey) {
			this.handler.onNotice("请先在设置中配置 API key");
			return;
		}

		const selection = this.pendingSelection;
		this.pendingSelection = null;

		const systemMessage = await this.buildSystemMessage(content, selection, app);
		const currentDisplayMessages = [...this.messages];

		const userMessage: ChatMessage = { role: "user", content };
		this.messages.push(userMessage);
		await this.handler.onMessagesChanged(this.messages);

		this.isLoading = true;
		this.handler.onLoadingChanged(true);

		this.abortController = new AbortController();

		this.escapeHandler = (e: KeyboardEvent) => {
			if (e.key === "Escape" && this.isLoading) {
				this.abortController?.abort();
			}
		};
		window.addEventListener("keydown", this.escapeHandler);

		this.deps.logger.log({
			level: "info",
			type: "chat",
			message: "用户发送消息",
			data: { content, hasSelection: !!selection },
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
				const stream = this.deps.getChatStreamWithTools(
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
						await this.handler.onMessagesChanged(this.messages);
					} else if (event.type === "tool_calls") {
						toolCalls = event.calls;
						reasoningContent = event.reasoningContent;
					}
				}

				if (toolCalls && toolCalls.length > 0) {
					const toolNames = toolCalls.map(tc => tc.function.name).join(", ");
					this.handler.onNotice(`🤖 AI 正在执行: ${toolNames}`);

					this.deps.logger.log({
						level: "info",
						type: "tool",
						message: `AI 调用工具: ${toolNames}`,
						data: { toolCalls: toolCalls.map(tc => ({ name: tc.function.name, args: tc.function.arguments })) },
					});

					const results = await this.deps.vaultService.executeToolCalls(toolCalls);

					currentMessages = [
						...currentMessages,
						{ role: "assistant", content: streamedContent || null, tool_calls: toolCalls, reasoning_content: reasoningContent || null },
						...results,
					];

					if (this.deps.vaultService.lastWriteContent) {
						await this.handler.onWritePreview(
							this.deps.vaultService.lastWritePath ?? "",
							this.deps.vaultService.lastWriteContent,
						);
					}

					toolRounds++;
					continue;
				}

				break;
			}

			if (toolRounds >= this.maxToolRounds) {
				fullReply += "\n\n*[已超过最大工具调用轮数]*";
				this.handler.onNotice("AI 工具调用次数过多，已停止");
			}

			aiMessage.content = fullReply;
			await this.handler.onMessagesChanged(this.messages);

			this.deps.logger.log({
				level: "info",
				type: "chat",
				message: "AI 回复完成",
				data: { replyLength: fullReply.length, toolRounds },
			});
		} catch (error) {
			if (error instanceof Error && error.name === "AbortError") {
				if (aiMessage.content) {
					aiMessage.content += "\n\n*[已取消]*";
				} else {
					aiMessage.content = "*[已取消]*";
				}
				this.deps.logger.log({
					level: "warn",
					type: "chat",
					message: "用户取消了 AI 回复",
				});
			} else {
				aiMessage.content = `错误: ${
					error instanceof Error ? error.message : "未知错误"
				}`;
				this.handler.onNotice("AI 响应失败，请检查配置");
				this.deps.logger.log({
					level: "error",
					type: "api",
					message: `AI 响应失败: ${error instanceof Error ? error.message : "未知错误"}`,
				});
			}
			await this.handler.onMessagesChanged(this.messages);
		} finally {
			this.isLoading = false;
			this.handler.onLoadingChanged(false);
			this.abortController = null;
			if (this.escapeHandler) {
				window.removeEventListener("keydown", this.escapeHandler);
				this.escapeHandler = null;
			}
		}
	}

	cleanup(): void {
		if (this.abortController) {
			this.abortController.abort();
			this.abortController = null;
		}
		if (this.escapeHandler) {
			window.removeEventListener("keydown", this.escapeHandler);
			this.escapeHandler = null;
		}
	}

	private async buildSystemMessage(userQuery: string, selection: string | null, app: App): Promise<ChatMessage> {
		const note = getActiveNoteContext(app);
		const sel = selection ?? getSelectedText(app);

		const sysContent: string[] = [
			buildSystemPrompt(),
		];

		if (note) {
			sysContent.push(
				"",
				"# 当前打开的笔记",
				"",
				`笔记名称：「${note.file.basename}」(${note.file.path})`,
				"",
				"完整内容：",
				"```markdown",
				note.content,
				"```",
			);
		}

		if (sel) {
			sysContent.push(
				"",
				"# 用户的选中文本",
				"",
				"```markdown",
				sel,
				"```",
			);
		}

		if (this.deps.settings.rag.enabled && userQuery.trim()) {
			const ragContext = await this.deps.ragEngine.getContextForQuery(
				`${note ? note.file.basename + " " : ""}${userQuery} ${sel ?? ""}`,
			);
			if (ragContext) {
				sysContent.push(
					"",
					"# 从 Vault 中检索到的相关笔记内容",
					"",
					ragContext,
				);
			}
		}

		return { role: "system", content: sysContent.join("\n") };
	}
}
