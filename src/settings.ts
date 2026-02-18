import { App, PluginSettingTab, Setting } from "obsidian";
import NoteWeaver from "./main";

export interface NoteWeaverSettings {
  apiKey: string;
  baseUrl: string;
  modelName: string;
}

export const DEFAULT_SETTINGS: NoteWeaverSettings = {
  apiKey: "",
  baseUrl: "https://api.deepseek.com/v1",
  modelName: "deepseek-chat",
};

export class NoteWeaverSettingTab extends PluginSettingTab {
  plugin: NoteWeaver;

  constructor(app: App, plugin: NoteWeaver) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;

    containerEl.empty();

    new Setting(containerEl)
      .setName("API Key")
      .setDesc("用于调用 LLM API 的密钥，支持 OpenAI、Claude 等服务")
      .addText((text) =>
        text
          .setPlaceholder("Sk-...")
          .setValue(this.plugin.settings.apiKey)
          .onChange(async (value) => {
            this.plugin.settings.apiKey = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Base URL")
      .setDesc("API 服务器地址，不同服务商地址不同")
      .addText((text) =>
        text
          .setPlaceholder("https://api.deepseek.com/v1")
          .setValue(this.plugin.settings.baseUrl)
          .onChange(async (value) => {
            this.plugin.settings.baseUrl = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Model")
      .setDesc("要使用的模型名称，如 gpt-4、claude-3-5-sonnet")
      .addText((text) =>
        text
          .setPlaceholder("deepseek-chat")
          .setValue(this.plugin.settings.modelName)
          .onChange(async (value) => {
            this.plugin.settings.modelName = value;
            await this.plugin.saveSettings();
          })
      );
  }
}
