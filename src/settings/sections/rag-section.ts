import { Setting } from "obsidian";
import NoteWeaver from "@/main";
import type { FileScope } from "@/core/rag/types";

export function renderRagSection(containerEl: HTMLElement, plugin: NoteWeaver): void {
	new Setting(containerEl).setName("联想笔记").setHeading();

	new Setting(containerEl)
		.setName("启用")
		.setDesc("开启后 AI 助手会自动查找与当前笔记相关的其他笔记作为上下文")
		.addToggle((toggle) =>
			toggle
				.setValue(plugin.settings.rag.enabled)
				.onChange(async (value) => {
					plugin.settings.rag.enabled = value;
					await plugin.saveSettings();
				}),
		);

	new Setting(containerEl)
		.setName("最大联想笔记数")
		.setDesc("每次查询最多关联多少篇笔记")
		.addText((text) =>
			text
				.setPlaceholder("5")
				.setValue(String(plugin.settings.rag.maxRelatedNotes))
				.onChange(async (value) => {
					const num = parseInt(value, 10);
					if (!isNaN(num) && num >= 1 && num <= 20) {
						plugin.settings.rag.maxRelatedNotes = num;
						await plugin.saveSettings();
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
				.setValue(plugin.settings.rag.scope)
				.onChange(async (value: string) => {
					plugin.settings.rag.scope = value as FileScope;
					await plugin.saveSettings();
				}),
		);

	new Setting(containerEl)
		.setName("正向链接")
		.setDesc("包含当前笔记通过 [[wikilink]] 链接到的笔记")
		.addToggle((toggle) =>
			toggle
				.setValue(plugin.settings.rag.includeForwardLinks)
				.onChange(async (value) => {
					plugin.settings.rag.includeForwardLinks = value;
					await plugin.saveSettings();
				}),
		);

	new Setting(containerEl)
		.setName("反向链接")
		.setDesc("包含链接到当前笔记的笔记")
		.addToggle((toggle) =>
			toggle
				.setValue(plugin.settings.rag.includeBacklinks)
				.onChange(async (value) => {
					plugin.settings.rag.includeBacklinks = value;
					await plugin.saveSettings();
				}),
		);

	new Setting(containerEl)
		.setName("标签匹配")
		.setDesc("包含与当前笔记有相同标签的笔记")
		.addToggle((toggle) =>
			toggle
				.setValue(plugin.settings.rag.includeTagMatches)
				.onChange(async (value) => {
					plugin.settings.rag.includeTagMatches = value;
					await plugin.saveSettings();
				}),
		);

	new Setting(containerEl)
		.setName("链接深度")
		.setDesc("正向链接的遍历层数：1 层（仅直接链接）或 2 层（也包含链接的链接）")
		.addDropdown((dropdown) =>
			dropdown
				.addOption("1", "1 层")
				.addOption("2", "2 层")
				.setValue(String(plugin.settings.rag.linkDepth))
				.onChange(async (value: string) => {
					plugin.settings.rag.linkDepth = parseInt(value, 10);
					await plugin.saveSettings();
				}),
		);
}
