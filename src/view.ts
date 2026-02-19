import { ItemView, WorkspaceLeaf } from "obsidian";

export const VIEW_TYPE_EXAMPLE = "example-view";

export class ExampleView extends ItemView {
  constructor(leaf: WorkspaceLeaf) {
    super(leaf);
  }

  getViewType(): string {
    return VIEW_TYPE_EXAMPLE;
  }

  getDisplayText(): string {
    return "Example view";
  }

  protected async onOpen(): Promise<void> {
    const container = this.containerEl;
    container.empty();
    container.createEl("h4", { text: "	示例 标题1" });
  }

  async onClose() {
    // Nothing to clean up.
  }
}
