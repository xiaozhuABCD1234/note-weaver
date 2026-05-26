import { DEFAULT_RAG_CONFIG } from "@/core/rag/index";
import type { RagConfig } from "@/core/rag/types";
import type { QuickAskConfig } from "@/features/quick-ask";
import { DEFAULT_QUICK_ASK_CONFIG } from "@/features/quick-ask";

export interface NoteWeaverSettings {
	apiKey: string;
	baseUrl: string;
	modelName: string;
	maxTokens: number;
	thinkingMode: boolean;
	reasoningEffort: "high" | "max";
	rag: RagConfig;
	webSearchEnabled: boolean;
	webSearchMaxResults: number;
	quickAsk: QuickAskConfig;
	knowledgeBasePath: string;
}

export const DEFAULT_SETTINGS: NoteWeaverSettings = {
	apiKey: "",
	baseUrl: "https://api.deepseek.com",
	modelName: "deepseek-v4-flash",
	maxTokens: 16384,
	thinkingMode: true,
	reasoningEffort: "high",
	rag: DEFAULT_RAG_CONFIG,
	webSearchEnabled: true,
	webSearchMaxResults: 5,
	quickAsk: DEFAULT_QUICK_ASK_CONFIG,
	knowledgeBasePath: "知识库",
};
