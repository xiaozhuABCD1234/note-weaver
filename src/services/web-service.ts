import { requestUrl } from "obsidian";
import type { AgentLogger } from "../core/logger/index";

export interface SearchResult {
	title: string;
	url: string;
	snippet: string;
}

export class WebService {
	constructor(
		private maxResults: number,
		private logger: AgentLogger,
	) {}

	async search(query: string): Promise<SearchResult[]> {
		const encoded = encodeURIComponent(query);

		const results = await this.trySearch(
			`https://lite.duckduckgo.com/lite/?q=${encoded}`,
			this.parseDdgLite.bind(this),
			"DDG Lite",
		);

		if (results.length > 0) return results;

		const fallback = await this.trySearch(
			`https://html.duckduckgo.com/html/?q=${encoded}`,
			this.parseDdgHtml.bind(this),
			"DDG HTML",
		);

		return fallback;
	}

	private async trySearch(
		url: string,
		parser: (html: string) => SearchResult[],
		label: string,
	): Promise<SearchResult[]> {
		try {
			const resp = await requestUrl({
				url,
				method: "GET",
				headers: {
					"User-Agent":
						"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
				},
			});

			const responseInfo: Record<string, unknown> = {
				url,
				status: resp.status,
				contentLength: resp.text.length,
			};

			if (resp.status !== 200) {
				this.logger.log({
					level: "warn",
					type: "tool",
					message: `${label} 返回非 200 状态码: ${resp.status}`,
					data: { ...responseInfo, htmlPreview: resp.text.slice(0, 500) },
				});
			}

			const results = parser(resp.text);

			this.logger.log({
				level: results.length > 0 ? "info" : "warn",
				type: "tool",
				message: `${label} 解析完成: ${results.length} 个结果 (status=${resp.status}, size=${resp.text.length})`,
				data: {
					...responseInfo,
					resultCount: results.length,
					firstResult: results[0]
						? { title: results[0].title, url: results[0].url }
						: null,
				},
			});

			return results;
		} catch (e) {
			this.logger.log({
				level: "error",
				type: "tool",
				message: `${label} 搜索请求失败`,
				data: { url, error: e instanceof Error ? e.message : String(e) },
			});
			return [];
		}
	}

	async fetchPage(url: string, maxLength = 8000): Promise<string> {
		const resp = await requestUrl({
			url,
			method: "GET",
			headers: {
				"User-Agent":
					"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
			},
		});

		const text = this.htmlToText(resp.text);
		const result = text.slice(0, maxLength);

		this.logger.log({
			level: "info",
			type: "tool",
			message: `抓取网页: ${url}`,
			data: {
				url,
				status: resp.status,
				rawLength: resp.text.length,
				textLength: text.length,
				resultLength: result.length,
				truncated: text.length > maxLength,
			},
		});

		return result;
	}

	private parseDdgLite(html: string): SearchResult[] {
		const results: SearchResult[] = [];
		const linkRegex = /<a[^>]*class=['"]result-link['"][^>]*>([\s\S]*?)<\/a>/gi;
		let linkMatch: RegExpExecArray | null;

		while ((linkMatch = linkRegex.exec(html)) !== null) {
			const anchor = linkMatch[0];
			const innerText = linkMatch[1]!;

			const hrefMatch = /href="([^"]*)"/i.exec(anchor);
			if (!hrefMatch) continue;

			const url = this.decodeHtmlEntities(hrefMatch[1]!);
			const title = this.decodeHtmlEntities(
				innerText.replace(/<[^>]+>/g, "").trim(),
			);

			const snippetStart = linkMatch.index + anchor.length;
			const remaining = html.slice(snippetStart, snippetStart + 1000);
			const snippetMatch = /<td[^>]*class=['"]result-snippet['"][^>]*>([\s\S]*?)<\/td>/i.exec(remaining);
			const snippet = snippetMatch
				? this.decodeHtmlEntities(
						snippetMatch[1]!.replace(/<[^>]+>/g, "").trim(),
					)
				: "";

			results.push({ title, url, snippet });

			if (results.length >= this.maxResults) break;
		}

		return results;
	}

	private parseDdgHtml(html: string): SearchResult[] {
		const results: SearchResult[] = [];

		const bodyRegex = /<div[^>]*class="result__body"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/g;
		let bodyMatch: RegExpExecArray | null;

		while ((bodyMatch = bodyRegex.exec(html)) !== null) {
			const body = bodyMatch[1]!;

			const linkMatch = /<a[^>]*class="result__a"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/i.exec(body);
			if (!linkMatch) continue;

			const url = this.decodeHtmlEntities(linkMatch[1]!);
			const title = this.decodeHtmlEntities(linkMatch[2]!.replace(/<[^>]+>/g, "").trim());

			const snippetMatch = /<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/i.exec(body);
			const snippet = snippetMatch
				? this.decodeHtmlEntities(snippetMatch[1]!.replace(/<[^>]+>/g, "").trim())
				: "";

			results.push({ title, url, snippet });

			if (results.length >= this.maxResults) break;
		}

		if (results.length > 0) return results;

		const altRegex = /<a[^>]*class="result__a"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;
		let altMatch: RegExpExecArray | null;

		while ((altMatch = altRegex.exec(html)) !== null) {
			const url = this.decodeHtmlEntities(altMatch[1]!);
			const title = this.decodeHtmlEntities(altMatch[2]!.replace(/<[^>]+>/g, "").trim());
			const snippet = this.decodeHtmlEntities(altMatch[3]!.replace(/<[^>]+>/g, "").trim());

			results.push({ title, url, snippet });
			if (results.length >= this.maxResults) break;
		}

		return results;
	}

	private htmlToText(html: string): string {
		let text = html
			.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
			.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
			.replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, "")
			.replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, "")
			.replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, "")
			.replace(/<header[^>]*>[\s\S]*?<\/header>/gi, "")
			.replace(/<br\s*\/?>/gi, "\n")
			.replace(/<\/p>/gi, "\n\n")
			.replace(/<\/div>/gi, "\n")
			.replace(/<\/li>/gi, "\n")
			.replace(/<\/h[1-6]>/gi, "\n\n")
			.replace(/<[^>]+>/g, "")
			.replace(/&nbsp;/gi, " ")
			.replace(/&amp;/gi, "&")
			.replace(/&lt;/gi, "<")
			.replace(/&gt;/gi, ">")
			.replace(/&quot;/gi, '"')
			.replace(/&#39;/g, "'")
			.replace(/\n{3,}/g, "\n\n")
			.trim();

		return text;
	}

	private decodeHtmlEntities(text: string): string {
		return text
			.replace(/&amp;/gi, "&")
			.replace(/&lt;/gi, "<")
			.replace(/&gt;/gi, ">")
			.replace(/&quot;/gi, '"')
			.replace(/&#39;/g, "'")
			.replace(/&#x27;/g, "'")
			.replace(/&#x2F;/g, "/")
			.replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(Number(dec)));
	}
}
