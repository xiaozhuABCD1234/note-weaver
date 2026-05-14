import { DEFAULT_RAG_CONFIG } from "@/core/rag/index";
import type { RagConfig } from "@/core/rag/types";

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
};


