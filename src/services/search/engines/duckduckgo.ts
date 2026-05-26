import { requestUrl } from "obsidian";
import type { SearchEngine, SearchEngineConfig, SearchResult } from "../types";
import { randomUserAgent, withTimeout, isBlockedResponse } from "../types";

export class DuckDuckGoEngine implements SearchEngine {
	readonly name = "duckduckgo";

	async search(
		query: string,
		config: SearchEngineConfig,
		signal?: AbortSignal,
	): Promise<SearchResult[]> {
		const encoded = encodeURIComponent(query);

		const [liteResult, htmlResult] = await Promise.allSettled([
			this.trySearch(
				`https://lite.duckduckgo.com/lite/?q=${encoded}`,
				this.parseDdgLite.bind(this),
				"DDG Lite",
				config,
				signal,
			),
			this.trySearch(
				`https://html.duckduckgo.com/html/?q=${encoded}`,
				this.parseDdgHtml.bind(this),
				"DDG HTML",
				config,
				signal,
			),
		]);

		if (signal?.aborted) return [];

		const liteOk = liteResult.status === "fulfilled" ? liteResult.value : [];
		const htmlOk = htmlResult.status === "fulfilled" ? htmlResult.value : [];

		const results: SearchResult[] = [];
		if (htmlOk.length > 0) {
			results.push(...htmlOk);
		} else if (liteOk.length > 0) {
			results.push(...liteOk);
		}

		config.logger.log({
			level: results.length > 0 ? "info" : "warn",
			type: "tool",
			message: `DuckDuckGo 搜索完成: "${query}" (${results.length} 个结果, Lite=${liteOk.length}, HTML=${htmlOk.length})`,
		});

		return results;
	}

	private async trySearch(
		url: string,
		parser: (html: string, maxResults: number) => SearchResult[],
		label: string,
		config: SearchEngineConfig,
		signal?: AbortSignal,
	): Promise<SearchResult[]> {
		try {
			const resp = await withTimeout(
				requestUrl({
					url,
					method: "GET",
					headers: { "User-Agent": randomUserAgent() },
				}),
				config.timeoutMs,
				`${label} 请求超时`,
				signal,
			);

			const html = resp.text;

			if (resp.status !== 200) {
				config.logger.log({
					level: "warn",
					type: "tool",
					message: `${label} 返回非 200 状态码: ${resp.status}`,
					data: { url, status: resp.status },
				});
				return [];
			}

			if (isBlockedResponse(html)) {
				config.logger.log({
					level: "error",
					type: "tool",
					message: `${label} 请求被拦截（检测到验证码或反爬机制）`,
					data: { url },
				});
				return [];
			}

			const results = parser(html, config.maxResults);

			config.logger.log({
				level: results.length > 0 ? "info" : "warn",
				type: "tool",
				message: `${label} 解析完成: ${results.length} 个结果 (status=${resp.status}, size=${html.length})`,
				data: { url, status: resp.status, contentLength: html.length, resultCount: results.length },
			});

			return results;
		} catch (e) {
			config.logger.log({
				level: "error",
				type: "tool",
				message: `${label} 搜索请求失败`,
				data: { url, error: e instanceof Error ? e.message : String(e) },
			});
			return [];
		}
	}

	private parseDdgLite(html: string, maxResults: number): SearchResult[] {
		const results: SearchResult[] = [];
		const doc = new DOMParser().parseFromString(html, "text/html");
		const anchors = doc.querySelectorAll("a.result-link");

		for (const anchor of anchors) {
			if (results.length >= maxResults) break;

			const linkCell = anchor.closest("td.result-link");
			const linkRow = linkCell?.closest("tr");
			const snippetRow = linkRow?.nextElementSibling;
			const snippetCell = snippetRow?.querySelector("td.result-snippet");

			results.push({
				title: anchor.textContent?.trim() || "",
				url: anchor.getAttribute("href") || "",
				snippet: snippetCell?.textContent?.trim() || "",
			});
		}

		return results;
	}

	private parseDdgHtml(html: string, maxResults: number): SearchResult[] {
		const results: SearchResult[] = [];
		const doc = new DOMParser().parseFromString(html, "text/html");
		const bodies = doc.querySelectorAll(".result__body");

		for (const body of bodies) {
			if (results.length >= maxResults) break;

			const link = body.querySelector("a.result__a");
			if (!link) continue;

			const snippetEl = body.querySelector("a.result__snippet");
			results.push({
				title: link.textContent?.trim() || "",
				url: link.getAttribute("href") || "",
				snippet: snippetEl?.textContent?.trim() || "",
			});
		}

		return results;
	}
}
