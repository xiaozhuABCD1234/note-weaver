import OpenAI from "openai";
import type { ToolCall, ApiMessage, ToolResultMessage, ToolDefinition } from "../types";
import { chatStreamWithTools } from "../api/client";
import { AgentLogger } from "../core/logger/index";

type ExecuteToolCallsFn = (calls: ToolCall[]) => Promise<ToolResultMessage[]>;

const TOOL_LIMITS: Record<string, number> = {
	read_note: 3000,
	search_content: 2000,
	fetch_webpage: 4000,
};

const MAX_CUMULATIVE_CHARS = 12000;

export class SubAgentService {
	private maxToolRounds = 5;
	private executeToolCallsFn: ExecuteToolCallsFn | null = null;

	constructor(
		private getClient: () => OpenAI,
		private modelName: string,
		private maxTokens: number,
		private thinkingMode: boolean,
		private reasoningEffort: string,
		private subAgentTools: ToolDefinition[],
		private logger: AgentLogger,
	) {}

	setToolExecutor(fn: ExecuteToolCallsFn): void {
		this.executeToolCallsFn = fn;
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

		let currentMessages: ApiMessage[] = [systemMessage, userMessage];
		let fullReply = "";
		let toolRounds = 0;

		this.logger.log({
			level: "info",
			type: "subagent",
			message: "子 Agent 开始执行任务",
			data: { prompt },
		});

		while (toolRounds < this.maxToolRounds) {
			const stream = chatStreamWithTools(
				this.getClient(),
				this.modelName,
				currentMessages,
				this.subAgentTools,
				this.maxTokens,
				this.thinkingMode,
				this.reasoningEffort,
			);

			let toolCalls: ToolCall[] | null = null;
			let streamedContent = "";

			try {
				for await (const event of stream) {
					if (event.type === "content") {
						streamedContent += event.content;
						fullReply += event.content;
					} else if (event.type === "tool_calls") {
						toolCalls = event.calls;
					}
				}
			} catch (error) {
				const errMsg = error instanceof Error ? error.message : String(error);
				this.logger.log({
					level: "error",
					type: "subagent",
					message: "子 Agent AI 调用失败",
					data: { error: errMsg, toolRounds },
				});
				fullReply += `\n\n*[子 Agent 执行出错: ${errMsg}]*`;
				break;
			}

			if (toolCalls && toolCalls.length > 0) {
				const toolNames = toolCalls.map(tc => tc.function.name).join(", ");
				this.logger.log({
					level: "info",
					type: "subagent",
					message: `子 Agent 调用工具: ${toolNames}`,
					data: { toolCalls: toolCalls.map(tc => ({ name: tc.function.name, args: tc.function.arguments })) },
				});

				const results = await this.executeToolCallsFn(toolCalls);

				const truncatedResults: ToolResultMessage[] = results.map((r, i) => ({
					...r,
					content: this.truncateToolResult(toolCalls[i]?.function.name ?? "", r.content),
				}));

				currentMessages = [
					...currentMessages,
					{ role: "assistant", content: streamedContent || null, tool_calls: toolCalls },
					...truncatedResults,
				];

				this.enforceBudget(currentMessages);

				toolRounds++;
				continue;
			}

			break;
		}

		if (toolRounds >= this.maxToolRounds) {
			fullReply += "\n\n*[子 Agent 已达到最大工具调用轮数]*";
			this.logger.log({
				level: "warn",
				type: "subagent",
				message: "子 Agent 达到最大工具调用轮数",
			});
		}

		this.logger.logLarge({
			level: "info",
			type: "subagent",
			message: "子 Agent 执行完成",
			data: { reply: fullReply, replyLength: fullReply.length, toolRounds },
		});

		return fullReply || "(子 Agent 未返回任何内容)";
	}

	private truncateToolResult(toolName: string, content: string): string {
		const limit = TOOL_LIMITS[toolName];
		if (!limit || content.length <= limit) return content;

		if (toolName === "search_content") {
			const headLen = Math.floor(limit * 0.7);
			return (
				content.slice(0, headLen) +
				`\n\n[...搜索内容已截断: 原始 ${content.length} 字符...]`
			);
		}

		const headLen = Math.floor(limit * 0.6);
		const tailLen = limit - headLen - 50;
		return (
			content.slice(0, headLen) +
			`\n\n[...内容已截断: 原始 ${content.length} 字符, 保留首尾各 ${headLen}/${tailLen} 字符...]\n\n` +
			content.slice(-tailLen)
		);
	}

	private enforceBudget(messages: ApiMessage[]): void {
		let total = 0;
		const toolIndices: number[] = [];

		messages.forEach((m, i) => {
			const len = (m.content as string || "").length;
			total += len;
			if (m.role === "tool") toolIndices.push(i);
		});

		if (total <= MAX_CUMULATIVE_CHARS) return;

		for (const idx of toolIndices) {
			if (this.estimateTotalChars(messages) <= MAX_CUMULATIVE_CHARS) break;
			const msg = messages[idx] as ToolResultMessage;
			messages[idx] = { ...msg, content: this.progressiveCompress(msg.content) };
		}
	}

	private progressiveCompress(content: string): string {
		if (content.length <= 500) return content;

		if (content.length <= 2000) {
			const keepLen = Math.floor(content.length * 0.5);
			const headLen = Math.floor(keepLen * 0.7);
			const tailLen = keepLen - headLen;
			return (
				content.slice(0, headLen) +
				`\n\n[...渐进压缩: ${content.length}→${keepLen} 字符...]\n\n` +
				content.slice(-tailLen)
			);
		}

		return (
			content.slice(0, 400) +
			`\n\n[...渐进压缩: ${content.length}→约 600 字符...]\n\n` +
			content.slice(-200)
		);
	}

	private estimateTotalChars(messages: ApiMessage[]): number {
		return messages.reduce(
			(sum, m) => sum + ((m.content as string) || "").length,
			0,
		);
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
