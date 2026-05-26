import { App, Notice, PluginSettingTab, Setting } from "obsidian";
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

		// ── API 设置 ──
		new Setting(containerEl).setName("API 设置").setHeading();

		new Setting(containerEl)
			.setName("API key")
			// eslint-disable-next-line obsidianmd/ui/sentence-case
			.setDesc("用于调用 LLM API 的密钥。存储时做基础掩码处理。")
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

		new Setting(containerEl).setDesc(
			"API key 存储在本地插件配置中，请确保 vault 环境安全。",
		);

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
			.setDesc("每次请求的最大 token 数")
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

		new Setting(containerEl)
			.setName("验证连接")
			.setDesc("测试当前 API 配置是否可用")
			.addButton((button) =>
				button.setButtonText("验证").onClick(async () => {
					button.setDisabled(true);
					button.setButtonText("验证中...");
					const [, msg] = await this.plugin.validateConfig();
					new Notice(msg);
					button.setDisabled(false);
					button.setButtonText("验证");
				}),
			);

		// ── 模型行为 ──
		new Setting(containerEl).setName("模型行为").setHeading();

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

		// ── 知识库 ──
		new Setting(containerEl).setName("知识库").setHeading();

		new Setting(containerEl)
			.setName("知识库路径")
			.setDesc("AI 创建知识笔记时的存放文件夹路径，相对于 vault 根目录")
			.addText((text) =>
				text
					.setPlaceholder("知识库")
					.setValue(this.plugin.settings.knowledgeBasePath)
					.onChange(async (value) => {
						this.plugin.settings.knowledgeBasePath = value;
						await this.plugin.saveSettings();
					}),
			);

		// ── 联想笔记 ──
		new Setting(containerEl).setName("联想笔记").setHeading();

		new Setting(containerEl)
			.setName("启用")
			.setDesc("开启后 AI 助手会自动查找与当前笔记相关的其他笔记作为上下文")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.rag.enabled)
					.onChange(async (value) => {
						this.plugin.settings.rag.enabled = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("最大联想笔记数")
			.setDesc("每次查询最多关联多少篇笔记")
			.addText((text) =>
				text
					.setPlaceholder("5")
					.setValue(String(this.plugin.settings.rag.maxRelatedNotes))
					.onChange(async (value) => {
						const num = parseInt(value, 10);
						if (!isNaN(num) && num >= 1 && num <= 20) {
							this.plugin.settings.rag.maxRelatedNotes = num;
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
			.setName("正向链接")
			.setDesc("包含当前笔记通过 [[wikilink]] 链接到的笔记")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.rag.includeForwardLinks)
					.onChange(async (value) => {
						this.plugin.settings.rag.includeForwardLinks = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("反向链接")
			.setDesc("包含链接到当前笔记的笔记")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.rag.includeBacklinks)
					.onChange(async (value) => {
						this.plugin.settings.rag.includeBacklinks = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("标签匹配")
			.setDesc("包含与当前笔记有相同标签的笔记")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.rag.includeTagMatches)
					.onChange(async (value) => {
						this.plugin.settings.rag.includeTagMatches = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("链接深度")
			.setDesc("正向链接的遍历层数：1 层（仅直接链接）或 2 层（也包含链接的链接）")
			.addDropdown((dropdown) =>
				dropdown
					.addOption("1", "1 层")
					.addOption("2", "2 层")
					.setValue(String(this.plugin.settings.rag.linkDepth))
					.onChange(async (value: string) => {
						this.plugin.settings.rag.linkDepth = parseInt(value, 10);
						await this.plugin.saveSettings();
					}),
			);

		// ── 网络搜索 ──
		new Setting(containerEl).setName("网络搜索").setHeading();

		new Setting(containerEl)
			.setName("启用")
			// eslint-disable-next-line obsidianmd/ui/sentence-case
			.setDesc("开启后 AI 助手可通过 DuckDuckGo 搜索互联网获取实时信息")
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

		// ── Quick ask ──
		new Setting(containerEl).setName("Quick ask").setHeading();

		new Setting(containerEl)
			.setName("启用")
			.setDesc("在编辑器中输入 @ 触发内联 AI 问答面板")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.quickAsk.enabled)
					.onChange(async (value) => {
						this.plugin.settings.quickAsk.enabled = value;
						await this.plugin.saveSettings();
					}),
			);
	}
}
