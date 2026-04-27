import { App, PluginSettingTab, Setting } from "obsidian";
import NoteWeaver from "./main";

export interface NoteWeaverSettings {
	apiKey: string;
	baseUrl: string;
	modelName: string;
	maxTokens: number;
}

export const DEFAULT_SETTINGS: NoteWeaverSettings = {
	apiKey: "",
	baseUrl: "https://api.deepseek.com",
	modelName: "deepseek-v4-flash",
	maxTokens: 4096,
};

export class NoteWeaverSettingTab extends PluginSettingTab {
	plugin: NoteWeaver;

	constructor(app: App, plugin: NoteWeaver) {
		super(app, plugin);
		this.plugin = plugin;
	}

	private encode(str: string): string {
		return btoa(str);
	}

	private decode(str: string): string {
		try {
			return atob(str);
		} catch {
			return str;
		}
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName("API key")
			.setDesc(
				// eslint-disable-next-line obsidianmd/ui/sentence-case
				"用于调用 LLM API 的密钥，支持 OpenAI、Claude 等服务。存储时做基础掩码处理。",
			)
			.addText((text) =>
				text
					.setPlaceholder("Sk-...")
					.setValue(this.decode(this.plugin.settings.apiKey))
					.onChange(async (value) => {
						this.plugin.settings.apiKey = this.encode(value);
						await this.plugin.saveSettings();
					}),
			)
			.then((setting) => {
				const input = setting.descEl.parentElement?.querySelector(
					'input[type="text"]',
				) as HTMLInputElement | null;
				if (input) {
					input.type = "password";
					input.addEventListener("focus", () => {
						input.type = "text";
					});
					input.addEventListener("blur", () => {
						input.type = "password";
					});
				}
			});

		new Setting(containerEl)
			.setName("Base URL")
			.setDesc("API 服务器地址，不同服务商地址不同")
			.addText((text) =>
				text
					.setPlaceholder("https://api.deepseek.com")
					.setValue(this.plugin.settings.baseUrl)
					.onChange(async (value) => {
						this.plugin.settings.baseUrl = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Model")
			.setDesc("要使用的模型名称，如 gpt-4、claude-3-5-sonnet")
			.addText((text) =>
				text
					// eslint-disable-next-line obsidianmd/ui/sentence-case
					.setPlaceholder("deepseek-v4-flash")
					.setValue(this.plugin.settings.modelName)
					.onChange(async (value) => {
						this.plugin.settings.modelName = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Max Tokens")
			.setDesc("每次请求的最大 Token 数，防止 JSON 被截断")
			.addText((text) =>
				text
					.setPlaceholder("4096")
					.setValue(String(this.plugin.settings.maxTokens))
					.onChange(async (value) => {
						const num = parseInt(value, 10);
						if (!isNaN(num) && num > 0) {
							this.plugin.settings.maxTokens = num;
							await this.plugin.saveSettings();
						}
					}),
			);

		new Setting(containerEl).setDesc(
			// eslint-disable-next-line obsidianmd/ui/sentence-case
			"API Key 存储在本地插件配置中，请确保 Vault 环境安全。",
		);
	}
}
