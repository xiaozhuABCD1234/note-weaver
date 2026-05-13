import { App, TFile, TFolder, normalizePath } from "obsidian";
import { AgentLogger } from "./core/logger/index";
import type { ToolCall, ToolResultMessage } from "./api";

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

export class VaultService {
	lastWritePath: string | null = null;
	lastWriteContent: string | null = null;
	private logger: AgentLogger;

	constructor(private app: App, logger: AgentLogger) {
		this.logger = logger;
	}

	async readNote(path: string): Promise<string> {
		return await this.app.vault.read(this.getFile(path));
	}

	async writeNote(path: string, content: string): Promise<string> {
		const normalizedPath = normalizePath(path);
		const existing = this.app.vault.getAbstractFileByPath(normalizedPath);
		if (existing instanceof TFile) {
			await this.app.vault.modify(existing, content);
			this.lastWritePath = normalizedPath;
			this.lastWriteContent = content;
			return `Updated: ${normalizedPath}`;
		}
		const parentPath = normalizedPath.contains("/")
			? normalizedPath.split("/").slice(0, -1).join("/")
			: "";
		if (parentPath) {
			await this.ensureFolder(parentPath);
		}
		await this.app.vault.create(normalizedPath, content);
		this.lastWritePath = normalizedPath;
		this.lastWriteContent = content;
		return `Created: ${normalizedPath}`;
	}

	async appendNote(path: string, content: string): Promise<string> {
		const file = this.getFile(path);
		await this.app.vault.append(file, content);
		this.lastWritePath = path;
		this.lastWriteContent = content;
		return `Appended to: ${path}`;
	}

	async deleteNote(path: string): Promise<string> {
		const file = this.getFile(path);
		await this.app.fileManager.trashFile(file);
		return `Deleted: ${path}`;
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

	async executeToolCall(call: ToolCall): Promise<string> {
		const args = JSON.parse(call.function.arguments) as Record<string, unknown>;
		try {
			let result: string;
			switch (call.function.name) {
				case "read_note":
					result = await this.readNote(args.path as string);
					break;
				case "write_note":
					result = await this.writeNote(args.path as string, args.content as string);
					break;
				case "append_note":
					result = await this.appendNote(args.path as string, args.content as string);
					break;
				case "delete_note":
					result = await this.deleteNote(args.path as string);
					break;
				case "rename_note":
					result = await this.renameNote(args.path as string, args.newPath as string);
					break;
				case "search_notes":
					result = JSON.stringify(this.searchFiles(args.query as string));
					break;
				case "search_content":
					result = JSON.stringify(await this.searchContent(args.query as string));
					break;
				case "list_folder":
					result = JSON.stringify(this.listFolder(args.path as string | undefined));
					break;
				default:
					throw new Error(`Unknown tool: ${call.function.name}`);
			}

			this.logger.log({
				level: "info",
				type: "tool",
				message: `工具执行: ${call.function.name}`,
				data: { arguments: args, resultLength: result.length },
			});

			return result;
		} catch (e) {
			const errMsg = `Error: ${e instanceof Error ? e.message : String(e)}`;
			this.logger.log({
				level: "error",
				type: "tool",
				message: `工具执行失败: ${call.function.name}`,
				data: { arguments: args, error: errMsg },
			});
			return errMsg;
		}
	}

	async executeToolCalls(calls: ToolCall[]): Promise<ToolResultMessage[]> {
		const results: ToolResultMessage[] = [];
		for (const call of calls) {
			const content = await this.executeToolCall(call);
			results.push({ role: "tool", tool_call_id: call.id, content });
		}
		return results;
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

export function getToolDefinitions() {
	return [
		{
			type: "function" as const,
			function: {
				name: "read_note",
				description: "Read the full content of a note from the vault by its path (e.g., 'folder/note.md')",
				parameters: {
					type: "object",
					properties: {
						path: { type: "string", description: "Vault path to the note" },
					},
					required: ["path"],
				},
			},
		},
		{
			type: "function" as const,
			function: {
				name: "write_note",
				description: "Create a new note or overwrite an existing one in the vault",
				parameters: {
					type: "object",
					properties: {
						path: { type: "string", description: "Vault path for the note (e.g., 'folder/note.md')" },
						content: { type: "string", description: "Full content of the note (markdown)" },
					},
					required: ["path", "content"],
				},
			},
		},
		{
			type: "function" as const,
			function: {
				name: "append_note",
				description: "Append content to the end of an existing note",
				parameters: {
					type: "object",
					properties: {
						path: { type: "string", description: "Vault path to the note" },
						content: { type: "string", description: "Content to append" },
					},
					required: ["path", "content"],
				},
			},
		},
		{
			type: "function" as const,
			function: {
				name: "delete_note",
				description: "Delete a note from the vault permanently",
				parameters: {
					type: "object",
					properties: {
						path: { type: "string", description: "Vault path to the note to delete" },
					},
					required: ["path"],
				},
			},
		},
		{
			type: "function" as const,
			function: {
				name: "rename_note",
				description: "Rename or move a note to a new path. Internal links are automatically updated.",
				parameters: {
					type: "object",
					properties: {
						path: { type: "string", description: "Current vault path of the note" },
						newPath: { type: "string", description: "New vault path for the note" },
					},
					required: ["path", "newPath"],
				},
			},
		},
		{
			type: "function" as const,
			function: {
				name: "search_notes",
				description: "Search for notes by filename or path. Returns matching files with their paths.",
				parameters: {
					type: "object",
					properties: {
						query: { type: "string", description: "Search query (e.g., keyword or phrase)" },
					},
					required: ["query"],
				},
			},
		},
		{
			type: "function" as const,
			function: {
				name: "search_content",
				description: "Search for specific text within all markdown notes in the vault. Returns matching file paths with surrounding context (snippet).",
				parameters: {
					type: "object",
					properties: {
						query: { type: "string", description: "Text to search for within note contents" },
					},
					required: ["query"],
				},
			},
		},
		{
			type: "function" as const,
			function: {
				name: "list_folder",
				description: "List all files and subfolders in a vault directory. Useful for browsing vault structure.",
				parameters: {
					type: "object",
					properties: {
						path: { type: "string", description: "Folder path relative to vault root (leave empty for root)" },
					},
					required: [],
				},
			},
		},
	];
}
