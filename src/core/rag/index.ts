import { App, TFile, TFolder } from "obsidian";
import { RagConfig, RelatedNote } from "./types";
import { getForwardLinks, getBacklinks } from "./link-traversal";
import { getNotesByTags } from "./tag-matching";
import { keywordSearch } from "./keyword-search";

export type { RagConfig } from "./types";

export const DEFAULT_RAG_CONFIG: RagConfig = {
	enabled: true,
	maxRelatedNotes: 5,
	scope: "current-folder",
	includeForwardLinks: true,
	includeBacklinks: true,
	includeTagMatches: true,
	linkDepth: 2,
};

export class RagEngine {
	private app: App;
	private config: RagConfig;
	private getKbPath: () => string;

	constructor(app: App, config: RagConfig, getKbPath?: () => string) {
		this.app = app;
		this.config = config;
		this.getKbPath = getKbPath ?? (() => "");
	}

	updateConfig(config: Partial<RagConfig>): void {
		this.config = { ...this.config, ...config };
	}

	getConfig(): RagConfig {
		return { ...this.config };
	}

	async getContextForQuery(query: string): Promise<string> {
		if (!this.config.enabled) return "";

		const currentFile = this.app.workspace.getActiveFile();
		if (!currentFile) return "";

		const related = await this.collectRelatedNotes(currentFile, query);
		if (related.length === 0) return "";

		const parts: string[] = [];
		parts.push("## 联想笔记\n");

		for (const note of related) {
			const content = await this.readNoteContent(note.path);
			if (!content) continue;
			parts.push(`相关笔记: ${note.path}（${note.reason}）`);
			parts.push("完整内容：");
			parts.push("```markdown");
			parts.push(content);
			parts.push("```\n");
		}

		return parts.join("\n");
	}

	private async collectRelatedNotes(
		currentFile: TFile,
		query: string,
	): Promise<RelatedNote[]> {
		const seen = new Map<string, { reason: string; score: number }>();

		if (this.config.includeForwardLinks) {
			const forwardLinks = getForwardLinks(this.app, currentFile, this.config.linkDepth);
			for (const [path, depth] of forwardLinks) {
				if (!seen.has(path)) {
					seen.set(path, {
						reason: `正向链接（第${depth}层）`,
						score: 100 - depth,
					});
				}
			}
		}

		if (this.config.includeBacklinks) {
			const backlinks = getBacklinks(this.app, currentFile);
			for (const [path] of backlinks) {
				if (!seen.has(path)) {
					seen.set(path, { reason: "反向链接", score: 80 });
				}
			}
		}

		if (this.config.includeTagMatches) {
			const tagMatches = getNotesByTags(this.app, currentFile);
			for (const [path, tags] of tagMatches) {
				if (!seen.has(path)) {
					seen.set(path, {
						reason: `标签匹配（${tags}）`,
						score: 60,
					});
				}
			}
		}

		if (query.trim() && seen.size < this.config.maxRelatedNotes) {
			const matches = await keywordSearch(this.app, query);
			for (const [path, count] of matches) {
				if (!seen.has(path)) {
					seen.set(path, {
						reason: "关键词匹配",
						score: 40 + Math.min(count, 10),
					});
				}
			}
		}

		let results = Array.from(seen.entries()).map(([path, info]) => ({
			path,
			reason: info.reason,
			score: info.score,
		}));

		if (this.config.scope === "current-folder") {
			const folderPath = this.getCurrentFolderPath();
			if (folderPath) {
				results = results.filter(
					(r) =>
						r.path === folderPath || r.path.startsWith(folderPath + "/"),
				);
			}
		}

		const kbPath = this.getKbPath();
		if (kbPath) {
			for (const r of results) {
				if (r.path.startsWith(kbPath + "/") || r.path === kbPath) {
					r.score += 30;
				}
			}
		}

		results.sort((a, b) => b.score - a.score);
		return results.slice(0, this.config.maxRelatedNotes);
	}

	private async readNoteContent(path: string): Promise<string | null> {
		const file = this.app.vault.getAbstractFileByPath(path);
		if (!(file instanceof TFile)) return null;
		try {
			return await this.app.vault.cachedRead(file);
		} catch {
			return null;
		}
	}

	private getCurrentFolderPath(): string | null {
		const activeFile = this.app.workspace.getActiveFile();
		if (!activeFile) return null;
		return activeFile.parent?.path ?? null;
	}

	async getNoteByPath(path: string): Promise<{
		content: string;
		filePath: string;
		fileName: string;
	} | null> {
		const file = this.app.vault.getFileByPath(path);
		if (!file) return null;
		try {
			const content = await this.app.vault.cachedRead(file);
			return { content, filePath: file.path, fileName: file.basename };
		} catch {
			return null;
		}
	}

	async getNotesByPaths(
		paths: string[],
	): Promise<{ content: string; filePath: string; fileName: string }[]> {
		const results: {
			content: string;
			filePath: string;
			fileName: string;
		}[] = [];
		for (const p of paths) {
			const note = await this.getNoteByPath(p);
			if (note) results.push(note);
		}
		return results;
	}

	async searchNotes(
		query: string,
	): Promise<{ file: TFile; snippet: string; score: number }[]> {
		const currentFile = this.app.workspace.getActiveFile();
		if (!currentFile) return [];

		const related = await this.collectRelatedNotes(currentFile, query);
		const result: { file: TFile; snippet: string; score: number }[] = [];

		for (const r of related) {
			const file = this.app.vault.getFileByPath(r.path);
			if (!file) continue;
			try {
				const content = await this.app.vault.cachedRead(file);
				result.push({
					file,
					snippet: content.slice(0, 200),
					score: r.score,
				});
			} catch {
				continue;
			}
		}

		return result.sort((a, b) => b.score - a.score);
	}

	listNotesInDir(dirPath: string): TFile[] {
		const folder = this.app.vault.getAbstractFileByPath(dirPath);
		if (!folder || !(folder instanceof TFolder)) return [];

		const files: TFile[] = [];
		for (const child of folder.children) {
			if (child instanceof TFile && child.extension === "md") {
				files.push(child);
			}
		}
		return files.sort((a, b) => a.name.localeCompare(b.name));
	}
}
