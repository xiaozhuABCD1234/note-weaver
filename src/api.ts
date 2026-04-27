import OpenAI from "openai";

export interface ChatMessage {
	role: "user" | "assistant" | "system";
	content: string;
}

export interface AiJsonResponse {
	reply: string;
	modified_note?: string;
}

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
