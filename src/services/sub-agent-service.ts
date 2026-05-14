import type { ApiMessage, ToolCall, ToolDefinition } from "@/types";
import type { IChatClient, AgentConfig } from "@/core/agent";
import { AgentRuntime, ToolGateway } from "@/core/agent";
import { AgentLogger } from "@/core/logger/index";

type ExecuteToolCallsFn = (calls: ToolCall[]) => Promise<Array<{ role: "tool"; tool_call_id: string; content: string }>>;

export class SubAgentService {
	private runtime!: AgentRuntime;
	private toolGateway: ToolGateway;
	private executeToolCallsFn: ExecuteToolCallsFn | null = null;

	constructor(
		private icClient: IChatClient,
		private config: AgentConfig,
		private logger: AgentLogger,
	) {
		this.toolGateway = new ToolGateway();
		this.runtime = new AgentRuntime(icClient, this.toolGateway, config);
	}

	setToolExecutor(fn: ExecuteToolCallsFn): void {
		this.executeToolCallsFn = fn;
		this.registerSubAgentTools();
		this.runtime = new AgentRuntime(this.icClient, this.toolGateway, this.config);
	}

	private registerSubAgentTools(): void {
		const fn = this.executeToolCallsFn;
		if (!fn) return;

		const subAgentToolDefs = getSubAgentToolDefinitions();

		this.toolGateway = new ToolGateway();

		for (const def of subAgentToolDefs) {
			const toolName = def.function.name;
			this.toolGateway.register(
				toolName,
				async (args) => {
					const result = await fn([{
						id: crypto.randomUUID(),
						type: "function",
						function: { name: toolName, arguments: JSON.stringify(args) },
					}]);
					return {
						content: result[0]?.content ?? "Error: no result from tool",
						isError: false,
					};
				},
				def,
			);
		}

		this.runtime = new AgentRuntime(this.icClient, this.toolGateway, this.config);
	}

	async runSubAgent(prompt: string): Promise<string> {
		if (!this.executeToolCallsFn) {
			throw new Error("SubAgentService 未初始化工具执行器");
		}

		const systemMessage: ApiMessage = {
			role: "system",
			content: buildSubAgentSystemPrompt(),
		};

		const userMessage: ApiMessage = {
			role: "user",
			content: prompt,
		};

		const messages: ApiMessage[] = [systemMessage, userMessage];

		this.logger.log({
			level: "info",
			type: "subagent",
			message: "子 Agent 开始执行任务",
			data: { prompt },
		});

		try {
			const result = await this.runtime.run(messages);

			this.logger.logLarge({
				level: "info",
				type: "subagent",
				message: "子 Agent 执行完成",
				data: { reply: result.content, replyLength: result.content.length, toolRounds: result.toolRounds },
			});

			return result.content || "(子 Agent 未返回任何内容)";
		} catch (error) {
			const errMsg = error instanceof Error ? error.message : String(error);
			this.logger.log({
				level: "error",
				type: "subagent",
				message: "子 Agent 执行出错",
				data: { error: errMsg },
			});
			return `*[子 Agent 执行出错: ${errMsg}]*`;
		}
	}
}

function buildSubAgentSystemPrompt(): string {
	return [
		"# 身份",
		"",
		"你是 Note Weaver 的子 Agent，专注于执行特定的调研、搜索和分析任务。你被主 Agent 委派来完成一个明确的子任务。",
		"",
		"# 核心能力",
		"",
		"- 笔记搜索：按文件名或全文内容搜索 vault 中的笔记",
		"- 笔记读取：读取 vault 中的笔记内容",
		"- 文件夹浏览：列出 vault 中文件夹的内容",
		"- 网络能力：搜索互联网获取实时信息，抓取网页内容",
		"",
		"# 工具选择指南",
		"",
		"- 搜索笔记 → search_notes / search_content",
		"- 读取笔记内容 → read_note",
		"- 浏览目录结构 → list_folder",
		"- 搜索互联网 → web_search",
		"- 阅读网页 → fetch_webpage",
		"",
		"# 行为准则",
		"",
		"1. 专注执行委派的任务，不要偏离主题",
		"2. 在回复中给出具体、完整的信息",
		"3. 不要使用表情符号",
		"4. 回答要简洁直接",
	].join("\n");
}

function getSubAgentToolDefinitions(): ToolDefinition[] {
	return [
		{
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
		{
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
		{
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
		{
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
		{
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
		{
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
	];
}
