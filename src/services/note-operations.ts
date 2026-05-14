import { App, MarkdownView, TFile } from "obsidian";

export interface NoteContext {
	file: TFile;
	content: string;
}

export function getActiveNoteContext(app: App): NoteContext | null {
	const view = getActiveMarkdownView(app);
	if (!view || !view.file) return null;
	return {
		file: view.file,
		content: view.editor.getValue(),
	};
}

export function getSelectedText(app: App): string | null {
	const view = getActiveMarkdownView(app);
	if (!view) return null;
	const selection = view.editor.getSelection();
	return selection || null;
}

export function getActiveMarkdownView(app: App): MarkdownView | null {
	return app.workspace.getActiveViewOfType(MarkdownView) ?? null;
}
