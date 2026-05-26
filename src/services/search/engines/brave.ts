import { requestUrl } from "obsidian";
import type { SearchEngine, SearchEngineConfig, SearchResult } from "../types";
import { randomUserAgent, withTimeout } from "../types";

interface BraveWebResult {
	title: string;
	url: string;
	description: string;
}

interface BraveResponse {
	web?: {
		results?: BraveWebResult[];
	};
}

export class BraveSearchEngine implements SearchEngine {
	readonly name = "brave";

	constructor(private apiKey: string) {}

	updateApiKey(key: string): void {
		this.apiKey = key;
	}

	async search(
		query: string,
		config: SearchEngineConfig,
		signal?: AbortSignal,
	): Promise<SearchResult[]> {
		if (!this.apiKey) {
			config.logger.log({
				level: "warn",
				type: "tool",
				message: "Brave Search API Key 未配置，请先在设置中添加",
			});
			return [];
		}

		if (signal?.aborted) return [];

		try {
			const resp = await withTimeout(
				requestUrl({
					url: `https://api.search.brave.com/results/web?q=${encodeURIComponent(query)}&count=${config.maxResults}&safesearch=off`,
					method: "GET",
					headers: {
						"X-Subscription-Token": this.apiKey,
						Accept: "application/json",
						"User-Agent": randomUserAgent(),
					},
				}),
				config.timeoutMs,
				"Brave Search API 请求超时",
				signal,
			);

			if (resp.status !== 200) {
				config.logger.log({
					level: "error",
					type: "tool",
					message: `Brave Search API 返回错误: ${resp.status}`,
					data: { status: resp.status, body: resp.text?.slice(0, 500) },
				});
				return [];
			}

			const data = JSON.parse(resp.text) as BraveResponse;
			const results = (data.web?.results ?? []).slice(0, config.maxResults).map((r) => ({
				title: r.title,
				url: r.url,
				snippet: r.description,
			}));

			config.logger.log({
				level: results.length > 0 ? "info" : "warn",
				type: "tool",
				message: `Brave Search 完成: "${query}" (${results.length} 个结果)`,
				data: { resultCount: results.length },
			});

			return results;
		} catch (e) {
			if (signal?.aborted) return [];

			config.logger.log({
				level: "error",
				type: "tool",
				message: `Brave Search 请求失败: ${e instanceof Error ? e.message : String(e)}`,
				data: { query },
			});
			return [];
		}
	}
}
