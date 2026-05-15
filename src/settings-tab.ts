import { App, PluginSettingTab, Setting } from "obsidian";
import NoteWeaver from "@/main";
import type { FileScope } from "@/core/rag/types";

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
			.setName("Max tokens")
			// eslint-disable-next-line obsidianmd/ui/sentence-case
			.setDesc("每次请求的最大 Token 数，防止 JSON 被截断")
			.addText((text) =>
				text
					.setPlaceholder("16384")
					.setValue(String(this.plugin.settings.maxTokens))
					.onChange(async (value) => {
						const num = parseInt(value, 10);
						if (!isNaN(num) && num > 0) {
							this.plugin.settings.maxTokens = num;
							await this.plugin.saveSettings();
						}
					}),
			);

		// ── 思考模式设置 ──
		new Setting(containerEl).setName("思考模式").setHeading();

		const effortSetting = new Setting(containerEl);

		new Setting(containerEl)
			.setName("启用思考模式")
			// eslint-disable-next-line obsidianmd/ui/sentence-case
			.setDesc("开启后模型会先进行内部推理再输出答案（仅 DeepSeek 等部分模型支持）")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.thinkingMode)
					.onChange(async (value) => {
						this.plugin.settings.thinkingMode = value;
						effortSetting.setDisabled(!value);
						await this.plugin.saveSettings();
					}),
			);

		effortSetting
			.setName("思考强度")
			.setDesc("控制模型推理的深度，high 适合常规任务，max 适合复杂任务")
			.addDropdown((dropdown) =>
				dropdown
					.addOption("high", "High")
					.addOption("max", "Max")
					.setValue(this.plugin.settings.reasoningEffort)
					.onChange(async (value: string) => {
						this.plugin.settings.reasoningEffort = value as "high" | "max";
						await this.plugin.saveSettings();
					}),
			);
		effortSetting.setDisabled(!this.plugin.settings.thinkingMode);

		// ── 网络搜索设置 ──
		new Setting(containerEl).setName("网络搜索").setHeading();

		new Setting(containerEl)
			.setName("启用网络搜索")
			// eslint-disable-next-line obsidianmd/ui/sentence-case
			.setDesc("开启后，AI 助手可通过 DuckDuckGo 搜索互联网获取实时信息")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.webSearchEnabled)
					.onChange(async (value) => {
						this.plugin.settings.webSearchEnabled = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("最大搜索结果数")
			.setDesc("每次搜索返回的最大结果数量")
			.addText((text) =>
				text
					.setPlaceholder("5")
					.setValue(String(this.plugin.settings.webSearchMaxResults))
					.onChange(async (value) => {
						const num = parseInt(value, 10);
						if (!isNaN(num) && num > 0 && num <= 20) {
							this.plugin.settings.webSearchMaxResults = num;
							await this.plugin.saveSettings();
						}
					}),
			);

		// ── Quick Ask 设置 ──
		new Setting(containerEl).setName("Quick ask").setHeading();

		new Setting(containerEl)
			// eslint-disable-next-line obsidianmd/ui/sentence-case
			.setName("启用 Quick ask")
			.setDesc("在编辑器中输入 @ 触发内联 AI 问答面板")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.quickAsk.enabled)
					.onChange(async (value) => {
						this.plugin.settings.quickAsk.enabled = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl).setDesc(
			// eslint-disable-next-line obsidianmd/ui/sentence-case
			"API key 存储在本地插件配置中，请确保 Vault 环境安全。",
		);

		// ── RAG 设置 ──
		// eslint-disable-next-line obsidianmd/ui/sentence-case
		new Setting(containerEl).setName("知识检索 (RAG)").setHeading();

		new Setting(containerEl)
			// eslint-disable-next-line obsidianmd/ui/sentence-case
			.setName("启用 RAG")
			// eslint-disable-next-line obsidianmd/ui/sentence-case
			.setDesc("开启后，AI 助手会自动检索 Vault 中与问题相关的笔记内容作为上下文")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.rag.enabled)
					.onChange(async (value) => {
						this.plugin.settings.rag.enabled = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("最大检索块数")
			.setDesc("每次查询最多检索多少个相关片段")
			.addText((text) =>
				text
					.setPlaceholder("5")
					.setValue(String(this.plugin.settings.rag.maxChunks))
					.onChange(async (value) => {
						const num = parseInt(value, 10);
						if (!isNaN(num) && num > 0 && num <= 50) {
							this.plugin.settings.rag.maxChunks = num;
							await this.plugin.saveSettings();
						}
					}),
			);

		new Setting(containerEl)
			.setName("分块大小（字符）")
			.setDesc("每个笔记片段的最大字符数")
			.addText((text) =>
				text
					.setPlaceholder("1000")
					.setValue(String(this.plugin.settings.rag.chunkSize))
					.onChange(async (value) => {
						const num = parseInt(value, 10);
						if (!isNaN(num) && num >= 100 && num <= 10000) {
							this.plugin.settings.rag.chunkSize = num;
							await this.plugin.saveSettings();
						}
					}),
			);

		new Setting(containerEl)
			.setName("分块重叠（字符）")
			.setDesc("相邻片段之间的重叠字符数")
			.addText((text) =>
				text
					.setPlaceholder("200")
					.setValue(String(this.plugin.settings.rag.chunkOverlap))
					.onChange(async (value) => {
						const num = parseInt(value, 10);
						if (!isNaN(num) && num >= 0 && num <= 1000) {
							this.plugin.settings.rag.chunkOverlap = num;
							await this.plugin.saveSettings();
						}
					}),
			);

		new Setting(containerEl)
			.setName("检索范围")
			.setDesc("限制 AI 助手检索笔记的范围")
			.addDropdown((dropdown) =>
				dropdown
					.addOption("current-folder", "当前文件夹")
					.addOption("all-vault", "整个 vault")
					.setValue(this.plugin.settings.rag.scope)
					.onChange(async (value: string) => {
						this.plugin.settings.rag.scope = value as FileScope;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("重建索引")
			// eslint-disable-next-line obsidianmd/ui/sentence-case
			.setDesc("重新扫描 Vault 中的所有笔记，构建知识索引")
			.addButton((button) =>
				button.setButtonText("立即重建").onClick(async () => {
					button.setDisabled(true);
					button.setButtonText("重建中...");
					await this.plugin.buildRagIndex();
					button.setDisabled(false);
					button.setButtonText("立即重建");
				}),
			);
	}
}
