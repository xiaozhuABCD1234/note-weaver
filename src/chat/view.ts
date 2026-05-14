import { ItemView, MarkdownRenderer, Notice, WorkspaceLeaf } from "obsidian";
import type { ApiMessage } from "../types";
import type { ChatDeps, ChatEventHandler } from "./chat-service";
import { ChatOrchestrator } from "./chat-service";

export const VIEW_TYPE_CHAT = "note-weaver-chat";

export class ChatView extends ItemView {
	private orchestrator: ChatOrchestrator;
	private messagesEl: HTMLElement | null = null;
	private inputEl: HTMLTextAreaElement | null = null;
	private sendBtnEl: HTMLButtonElement | null = null;

	constructor(leaf: WorkspaceLeaf, deps: ChatDeps) {
		super(leaf);
		this.orchestrator = new ChatOrchestrator(deps, this.createEventHandler());
	}

	private createEventHandler(): ChatEventHandler {
		return {
			onMessagesChanged: async (messages) => {
				await this.renderMessages(messages);
				this.scrollToBottom();
			},
			onLoadingChanged: (loading) => {
				this.updateInputState(loading);
			},
			onNotice: (message) => {
				new Notice(message);
			},
		};
	}

	getViewType(): string {
		return VIEW_TYPE_CHAT;
	}

	getIcon(): string {
		return "bot";
	}

	getDisplayText(): string {
		return "AI 助手";
	}

	setPendingSelection(selection: string): void {
		this.orchestrator.setPendingSelection(selection);
		if (this.inputEl) {
			this.inputEl.placeholder = "已选中文本，输入修改要求...";
			this.inputEl.focus();
		}
	}

	protected async onOpen(): Promise<void> {
		const container = this.containerEl;
		container.empty();
		container.addClass("chat-container");

		const wrapper = container.createDiv("chat-wrapper");

		this.messagesEl = wrapper.createDiv("messages-wrapper");
		this.createInputArea(wrapper);

		this.orchestrator.initialize();
		await this.renderMessages(this.orchestrator.messages);
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
			void this.handleSendMessage();
		};

		this.inputEl.addEventListener("keydown", (e: KeyboardEvent) => {
			if (e.key === "Enter" && !e.shiftKey) {
				e.preventDefault();
				void this.handleSendMessage();
			}
		});

		return inputArea;
	}

	private async handleSendMessage(): Promise<void> {
		if (!this.inputEl || !this.sendBtnEl) return;
		const content = this.inputEl.value.trim();
		if (!content) return;

		this.inputEl.value = "";
		this.inputEl.placeholder = "输入消息...";

		await this.orchestrator.sendMessage(content, this.app);
	}

	private updateInputState(loading: boolean): void {
		if (this.inputEl && this.sendBtnEl) {
			this.inputEl.disabled = loading;
			this.sendBtnEl.disabled = loading;
			this.sendBtnEl.textContent = loading ? "取消" : "发送";
		}
	}

	private async renderMessages(messages: ApiMessage[]): Promise<void> {
		if (!this.messagesEl) return;
		this.messagesEl.empty();

		for (const msg of messages) {
			if (msg.role === "tool") continue;
			if (msg.role === "assistant" && "tool_calls" in msg && !msg.content) continue;

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
		this.orchestrator.cleanup();
	}
}
