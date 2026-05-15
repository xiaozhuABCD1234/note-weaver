import OpenAI from "openai";
import type { ApiMessage, StreamEvent, ToolCall, ToolDefinition } from "@/types";
import type { IChatClient } from "@/core/agent/types";

export interface OpenAIClientConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  maxTokens: number;
  thinkingMode: boolean;
  reasoningEffort: string;
}

export class OpenAIChatClient implements IChatClient {
  private client: OpenAI;
  private model: string;
  private maxTokens: number;
  private thinkingMode: boolean;
  private reasoningEffort: string;

  constructor(config: OpenAIClientConfig) {
    this.client = new OpenAI({
      baseURL: config.baseUrl,
      apiKey: config.apiKey,
      dangerouslyAllowBrowser: true,
    });
    this.model = config.model;
    this.maxTokens = config.maxTokens;
    this.thinkingMode = config.thinkingMode;
    this.reasoningEffort = config.reasoningEffort;
  }

  async *chat(
    messages: ApiMessage[],
    tools: ToolDefinition[],
    signal?: AbortSignal,
  ): AsyncGenerator<StreamEvent> {
    const createParams: Record<string, unknown> = {
      model: this.model,
      messages: messages as OpenAI.Chat.Completions.ChatCompletionMessageParam[],
      stream: true,
      tools: tools as OpenAI.Chat.Completions.ChatCompletionTool[],
      max_tokens: this.maxTokens,
    };

    if (this.thinkingMode) {
      createParams.reasoning_effort = this.reasoningEffort ?? "high";
      createParams.extra_body = { thinking: { type: "enabled" } };
    }

    const stream = await this.client.chat.completions.create(
      createParams as unknown as OpenAI.Chat.ChatCompletionCreateParamsStreaming,
      { signal },
    );

    const toolCallAccumulators: Map<number, { id: string; name: string; args: string }> = new Map();
    let reasoningContent = "";

    for await (const chunk of stream) {
      const choice = chunk.choices[0];
      if (!choice) continue;

      const delta = choice.delta;

      const rc = (delta as unknown as Record<string, unknown>)?.reasoning_content;
      if (typeof rc === "string") {
        reasoningContent += rc;
      }

      if (delta?.content) {
        yield { type: "content" as const, content: delta.content };
      }

      if (delta?.tool_calls) {
        for (const tcDelta of delta.tool_calls) {
          if (tcDelta.index === undefined) continue;
          if (!toolCallAccumulators.has(tcDelta.index)) {
            toolCallAccumulators.set(tcDelta.index, { id: "", name: "", args: "" });
          }
          const acc = toolCallAccumulators.get(tcDelta.index)!;
          if (tcDelta.id) acc.id = tcDelta.id;
          if (tcDelta.function?.name) acc.name += tcDelta.function.name;
          if (tcDelta.function?.arguments) acc.args += tcDelta.function.arguments;
        }
      }

      if (choice.finish_reason === "tool_calls") {
        const calls: ToolCall[] = Array.from(toolCallAccumulators.entries())
          .sort(([a], [b]) => a - b)
          .map(([, acc]) => ({
            id: acc.id,
            type: "function" as const,
            function: { name: acc.name, arguments: acc.args },
          }));
        yield { type: "tool_calls" as const, calls, reasoningContent };
        return;
      }
    }
  }
}
