import { App, TFile, TFolder, normalizePath } from "obsidian";

export type KnowledgeNoteType = "concept" | "relationship" | "summary" | "note";

export interface SaveKnowledgeParams {
	title: string;
	content: string;
	type: KnowledgeNoteType;
	tags: string[];
	relatedNotes: string[];
}

export class KnowledgeService {
	constructor(
		private app: App,
		private getKbPath: () => string,
	) {}

	async saveKnowledge(params: SaveKnowledgeParams): Promise<string> {
		const fileName = this.normalizeTitle(params.title);
		const folder = await this.ensureFolder();
		const filePath = normalizePath(`${folder.path}/${fileName}.md`);

		const existing = this.app.vault.getAbstractFileByPath(filePath);
		const existingFile = existing instanceof TFile ? existing : null;

		const frontmatter: Record<string, unknown> = {
			type: params.type,
			tags: params.tags,
		};
		const now = new Date().toISOString().split("T")[0];

		const relatedSection =
			params.relatedNotes.length > 0
				? this.buildRelatedSection(params.relatedNotes)
				: "";

		const fmLines: string[] = ["---"];
		for (const [k, v] of Object.entries(frontmatter)) {
			if (Array.isArray(v)) {
				fmLines.push(`${k}:`);
				for (const item of v) {
					fmLines.push(`  - ${item}`);
				}
			} else {
				fmLines.push(`${k}: ${String(v)}`);
			}
		}
		if (!existingFile) {
			fmLines.push(`created: ${now}`);
		}
		fmLines.push("---");

		const body = [
			...fmLines,
			"",
			`# ${params.title}`,
			"",
			params.content,
			relatedSection,
		].join("\n");

		if (existingFile) {
			await this.app.vault.modify(existingFile, body);
		} else {
			await this.app.vault.create(filePath, body);
		}

		return filePath;
	}

	async findExistingEntity(name: string): Promise<TFile | null> {
		const folder = await this.ensureFolder();
		const fileName = this.normalizeTitle(name);
		const filePath = normalizePath(`${folder.path}/${fileName}.md`);
		const file = this.app.vault.getAbstractFileByPath(filePath);
		return file instanceof TFile ? file : null;
	}

	async listKnowledgeNotes(): Promise<TFile[]> {
		const folder = await this.ensureFolder();
		const files: TFile[] = [];
		for (const child of folder.children) {
			if (child instanceof TFile && child.extension === "md") {
				files.push(child);
			}
		}
		return files.sort((a, b) => a.name.localeCompare(b.name));
	}

	private async ensureFolder(): Promise<TFolder> {
		const path = normalizePath(this.getKbPath());
		let folder = this.app.vault.getAbstractFileByPath(path);
		if (folder instanceof TFolder) return folder;
		await this.app.vault.createFolder(path);
		folder = this.app.vault.getAbstractFileByPath(path);
		if (!(folder instanceof TFolder)) {
			throw new Error(`Failed to create knowledge base folder: ${path}`);
		}
		return folder;
	}

	private normalizeTitle(title: string): string {
		return title
			.replace(/[/\\?%*:|"<>]/g, "-")
			.replace(/\s+/g, " ")
			.trim()
			.slice(0, 200);
	}

	private buildRelatedSection(relatedNotes: string[]): string {
		const lines: string[] = ["", "## 关联笔记", ""];
		for (const notePath of relatedNotes) {
			const note = this.app.vault.getAbstractFileByPath(notePath);
			if (note instanceof TFile) {
				lines.push(`- [[${note.basename}]]`);
			} else {
				lines.push(`- ${notePath}`);
			}
		}
		return lines.join("\n");
	}
}
