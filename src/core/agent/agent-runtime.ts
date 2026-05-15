import type { ApiMessage, ToolCall } from "@/types";
import type { AgentConfig, AgentRunResult, IChatClient } from "./types";
import { ToolGateway } from "./tool-gateway";
import { decideNext } from "./loop-decision";
import { truncateToolResult } from "./result-compressor";

export class AgentRuntime {
  constructor(
    private llmClient: IChatClient,
    private toolGateway: ToolGateway,
    private config: AgentConfig,
  ) {}

  async run(
    messages: ApiMessage[],
    signal?: AbortSignal,
    onStream?: (delta: string) => void,
  ): Promise<AgentRunResult> {
    let currentMessages = [...messages];
    let fullContent = "";
    let toolRounds = 0;
    let lastError: string | undefined;
    let lastRoundHadToolCalls = false;

    while (toolRounds < this.config.maxToolRounds) {
      const stream = this.llmClient.chat(
        currentMessages,
        this.toolGateway.getDefinitions(),
        signal,
      );

      let toolCalls: ToolCall[] | null = null;
      let streamedContent = "";
      let reasoningContent = "";

      try {
        for await (const event of stream) {
          if (event.type === "content") {
            streamedContent += event.content;
            fullContent += event.content;
            onStream?.(event.content);
          } else if (event.type === "tool_calls") {
            toolCalls = event.calls;
            reasoningContent = event.reasoningContent;
          }
        }
      } catch (e) {
        if (e instanceof Error && e.name === "AbortError") {
          throw e;
        }
        lastError = e instanceof Error ? e.message : String(e);
        break;
      }

      const decision = decideNext({
        toolRounds,
        maxToolRounds: this.config.maxToolRounds,
        hasToolCalls: toolCalls !== null && toolCalls.length > 0,
        lastError,
      });

      if (decision === "stop") {
        if (lastRoundHadToolCalls && !streamedContent && !lastError) {
          currentMessages.push({
            role: "user",
            content: "请根据以上工具执行结果回答用户的问题。",
          });
          lastRoundHadToolCalls = false;
          continue;
        }
        break;
      }

      lastRoundHadToolCalls = false;

      if (toolCalls && toolCalls.length > 0) {
        const results = await this.toolGateway.executeCalls(toolCalls);

        const assistantMsg: ApiMessage = {
          role: "assistant",
          content: streamedContent || null,
          tool_calls: toolCalls,
          reasoning_content: reasoningContent || null,
        };

        const toolResultMessages: ApiMessage[] = results.map((r, i) => ({
          role: "tool" as const,
          tool_call_id: toolCalls[i]?.id ?? "",
          content: truncateToolResult(toolCalls[i]?.function.name ?? "", r.content),
        }));

        currentMessages = [
          ...currentMessages,
          assistantMsg,
          ...toolResultMessages,
        ];

        toolRounds++;
        lastRoundHadToolCalls = true;
      }
    }

    if (!fullContent && toolRounds > 0) {
      fullContent = "已根据工具执行结果完成操作。";
    }

    return {
      content: fullContent,
      toolRounds,
    };
  }
}
