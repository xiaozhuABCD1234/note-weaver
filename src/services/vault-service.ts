import { App } from "obsidian";
import { AgentLogger } from "@/core/logger/index";
import type { ToolCall, ToolResultMessage } from "@/types";
import type { ToolGateway, ToolHandler, ToolResult } from "@/core/agent";
import { WebService } from "./web-service";
import { SubAgentService } from "./sub-agent-service";
import { KnowledgeService } from "./knowledge-service";
import { VaultOperations } from "./vault-operations";
import type { SaveKnowledgeParams } from "./knowledge-service";
import {
	READ_NOTE_DEFINITION,
	SEARCH_NOTES_DEFINITION,
	SEARCH_CONTENT_DEFINITION,
	GREP_CONTENT_DEFINITION,
	LIST_FOLDER_DEFINITION,
	WEB_SEARCH_DEFINITION,
	FETCH_WEBPAGE_DEFINITION,
	SAVE_KNOWLEDGE_DEFINITION,
	WRITE_NOTE_DEFINITION,
	APPEND_NOTE_DEFINITION,
	DELETE_NOTE_DEFINITION,
	RENAME_NOTE_DEFINITION,
	EDIT_NOTE_DEFINITION,
	GET_NOTE_METADATA_DEFINITION,
	DELEGATE_TASK_DEFINITION,
	LIST_RECENT_NOTES_DEFINITION,
} from "./tool-definitions";

export class VaultService {
	private logger: AgentLogger;
	private webService: WebService;
	private subAgentService: SubAgentService;
	private knowledgeService: KnowledgeService;
	private ops: VaultOperations;

	constructor(
		private app: App,
		logger: AgentLogger,
		webService: WebService,
		subAgentService: SubAgentService,
		knowledgeService: KnowledgeService,
	) {
		this.logger = logger;
		this.webService = webService;
		this.subAgentService = subAgentService;
		this.knowledgeService = knowledgeService;
		this.ops = new VaultOperations(app);
	}

	registerTools(gateway: ToolGateway): void {
		gateway.registerMany([
			{
				name: "save_knowledge",
				handler: this.makeHandler(async (args) =>
					this.knowledgeService.saveKnowledge(args as unknown as SaveKnowledgeParams),
				),
				definition: SAVE_KNOWLEDGE_DEFINITION,
			},
			{
				name: "read_note",
				handler: this.makeHandler((args) => this.ops.readNote(args.path as string)),
				definition: READ_NOTE_DEFINITION,
			},
			{
				name: "search_notes",
				handler: this.makeHandler((args) => JSON.stringify(this.ops.searchFiles(args.query as string))),
				definition: SEARCH_NOTES_DEFINITION,
			},
			{
				name: "search_content",
				handler: this.makeHandler(async (args) =>
					JSON.stringify(await this.ops.searchContent(args.query as string)),
				),
				definition: SEARCH_CONTENT_DEFINITION,
			},
			{
				name: "list_folder",
				handler: this.makeHandler((args) =>
					JSON.stringify(this.ops.listFolder(args.path as string | undefined)),
				),
				definition: LIST_FOLDER_DEFINITION,
			},
			{
				name: "write_note",
				handler: this.makeHandler(async (args) =>
					this.ops.writeNote(args.path as string, args.content as string),
				),
				definition: WRITE_NOTE_DEFINITION,
			},
			{
				name: "append_note",
				handler: this.makeHandler(async (args) =>
					this.ops.appendNote(args.path as string, args.content as string),
				),
				definition: APPEND_NOTE_DEFINITION,
			},
			{
				name: "delete_note",
				handler: this.makeHandler(async (args) =>
					this.ops.deleteNote(args.path as string),
				),
				definition: DELETE_NOTE_DEFINITION,
			},
			{
				name: "rename_note",
				handler: this.makeHandler(async (args) =>
					this.ops.renameNote(args.path as string, args.newPath as string),
				),
				definition: RENAME_NOTE_DEFINITION,
			},
			{
				name: "web_search",
				handler: this.makeHandler(async (args) =>
					JSON.stringify(await this.webService.search(args.query as string)),
				),
				definition: WEB_SEARCH_DEFINITION,
			},
			{
				name: "fetch_webpage",
				handler: this.makeHandler(async (args) =>
					this.webService.fetchPage(args.url as string),
				),
				definition: FETCH_WEBPAGE_DEFINITION,
			},
			{
				name: "delegate_task",
				handler: this.makeHandler(async (args) =>
					this.subAgentService.runSubAgent(args.prompt as string),
				),
				definition: DELEGATE_TASK_DEFINITION,
			},
			{
				name: "edit_note",
				handler: this.makeHandler(async (args) =>
					this.ops.editNote(
						args.path as string,
						args.oldSnippet as string,
						args.newSnippet as string,
					),
				),
				definition: EDIT_NOTE_DEFINITION,
			},
			{
				name: "get_note_metadata",
				handler: this.makeHandler(async (args) =>
					JSON.stringify(await this.ops.getMetadata(args.path as string)),
				),
				definition: GET_NOTE_METADATA_DEFINITION,
			},
			{
				name: "grep_content",
				handler: this.makeHandler(async (args) =>
					JSON.stringify(await this.ops.grepContent(
						args.pattern as string,
						args.caseSensitive as boolean | undefined,
						args.maxResults as number | undefined,
					)),
				),
				definition: GREP_CONTENT_DEFINITION,
			},
			{
				name: "list_recent_notes",
				handler: this.makeHandler(async (args) =>
					JSON.stringify(this.ops.listRecentNotes(args.limit as number | undefined)),
				),
				definition: LIST_RECENT_NOTES_DEFINITION,
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

	async executeToolCalls(calls: ToolCall[]): Promise<ToolResultMessage[]> {
		const results: ToolResultMessage[] = [];
		for (const call of calls) {
			let args: Record<string, unknown>;
			try {
				args = JSON.parse(call.function.arguments) as Record<string, unknown>;
			} catch {
				results.push({ role: "tool", tool_call_id: call.id, content: "Error: Invalid JSON arguments" });
				continue;
			}
			try {
				let content: string;
				switch (call.function.name) {
					case "read_note": content = await this.ops.readNote(args.path as string); break;
					case "write_note": content = await this.ops.writeNote(args.path as string, args.content as string); break;
					case "append_note": content = await this.ops.appendNote(args.path as string, args.content as string); break;
					case "delete_note": content = await this.ops.deleteNote(args.path as string); break;
					case "rename_note": content = await this.ops.renameNote(args.path as string, args.newPath as string); break;
					case "search_notes": content = JSON.stringify(this.ops.searchFiles(args.query as string)); break;
					case "search_content": content = JSON.stringify(await this.ops.searchContent(args.query as string)); break;
					case "grep_content": content = JSON.stringify(await this.ops.grepContent(args.pattern as string, args.caseSensitive as boolean | undefined, args.maxResults as number | undefined)); break;
					case "list_folder": content = JSON.stringify(this.ops.listFolder(args.path as string | undefined)); break;
					case "web_search": content = JSON.stringify(await this.webService.search(args.query as string)); break;
					case "fetch_webpage": content = await this.webService.fetchPage(args.url as string); break;
					case "delegate_task": content = await this.subAgentService.runSubAgent(args.prompt as string); break;
				case "save_knowledge":
					content = await this.knowledgeService.saveKnowledge(args as unknown as SaveKnowledgeParams);
					break;
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
