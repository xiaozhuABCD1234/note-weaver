import { ItemView, MarkdownRenderer, Notice, WorkspaceLeaf } from "obsidian";
import NoteWeaver from "./main";
import { ChatMessage } from "./api";

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

		this.inputEl.value = "";
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
			const stream = this.plugin.getChatStream(this.messages);
			for await (const chunk of stream) {
				aiMessage.content += chunk;
				await this.renderMessages();
				this.scrollToBottom();
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
				await MarkdownRenderer.render(this.app, msg.content, bubble, "", this);
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
