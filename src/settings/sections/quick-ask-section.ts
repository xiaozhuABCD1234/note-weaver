import { Setting } from "obsidian";
import NoteWeaver from "@/main";

export function renderQuickAskSection(containerEl: HTMLElement, plugin: NoteWeaver): void {
	new Setting(containerEl).setName("Quick ask").setHeading();

	new Setting(containerEl)
		.setName("启用")
		.setDesc("在编辑器中输入 @ 触发内联 AI 问答面板")
		.addToggle((toggle) =>
			toggle
				.setValue(plugin.settings.quickAsk.enabled)
				.onChange(async (value) => {
					plugin.settings.quickAsk.enabled = value;
					await plugin.saveSettings();
				}),
		);
}
