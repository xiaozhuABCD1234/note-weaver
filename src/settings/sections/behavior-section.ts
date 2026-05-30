import { Setting } from "obsidian";
import NoteWeaver from "@/main";

export function renderBehaviorSection(containerEl: HTMLElement, plugin: NoteWeaver): void {
	new Setting(containerEl).setName("模型行为").setHeading();

	const effortSetting = new Setting(containerEl);

	new Setting(containerEl)
		.setName("启用思考模式")
		.setDesc("开启后模型会先进行内部推理再输出答案（仅 DeepSeek 等部分模型支持）")
		.addToggle((toggle) =>
			toggle
				.setValue(plugin.settings.thinkingMode)
				.onChange(async (value) => {
					plugin.settings.thinkingMode = value;
					effortSetting.setDisabled(!value);
					await plugin.saveSettings();
				}),
		);

	effortSetting
		.setName("思考强度")
		.setDesc("控制模型推理的深度，high 适合常规任务，max 适合复杂任务")
		.addDropdown((dropdown) =>
			dropdown
				.addOption("high", "High")
				.addOption("max", "Max")
				.setValue(plugin.settings.reasoningEffort)
				.onChange(async (value: string) => {
					plugin.settings.reasoningEffort = value as "high" | "max";
					await plugin.saveSettings();
				}),
		);
	effortSetting.setDisabled(!plugin.settings.thinkingMode);
}
