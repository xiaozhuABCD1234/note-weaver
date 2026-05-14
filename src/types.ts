export interface ChatMessage {
	role: "user" | "assistant" | "system";
	content: string;
}

export interface ToolCall {
	id: string;
	type: "function";
	function: {
		name: string;
		arguments: string;
	};
}

export interface AssistantToolCallMessage {
	role: "assistant";
	content: string | null;
	tool_calls: ToolCall[];
	reasoning_content?: string | null;
}

export interface ToolResultMessage {
	role: "tool";
	tool_call_id: string;
	content: string;
}

export type ApiMessage = ChatMessage | AssistantToolCallMessage | ToolResultMessage;

export interface ToolDefinition {
	type: "function";
	function: {
		name: string;
		description: string;
		parameters: Record<string, unknown>;
	};
}

export type StreamEvent =
	| { type: "content"; content: string }
	| { type: "tool_calls"; calls: ToolCall[]; reasoningContent: string };
