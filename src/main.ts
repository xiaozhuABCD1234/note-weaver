import { App, Editor, MarkdownView, Modal, Notice, Plugin } from "obsidian";
import OpenAI from "openai";
import {
  DEFAULT_SETTINGS,
  NoteWeaverSettings,
  NoteWeaverSettingTab,
} from "./settings";

export default class NoteWeaver extends Plugin {
  settings: NoteWeaverSettings;
  client: OpenAI;

  async onload() {
    await this.loadSettings();

    // 添加一个状态栏项到应用底部，在移动端应用中无效
    const statusBarItemEl = this.addStatusBarItem();

    // 异步验证配置，不阻塞插件加载
    this.validateConfig()
      .then(([isValid, message]) => {
        statusBarItemEl.setText(isValid ? "✓ 配置正常" : `⚠ ${message}`);
      })
      .catch((error) => {
        statusBarItemEl.setText("⚠ 配置验证失败");
        console.error("Note Weaver 配置验证失败:", error);
      });

    const statusBarItemEl1 = this.addStatusBarItem();
    statusBarItemEl1.setText("Note Weaver 已加载");

    // 添加一个设置标签页，让用户可以配置插件的各个方面
    this.addSettingTab(new NoteWeaverSettingTab(this.app, this));
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

  /**
   * 验证插件配置的有效性
   *
   * 验证步骤:
   * 1. 检查 URL 和 API Key 是否可以正常连接到 OpenAI 兼容 API
   * 2. 检查指定模型是否存在且可用
   *
   * @returns [boolean, string] - 返回元组，[0] 表示是否配置有效，[1] 为状态消息
   *
   * @example
   * const [isValid, message] = await this.validateConfig();
   * if (!isValid) {
   *   new Notice(`配置无效: ${message}`);
   * }
   */
  private async validateConfig(): Promise<[boolean, string]> {
    const client = new OpenAI({
      baseURL: this.settings.baseUrl,
      apiKey: this.settings.apiKey,
      dangerouslyAllowBrowser: true,
    });

    let url_valid = false;
    let api_key_valid = false;
    let model_valid = false;

    // 步骤1: 验证 URL 和 API Key
    try {
      await client.models.list();
      url_valid = true;
      api_key_valid = true;
    } catch (error) {
      if (error instanceof OpenAI.APIConnectionError) {
        return [false, "无法连接到指定URL"];
      }
      if (error instanceof OpenAI.AuthenticationError) {
        url_valid = true; // URL通，但Key错
        return [false, "API Key 无效"];
      }
      // 其他错误也视为连接问题
      return [
        false,
        `连接失败: ${error instanceof Error ? error.message : String(error)}`,
      ];
    }

    // 步骤2: 验证模型
    try {
      await client.chat.completions.create({
        model: this.settings.modelName,
        messages: [{ role: "user", content: "test" }],
        max_tokens: 1,
      });
      model_valid = true;
      return [true, "所有配置有效"];
    } catch (error) {
      if (error instanceof OpenAI.NotFoundError) {
        return [false, `模型 '${this.settings.modelName}' 不存在`];
      }
      return [
        false,
        `模型验证失败: ${
          error instanceof Error ? error.message : String(error)
        }`,
      ];
    }
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
