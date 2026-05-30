import { Setting } from "obsidian";
import NoteWeaver from "@/main";

export function renderWebSearchSection(containerEl: HTMLElement, plugin: NoteWeaver): void {
	new Setting(containerEl).setName("知识库").setHeading();

	new Setting(containerEl)
		.setName("知识库路径")
		.setDesc("AI 创建知识笔记时的存放文件夹路径，相对于 vault 根目录")
		.addText((text) =>
			text
				.setPlaceholder("知识库")
				.setValue(plugin.settings.knowledgeBasePath)
				.onChange(async (value) => {
					plugin.settings.knowledgeBasePath = value;
					await plugin.saveSettings();
				}),
		);

	new Setting(containerEl).setName("网络搜索").setHeading();

	new Setting(containerEl)
		.setName("启用")
		.setDesc("开启后 AI 助手可通过搜索互联网获取实时信息")
		.addToggle((toggle) =>
			toggle
				.setValue(plugin.settings.webSearchEnabled)
				.onChange(async (value) => {
					plugin.settings.webSearchEnabled = value;
					plugin.webService.updateConfig(
						plugin.settings.webSearchMaxResults,
						value,
					);
					await plugin.saveSettings();
				}),
		);

	new Setting(containerEl)
		.setName("搜索引擎")
		.setDesc("选择网络搜索的后端引擎")
		.addDropdown((dropdown) =>
			dropdown
				.addOption("brave", "Brave Search API")
				.addOption("duckduckgo", "DuckDuckGo")
				.setValue(plugin.settings.webSearchEngine)
				.onChange(async (value: string) => {
					const engine = value as "brave" | "duckduckgo";
					plugin.settings.webSearchEngine = engine;
					plugin.webService.updateConfig(
						plugin.settings.webSearchMaxResults,
						plugin.settings.webSearchEnabled,
						engine,
					);
					await plugin.saveSettings();
					braveKeySetting.settingEl.classList.toggle(
						"hidden",
						engine !== "brave",
					);
				}),
		);

	const braveKeySetting = new Setting(containerEl)
		.setName("Brave Search API Key")
		.setDesc("注册 https://brave.com/search/api/ 获取免费 API Key")
		.addText((text) =>
			text
				.setPlaceholder("BSA...")
				.setValue(plugin.settings.braveSearchApiKey)
				.onChange(async (value) => {
					plugin.settings.braveSearchApiKey = value;
					plugin.webService.updateConfig(
						plugin.settings.webSearchMaxResults,
						plugin.settings.webSearchEnabled,
						undefined,
						value,
					);
					await plugin.saveSettings();
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
	if (plugin.settings.webSearchEngine !== "brave") {
		braveKeySetting.settingEl.classList.add("hidden");
	}

	new Setting(containerEl)
		.setName("最大搜索结果数")
		.setDesc("每次搜索返回的最大结果数量")
		.addText((text) =>
			text
				.setPlaceholder("5")
				.setValue(String(plugin.settings.webSearchMaxResults))
				.onChange(async (value) => {
					const num = parseInt(value, 10);
					if (!isNaN(num) && num > 0 && num <= 20) {
						plugin.settings.webSearchMaxResults = num;
						plugin.webService.updateConfig(
							num,
							plugin.settings.webSearchEnabled,
						);
						await plugin.saveSettings();
					}
				}),
		);
}
