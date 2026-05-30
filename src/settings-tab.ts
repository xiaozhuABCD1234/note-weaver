import { App, PluginSettingTab } from "obsidian";
import NoteWeaver from "@/main";
import { renderApiSection } from "./settings/sections/api-section";
import { renderBehaviorSection } from "./settings/sections/behavior-section";
import { renderRagSection } from "./settings/sections/rag-section";
import { renderWebSearchSection } from "./settings/sections/web-search-section";
import { renderQuickAskSection } from "./settings/sections/quick-ask-section";

export class NoteWeaverSettingTab extends PluginSettingTab {
	plugin: NoteWeaver;

	constructor(app: App, plugin: NoteWeaver) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		renderApiSection(containerEl, this.plugin);
		renderBehaviorSection(containerEl, this.plugin);
		renderRagSection(containerEl, this.plugin);
		renderWebSearchSection(containerEl, this.plugin);
		renderQuickAskSection(containerEl, this.plugin);
	}
}
