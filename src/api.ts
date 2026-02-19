import OpenAI from "openai";

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
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
): AsyncGenerator<string, void, unknown> {
  const stream = await client.chat.completions.create({
    model,
    messages,
    stream: true,
  });

  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content;
    if (content) {
      yield content;
    }
  }
}
