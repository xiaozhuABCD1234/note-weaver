import { App, Editor, MarkdownView, Modal, Notice, Plugin } from "obsidian";
import {
  DEFAULT_SETTINGS,
  NoteWeaverSettings,
  NoteWeaverSettingTab,
} from "./settings";

// Remember to rename these class names!

export default class NoteWeaver extends Plugin {
  settings: NoteWeaverSettings;

  async onload() {
    await this.loadSettings();

    // 在左侧功能区创建一个图标
    this.addRibbonIcon("dice", "Sample", (evt: MouseEvent) => {
      // 当用户点击图标时调用
      new Notice("This is a notice!");
    });

    // 添加一个状态栏项到应用底部，在移动端应用中无效
    const statusBarItemEl = this.addStatusBarItem();
    statusBarItemEl.setText("Status bar text");

    // 添加一个简单的命令，可以在任何地方触发
    this.addCommand({
      id: "open-modal-simple",
      name: "Open modal (simple)",
      callback: () => {
        new SampleModal(this.app).open();
      },
    });
    // 添加一个编辑器命令，可以对当前编辑器实例执行一些操作
    this.addCommand({
      id: "replace-selected",
      name: "Replace selected content",
      editorCallback: (editor: Editor, view: MarkdownView) => {
        editor.replaceSelection("Sample editor command");
      },
    });
    // 添加一个复杂的命令，可以检查应用的当前状态是否允许执行该命令
    this.addCommand({
      id: "open-modal-complex",
      name: "Open modal (complex)",
      checkCallback: (checking: boolean) => {
        // 要检查的条件
        const markdownView = this.app.workspace.getActiveViewOfType(
          MarkdownView,
        );
        if (markdownView) {
          // 如果 checking 为 true，我们只是"检查"命令是否可以运行
          // 如果 checking 为 false，那么我们真的要执行该操作
          if (!checking) {
            new SampleModal(this.app).open();
          }

          // 只有当检查函数返回 true 时，该命令才会在命令面板中显示
          return true;
        }
        return false;
      },
    });

    // 添加一个设置标签页，让用户可以配置插件的各个方面
    this.addSettingTab(new NoteWeaverSettingTab(this.app, this));

    // 如果插件挂载了任何全局 DOM 事件（在不属于此插件的应用部分上）
    // 使用此函数会在插件禁用时自动移除事件监听器
    this.registerDomEvent(document, "click", (evt: MouseEvent) => {
      new Notice("Click");
    });

    // 注册定时器时，此函数会在插件禁用时自动清除定时器
    this.registerInterval(
      window.setInterval(() => console.log("setInterval"), 5 * 60 * 1000),
    );
  }

  onunload() {}

  async loadSettings() {
    this.settings = Object.assign(
      {},
      DEFAULT_SETTINGS,
      (await this.loadData()) as Partial<NoteWeaverSettings>,
    );
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}

class SampleModal extends Modal {
  constructor(app: App) {
    super(app);
  }

  onOpen() {
    let { contentEl } = this;
    contentEl.setText("Woah!");
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}
