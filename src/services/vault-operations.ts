import { App, TFile, TFolder, normalizePath } from "obsidian";

export interface VaultFileEntry {
	path: string;
	basename: string;
	extension: string;
}

export interface VaultFolderEntry {
	path: string;
	name: string;
}

export interface VaultListing {
	files: VaultFileEntry[];
	folders: VaultFolderEntry[];
}

export class VaultOperations {
	constructor(private app: App) {}

	readNote(path: string): Promise<string> {
		return this.app.vault.read(this.getFile(path));
	}

	async writeNote(path: string, content: string): Promise<string> {
		const normalizedPath = normalizePath(path);
		const existing = this.app.vault.getAbstractFileByPath(normalizedPath);
		if (existing instanceof TFile) {
			await this.app.vault.modify(existing, content);
			return `Updated: ${normalizedPath}`;
		}
		const parentPath = normalizedPath.contains("/")
			? normalizedPath.split("/").slice(0, -1).join("/")
			: "";
		if (parentPath) {
			await this.ensureFolder(parentPath);
		}
		await this.app.vault.create(normalizedPath, content);
		return `Created: ${normalizedPath}`;
	}

	async appendNote(path: string, content: string): Promise<string> {
		const file = this.getFile(path);
		await this.app.vault.append(file, content);
		return `Appended to: ${path}`;
	}

	async deleteNote(path: string): Promise<string> {
		const normalized = normalizePath(path);
		const abstractFile = this.app.vault.getAbstractFileByPath(normalized);
		if (!abstractFile) {
			throw new Error(`文件或文件夹不存在: ${path}`);
		}
		await this.app.fileManager.trashFile(abstractFile);
		const type = abstractFile instanceof TFolder ? "文件夹" : "笔记";
		return `${type}已删除: ${normalized}`;
	}

	async renameNote(path: string, newPath: string): Promise<string> {
		const file = this.getFile(path);
		await this.app.fileManager.renameFile(file, normalizePath(newPath));
		return `Renamed: ${path} → ${newPath}`;
	}

	async ensureFolder(path: string): Promise<void> {
		const normalized = normalizePath(path);
		if (!this.app.vault.getAbstractFileByPath(normalized)) {
			await this.app.vault.createFolder(normalized);
		}
	}

	async editNote(path: string, oldSnippet: string, newSnippet: string): Promise<string> {
		const file = this.getFile(path);
		const content = await this.app.vault.read(file);

		const idx = content.indexOf(oldSnippet);
		if (idx === -1) {
			throw new Error(`在笔记中未找到匹配的文本: "${oldSnippet.slice(0, 50)}..."`);
		}

		const newContent = content.slice(0, idx) + newSnippet + content.slice(idx + oldSnippet.length);

		const contextBefore = content.slice(Math.max(0, idx - 80), idx);
		const contextAfter = content.slice(idx + oldSnippet.length, idx + oldSnippet.length + 80);

		await this.app.vault.modify(file, newContent);

		return [
			`编辑完成: ${path}`,
			"",
			"替换详情：",
			`查找: "${oldSnippet.slice(0, 100)}${oldSnippet.length > 100 ? "..." : ""}"`,
			`替换为: "${newSnippet.slice(0, 100)}${newSnippet.length > 100 ? "..." : ""}"`,
			"",
			`替换位置上下文: ...${contextBefore}│${contextAfter}...`,
		].join("\n");
	}

	async getMetadata(path: string): Promise<Record<string, unknown>> {
		const file = this.getFile(path);
		const content = await this.app.vault.read(file);
		const stat = await this.app.vault.adapter.stat(file.path);
		const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter;

		return {
			path: file.path,
			basename: file.basename,
			extension: file.extension,
			size: stat?.size ?? 0,
			created: stat?.ctime ? new Date(stat.ctime).toISOString() : null,
			modified: stat?.mtime ? new Date(stat.mtime).toISOString() : null,
			tags: frontmatter?.tags ?? [],
			frontmatter: frontmatter ?? {},
			contentLength: content.length,
			parent: file.parent?.path ?? "/",
		};
	}

	searchFiles(query: string): VaultFileEntry[] {
		const q = query.toLowerCase();
		return this.app.vault.getFiles()
			.filter(f => f.path.toLowerCase().includes(q) || f.basename.toLowerCase().includes(q))
			.map(f => ({ path: f.path, basename: f.basename, extension: f.extension }));
	}

	async searchContent(query: string): Promise<Array<{ path: string; snippet: string }>> {
		const files = this.app.vault.getMarkdownFiles();
		const contents = await Promise.all(files.map(f => this.app.vault.cachedRead(f)));
		const q = query.toLowerCase();
		const results: Array<{ path: string; snippet: string }> = [];
		for (let i = 0; i < files.length; i++) {
			const content = contents[i];
			if (!content) continue;
			const idx = content.toLowerCase().indexOf(q);
			if (idx !== -1) {
				const start = Math.max(0, idx - 100);
				const end = Math.min(content.length, idx + query.length + 100);
				results.push({ path: files[i]!.path, snippet: content.slice(start, end) });
			}
		}
		return results;
	}

	async grepContent(
		pattern: string,
		caseSensitive = false,
		maxResults = 50,
	): Promise<Array<{ path: string; line: number; content: string }>> {
		const regex = new RegExp(pattern, caseSensitive ? "gm" : "gim");
		const files = this.app.vault.getMarkdownFiles();
		const results: Array<{ path: string; line: number; content: string }> = [];

		for (const file of files) {
			if (results.length >= maxResults) break;
			const content = await this.app.vault.cachedRead(file);
			const lines = content.split("\n");
			for (let i = 0; i < lines.length; i++) {
				if (results.length >= maxResults) break;
				if (regex.test(lines[i]!)) {
					results.push({ path: file.path, line: i + 1, content: lines[i]!.trim() });
					regex.lastIndex = 0;
				}
			}
		}
		return results;
	}

	listFolder(path?: string): VaultListing {
		const folder = path
			? this.app.vault.getAbstractFileByPath(normalizePath(path))
			: this.app.vault.getRoot();
		if (!(folder instanceof TFolder)) {
			throw new Error(`Not a folder: ${path}`);
		}
		const files: VaultFileEntry[] = [];
		const folders: VaultFolderEntry[] = [];
		for (const child of folder.children) {
			if (child instanceof TFile) {
				files.push({ path: child.path, basename: child.basename, extension: child.extension });
			} else if (child instanceof TFolder) {
				folders.push({ path: child.path, name: child.name });
			}
		}
		return { files, folders };
	}

	listRecentNotes(limit = 10): Array<{ path: string; basename: string; modified: string }> {
		return this.app.vault.getFiles()
			.sort((a, b) => (b.stat.mtime ?? 0) - (a.stat.mtime ?? 0))
			.slice(0, Math.max(1, Math.min(limit, 100)))
			.map(f => ({
				path: f.path,
				basename: f.basename,
				modified: new Date(f.stat.mtime).toISOString(),
			}));
	}

	private getFile(path: string): TFile {
		const normalized = normalizePath(path);
		const file = this.app.vault.getAbstractFileByPath(normalized);
		if (!(file instanceof TFile)) {
			throw new Error(`File not found: ${path}`);
		}
		return file;
	}
}
