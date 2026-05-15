import type { ApiMessage, StreamEvent, ToolDefinition } from "@/types";

export interface AgentConfig {
  model: string;
  maxTokens: number;
  maxToolRounds: number;
  thinkingMode: boolean;
  reasoningEffort: string;
  systemPrompt?: string;
}

export interface ToolHandlerContext {
  signal?: AbortSignal;
}

export type ToolHandler = (
  args: unknown,
  context?: ToolHandlerContext,
) => Promise<ToolResult>;

export interface ToolResult {
  content: string;
  isError?: boolean;
}

export type AgentDecision = "continue" | "stop";

export interface AgentContext {
  toolRounds: number;
  maxToolRounds: number;
  hasToolCalls: boolean;
  lastError?: string;
}

export interface AgentRunResult {
  content: string;
  toolRounds: number;
}

export interface RegisteredTool {
  name: string;
  handler: ToolHandler;
  definition: ToolDefinition;
}

export interface IChatClient {
  chat(
    messages: ApiMessage[],
    tools: ToolDefinition[],
    signal?: AbortSignal,
  ): AsyncGenerator<StreamEvent>;
}
