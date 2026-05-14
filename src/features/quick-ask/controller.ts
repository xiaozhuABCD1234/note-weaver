import { App, Editor, MarkdownView } from "obsidian";
import type { ApiMessage } from "@/types";
import { type IChatClient } from "@/core/agent";
import { getActiveNoteContext, getSelectedText } from "@/services/note-operations";
import type { QuickAskConfig, QuickAskResult } from "./types";

export interface QuickAskDeps {
	icClient: IChatClient;
	config: QuickAskConfig;
}

export class QuickAskController {
	private panelEl: HTMLDivElement | null = null;
	private keydownHandler: ((e: KeyboardEvent) => void) | null = null;
	private onResult: ((result: QuickAskResult) => void) | null = null;
	private isOpen = false;

	constructor(
		private app: App,
		private deps: QuickAskDeps,
	) {}

	load(): void {
		if (!this.deps.config.enabled) return;

		this.keydownHandler = (e: KeyboardEvent) => {
			if (this.isOpen) return;
			const view = this.app.workspace.getActiveViewOfType(MarkdownView);
			if (!view) return;

			if (e.key === this.deps.config.triggerChar && !e.ctrlKey && !e.metaKey && !e.altKey) {
				const editor = view.editor;
				const cursor = editor.getCursor();
				const line = editor.getLine(cursor.line);
				const ch = cursor.ch;

				if (ch > 0) {
					const prevChar = line[ch - 1];
					if (prevChar && prevChar.match(/[\w\u4e00-\u9fff]/)) {
						return;
					}
				}

				this.openPanel(view, editor);
			}
		};

		document.addEventListener("keydown", this.keydownHandler);
	}

	unload(): void {
		this.closePanel();
		if (this.keydownHandler) {
			document.removeEventListener("keydown", this.keydownHandler);
			this.keydownHandler = null;
		}
	}

	private openPanel(view: MarkdownView, editor: Editor): void {
		if (this.isOpen) return;
		this.isOpen = true;

		this.panelEl = document.createElement("div");
		this.panelEl.className = "quick-ask-panel";
		document.body.appendChild(this.panelEl);

		const editorRect = view.contentEl.getBoundingClientRect();
		this.panelEl.style.top = `${editorRect.top + 40}px`;
		this.panelEl.style.left = `${Math.max(8, editorRect.left + 8)}px`;

		const note = getActiveNoteContext(this.app);
		const sel = getSelectedText(this.app);

		const systemContext: string[] = [];
		if (note) {
			systemContext.push(`当前笔记: ${note.file.path}`);
		}
		if (sel) {
			systemContext.push(`选中文本: ${sel.slice(0, 200)}`);
		}

		this.renderPanel(editor, systemContext.join("\n"));
	}

	private renderPanel(editor: Editor, context: string): void {
		if (!this.panelEl) return;

		this.panelEl.innerHTML = `
			<div class="quick-ask-header">
				<span class="quick-ask-title">Quick Ask</span>
				<button class="quick-ask-close" aria-label="关闭">×</button>
			</div>
			<div class="quick-ask-body">
				<textarea
					class="quick-ask-input"
					placeholder="输入问题..."
					rows="2"
				></textarea>
				<button class="quick-ask-send" disabled>发送</button>
				<div class="quick-ask-result" style="display:none"></div>
			</div>
			<div class="quick-ask-footer" style="display:none">
				<button class="quick-ask-accept">Tab 插入</button>
				<button class="quick-ask-cancel">Esc 关闭</button>
			</div>
		`;

		const input = this.panelEl.querySelector(".quick-ask-input") as HTMLTextAreaElement;
		const sendBtn = this.panelEl.querySelector(".quick-ask-send") as HTMLButtonElement;
		const resultEl = this.panelEl.querySelector(".quick-ask-result") as HTMLDivElement;
		const footerEl = this.panelEl.querySelector(".quick-ask-footer") as HTMLDivElement;
		const acceptBtn = this.panelEl.querySelector(".quick-ask-accept") as HTMLButtonElement;
		const cancelBtn = this.panelEl.querySelector(".quick-ask-cancel") as HTMLButtonElement;
		const closeBtn = this.panelEl.querySelector(".quick-ask-close") as HTMLButtonElement;

		const close = () => this.closePanel();

		closeBtn.addEventListener("click", close);
		cancelBtn.addEventListener("click", close);

		const handleKeydown = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				close();
				return;
			}
			if (e.key === "Enter" && !e.shiftKey && input.value.trim()) {
				e.preventDefault();
				sendBtn.click();
			}
		};

		input.addEventListener("keydown", handleKeydown);

		input.addEventListener("input", () => {
			sendBtn.disabled = !input.value.trim();
		});

		sendBtn.addEventListener("click", async () => {
			const query = input.value.trim();
			if (!query) return;

			sendBtn.disabled = true;
			input.disabled = true;
			input.style.display = "none";
			sendBtn.style.display = "none";
			resultEl.style.display = "block";
			footerEl.style.display = "flex";
			resultEl.textContent = "思考中...";

			const systemPrompt = [
				"你是一个 AI 笔记助手。请根据上下文和用户问题给出简洁、准确的回答。使用 Markdown 格式。使用中文回答。",
				context ? `\n上下文：\n${context}` : "",
			].filter(Boolean).join("\n");

			const messages: ApiMessage[] = [
				{ role: "system", content: systemPrompt },
				{ role: "user", content: query },
			];

			let fullContent = "";
			try {
				const stream = this.deps.icClient.chat(messages, []);
				resultEl.textContent = "";
				for await (const event of stream) {
					if (event.type === "content") {
						fullContent += event.content;
						resultEl.innerHTML = this.renderMarkdown(fullContent);
					}
				}
			} catch (e) {
				fullContent = `错误: ${e instanceof Error ? e.message : String(e)}`;
				resultEl.textContent = fullContent;
			}

			this.onResult = (result: QuickAskResult) => {
				if (result.accepted && result.content) {
					editor.replaceSelection(result.content);
				}
			};

			const acceptHandler = () => {
				this.onResult?.({ content: fullContent, accepted: true });
				close();
			};

			acceptBtn.addEventListener("click", acceptHandler);

			const resultKeydown = (e: KeyboardEvent) => {
				if (e.key === "Tab") {
					e.preventDefault();
					acceptHandler();
				}
			};
			document.addEventListener("keydown", resultKeydown);

			this.panelEl?.addEventListener("remove", () => {
				document.removeEventListener("keydown", resultKeydown);
			});
		});

		setTimeout(() => input?.focus(), 50);
	}

	private renderMarkdown(text: string): string {
		const escaped = text
			.replace(/&/g, "&amp;")
			.replace(/</g, "&lt;")
			.replace(/>/g, "&gt;");

		return escaped
			.replace(/```(\w*)\n([\s\S]*?)```/g, "<pre><code>$2</code></pre>")
			.replace(/`([^`]+)`/g, "<code>$1</code>")
			.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
			.replace(/\*(.+?)\*/g, "<em>$1</em>")
			.replace(/\n/g, "<br>");
	}

	private closePanel(): void {
		this.isOpen = false;
		this.onResult = null;
		if (this.panelEl && this.panelEl.parentNode) {
			this.panelEl.parentNode.removeChild(this.panelEl);
		}
		this.panelEl = null;
	}
}
