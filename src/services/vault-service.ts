import { App, TFile, TFolder, normalizePath } from "obsidian";
import { AgentLogger } from "@/core/logger/index";
import type { ToolCall, ToolResultMessage, ToolDefinition } from "@/types";
import type { ToolGateway, ToolHandler, ToolResult } from "@/core/agent";
import { WebService } from "./web-service";
import { SubAgentService } from "./sub-agent-service";

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
	private logger: AgentLogger;
	private webService: WebService;
	private subAgentService: SubAgentService;

	constructor(
		private app: App,
		logger: AgentLogger,
		webService: WebService,
		subAgentService: SubAgentService,
	) {
		this.logger = logger;
		this.webService = webService;
		this.subAgentService = subAgentService;
	}

	registerTools(gateway: ToolGateway): void {
		gateway.registerMany([
			{
				name: "read_note",
				handler: this.makeHandler((args) => this.readNote(args.path as string)),
				definition: {
					type: "function",
					function: {
						name: "read_note",
						description: "读取 vault 中指定路径的笔记完整内容",
						parameters: {
							type: "object",
							properties: {
								path: { type: "string", description: "笔记路径，相对于 vault 根目录" },
							},
							required: ["path"],
						},
					},
				},
			},
			{
				name: "search_notes",
				handler: this.makeHandler((args) => JSON.stringify(this.searchFiles(args.query as string))),
				definition: {
					type: "function",
					function: {
						name: "search_notes",
						description: "按文件名或路径搜索 vault 中的笔记，返回匹配的文件路径列表",
						parameters: {
							type: "object",
							properties: {
								query: { type: "string", description: "搜索关键词，匹配文件名和路径" },
							},
							required: ["query"],
						},
					},
				},
			},
			{
				name: "search_content",
				handler: this.makeHandler(async (args) =>
					JSON.stringify(await this.searchContent(args.query as string)),
				),
				definition: {
					type: "function",
					function: {
						name: "search_content",
						description: "在所有 Markdown 笔记中搜索文本内容，返回匹配的文件路径及周围上下文片段",
						parameters: {
							type: "object",
							properties: {
								query: { type: "string", description: "要搜索的文本内容关键词" },
							},
							required: ["query"],
						},
					},
				},
			},
			{
				name: "list_folder",
				handler: this.makeHandler((args) =>
					JSON.stringify(this.listFolder(args.path as string | undefined)),
				),
				definition: {
					type: "function",
					function: {
						name: "list_folder",
						description: "列出 vault 中指定文件夹内的文件和子文件夹",
						parameters: {
							type: "object",
							properties: {
								path: { type: "string", description: "文件夹路径，相对于 vault 根目录。留空则列出根目录" },
							},
							required: [],
						},
					},
				},
			},
			{
				name: "write_note",
				handler: this.makeHandler(async (args) =>
					this.writeNote(args.path as string, args.content as string),
				),
				definition: {
					type: "function",
					function: {
						name: "write_note",
						description: "创建新笔记或覆盖已有笔记",
						parameters: {
							type: "object",
							properties: {
								path: { type: "string", description: "笔记路径，相对于 vault 根目录" },
								content: { type: "string", description: "笔记完整内容，使用 Markdown 格式" },
							},
							required: ["path", "content"],
						},
					},
				},
			},
			{
				name: "append_note",
				handler: this.makeHandler(async (args) =>
					this.appendNote(args.path as string, args.content as string),
				),
				definition: {
					type: "function",
					function: {
						name: "append_note",
						description: "向已有笔记末尾追加内容",
						parameters: {
							type: "object",
							properties: {
								path: { type: "string", description: "笔记路径" },
								content: { type: "string", description: "要追加的内容" },
							},
							required: ["path", "content"],
						},
					},
				},
			},
			{
				name: "delete_note",
				handler: this.makeHandler(async (args) =>
					this.deleteNote(args.path as string),
				),
				definition: {
					type: "function",
					function: {
						name: "delete_note",
						description: "永久删除 vault 中的笔记。注意：此操作不可逆，建议先与用户确认再执行",
						parameters: {
							type: "object",
							properties: {
								path: { type: "string", description: "要删除的笔记路径" },
							},
							required: ["path"],
						},
					},
				},
			},
			{
				name: "rename_note",
				handler: this.makeHandler(async (args) =>
					this.renameNote(args.path as string, args.newPath as string),
				),
				definition: {
					type: "function",
					function: {
						name: "rename_note",
						description: "重命名或移动笔记到新路径。会自动更新 vault 中所有指向该笔记的内部链接",
						parameters: {
							type: "object",
							properties: {
								path: { type: "string", description: "笔记当前路径" },
								newPath: { type: "string", description: "笔记新路径，可用于重命名或移动到不同文件夹" },
							},
							required: ["path", "newPath"],
						},
					},
				},
			},
			{
				name: "web_search",
				handler: this.makeHandler(async (args) =>
					JSON.stringify(await this.webService.search(args.query as string)),
				),
				definition: {
					type: "function",
					function: {
						name: "web_search",
						description: "通过 DuckDuckGo 搜索互联网获取实时信息",
						parameters: {
							type: "object",
							properties: {
								query: { type: "string", description: "搜索关键词" },
							},
							required: ["query"],
						},
					},
				},
			},
			{
				name: "fetch_webpage",
				handler: this.makeHandler(async (args) =>
					this.webService.fetchPage(args.url as string),
				),
				definition: {
					type: "function",
					function: {
						name: "fetch_webpage",
						description: "抓取指定 URL 网页的可读文本内容",
						parameters: {
							type: "object",
							properties: {
								url: { type: "string", description: "完整的网页 URL" },
							},
							required: ["url"],
						},
					},
				},
			},
			{
				name: "delegate_task",
				handler: this.makeHandler(async (args) =>
					this.subAgentService.runSubAgent(args.prompt as string),
				),
				definition: {
					type: "function",
					function: {
						name: "delegate_task",
						description: "将需要大量信息收集、调研或分析的复杂任务委派给子 Agent 执行",
						parameters: {
							type: "object",
							properties: {
								prompt: { type: "string", description: "子 Agent 需要完成的任务描述" },
							},
							required: ["prompt"],
						},
					},
				},
			},
		]);
	}

	private makeHandler(fn: (args: Record<string, unknown>) => Promise<string> | string): ToolHandler {
		return async (rawArgs: unknown) => {
			const args = rawArgs as Record<string, unknown>;
			try {
				const content = await fn(args);
				return { content } as ToolResult;
			} catch (e) {
				const errMsg = `Error: ${e instanceof Error ? e.message : String(e)}`;
				this.logger.log({
					level: "error",
					type: "tool",
					message: `工具执行失败`,
					data: { arguments: args, error: errMsg },
				});
				return { content: errMsg, isError: true } as ToolResult;
			}
		};
	}

	async readNote(path: string): Promise<string> {
		return await this.app.vault.read(this.getFile(path));
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

	private getFile(path: string): TFile {
		const normalized = normalizePath(path);
		const file = this.app.vault.getAbstractFileByPath(normalized);
		if (!(file instanceof TFile)) {
			throw new Error(`File not found: ${path}`);
		}
		return file;
	}

	async executeToolCalls(calls: ToolCall[]): Promise<ToolResultMessage[]> {
		const results: ToolResultMessage[] = [];
		for (const call of calls) {
			let args: Record<string, unknown>;
			try {
				args = JSON.parse(call.function.arguments) as Record<string, unknown>;
			} catch {
				results.push({ role: "tool", tool_call_id: call.id, content: `Error: Invalid JSON arguments` });
				continue;
			}
			try {
				let content: string;
				switch (call.function.name) {
					case "read_note": content = await this.readNote(args.path as string); break;
					case "write_note": content = await this.writeNote(args.path as string, args.content as string); break;
					case "append_note": content = await this.appendNote(args.path as string, args.content as string); break;
					case "delete_note": content = await this.deleteNote(args.path as string); break;
					case "rename_note": content = await this.renameNote(args.path as string, args.newPath as string); break;
					case "search_notes": content = JSON.stringify(this.searchFiles(args.query as string)); break;
					case "search_content": content = JSON.stringify(await this.searchContent(args.query as string)); break;
					case "list_folder": content = JSON.stringify(this.listFolder(args.path as string | undefined)); break;
					case "web_search": content = JSON.stringify(await this.webService.search(args.query as string)); break;
					case "fetch_webpage": content = await this.webService.fetchPage(args.url as string); break;
					case "delegate_task": content = await this.subAgentService.runSubAgent(args.prompt as string); break;
					default: throw new Error(`Unknown tool: ${call.function.name}`);
				}
				results.push({ role: "tool", tool_call_id: call.id, content });
			} catch (e) {
				const errMsg = `Error: ${e instanceof Error ? e.message : String(e)}`;
				this.logger.log({
					level: "error",
					type: "tool",
					message: `工具执行失败: ${call.function.name}`,
					data: { arguments: args, error: errMsg },
				});
				results.push({ role: "tool", tool_call_id: call.id, content: errMsg });
			}
		}
		return results;
	}
}
