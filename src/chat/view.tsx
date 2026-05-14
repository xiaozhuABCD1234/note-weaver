import { ItemView, WorkspaceLeaf } from "obsidian";
import { Root, createRoot } from "react-dom/client";
import type { ChatDeps } from "./chat-service";
import { AppContext } from "@/context/app-context";
import { ChatPanel } from "./components/ChatPanel";

export const VIEW_TYPE_CHAT = "note-weaver-chat";

export class ChatView extends ItemView {
	private deps: ChatDeps;
	private root: Root | null = null;
	private pendingSelectionRef: { current: ((selection: string) => void) | null } = { current: null };

	constructor(leaf: WorkspaceLeaf, deps: ChatDeps) {
		super(leaf);
		this.deps = deps;
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
		this.pendingSelectionRef.current?.(selection);
	}

	protected async onOpen(): Promise<void> {
		this.containerEl.empty();
		this.containerEl.addClass("chat-container");

		this.root = createRoot(this.containerEl);
		this.root.render(
			<AppContext.Provider value={this.app}>
				<ChatPanel
					deps={this.deps}
					component={this}
					pendingSelectionRef={this.pendingSelectionRef}
				/>
			</AppContext.Provider>,
		);
	}

	async onClose(): Promise<void> {
		this.root?.unmount();
		this.root = null;
	}
}
