import OpenAI from "openai";

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
}

export interface ToolResultMessage {
	role: "tool";
	tool_call_id: string;
	content: string;
}

export type ApiMessage = ChatMessage | AssistantToolCallMessage | ToolResultMessage;

export interface AiJsonResponse {
	reply: string;
	modified_note?: string;
}

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
	| { type: "tool_calls"; calls: ToolCall[] };

export function createOpenAIClient(baseUrl: string, apiKey: string): OpenAI {
	return new OpenAI({
		baseURL: baseUrl,
		apiKey: apiKey,
		dangerouslyAllowBrowser: true,
	});
}

export async function* chatStream(
	client: OpenAI,
	model: string,
	messages: ChatMessage[],
	maxTokens?: number,
	signal?: AbortSignal,
) {
	const stream = await client.chat.completions.create(
		{
			model,
			messages,
			stream: true,
			response_format: { type: "json_object" },
			max_tokens: maxTokens,
		},
		{ signal },
	);

	for await (const chunk of stream) {
		const content = chunk.choices[0]?.delta?.content;
		if (content) {
			yield content;
		}
	}
}

export async function* chatStreamWithTools(
	client: OpenAI,
	model: string,
	messages: ApiMessage[],
	tools: ToolDefinition[],
	maxTokens?: number,
	signal?: AbortSignal,
): AsyncGenerator<StreamEvent> {
	const stream = await client.chat.completions.create(
		{
			model,
			messages: messages as OpenAI.Chat.Completions.ChatCompletionMessageParam[],
			stream: true,
			tools: tools as OpenAI.Chat.Completions.ChatCompletionTool[],
			max_tokens: maxTokens,
		},
		{ signal },
	);

	const toolCallAccumulators: Map<number, { id: string; name: string; args: string }> = new Map();

	for await (const chunk of stream) {
		const choice = chunk.choices[0];
		if (!choice) continue;

		const delta = choice.delta;

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
			yield { type: "tool_calls" as const, calls };
			return;
		}
	}
}
