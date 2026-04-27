import { App, MarkdownView, Notice, TFile, normalizePath } from "obsidian";

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

export async function applyModification(
	file: TFile,
	newContent: string,
): Promise<void> {
	await file.vault.modify(file, newContent);
}

export async function createNewNote(app: App, content: string): Promise<TFile | null> {
	const lines = content.split("\n");
	const firstLine = (lines[0] ?? "").replace(/[#*\[\]]/g, "").trim().slice(0, 30) || "新笔记";
	const timestamp = Date.now().toString(36).slice(-4);
	const filename = normalizePath(`${firstLine}-${timestamp}.md`);

	let file: TFile | null = null;
	try {
		file = await app.vault.create(filename, content);
	} catch {
		file = null;
	}
	if (!file) {
		try {
			file = await app.vault.create(`未命名笔记-${Date.now()}.md`, content);
		} catch {
			new Notice("创建笔记失败");
			return null;
		}
	}

	await app.workspace.openLinkText(file.basename, file.parent?.path ?? "");
	return file;
}


