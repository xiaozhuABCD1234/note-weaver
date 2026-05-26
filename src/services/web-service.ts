import { requestUrl } from "obsidian";
import type { IAgentLogger } from "@/core/logger/interface";
import type { SearchResult } from "./search/types";
import { EngineRegistry, type EngineName } from "./search/engine-registry";
import { randomUserAgent, withTimeout } from "./search/types";

export type { SearchResult };

export class WebService {
	private enabled: boolean;
	private registry: EngineRegistry;

	constructor(
		maxResults: number,
		private logger: IAgentLogger,
		enabled: boolean,
		engine: EngineName = "brave",
		braveApiKey = "",
	) {
		this.enabled = enabled;
		this.registry = new EngineRegistry({
			primaryEngine: engine,
			braveApiKey,
			maxResults,
			logger,
		});
	}

	updateConfig(
		maxResults: number,
		enabled: boolean,
		engine?: EngineName,
		braveApiKey?: string,
	): void {
		this.enabled = enabled;
		this.registry.updateConfig({
			maxResults,
			primaryEngine: engine ?? this.registry.getCurrentEngine(),
			braveApiKey: braveApiKey ?? this.registry.getBraveApiKey(),
		});
	}

	async search(query: string): Promise<SearchResult[]> {
		if (!this.enabled) return [];
		return this.registry.search(query);
	}

	async fetchPage(url: string, maxLength = 12000): Promise<string> {
		if (!this.enabled) return "网络抓取已禁用";

		try {
			const resp = await withTimeout(
				requestUrl({
					url,
					method: "GET",
					headers: { "User-Agent": randomUserAgent() },
				}),
				15_000,
				`抓取页面超时: ${url}`,
			);

			const rawHtml = resp.text;

			if (resp.status !== 200) {
				const msg = `抓取失败: 服务器返回状态码 ${resp.status}`;
				this.logger.log({ level: "warn", type: "tool", message: msg, data: { url, status: resp.status } });
				return msg;
			}

			if (rawHtml.length > 2_000_000) {
				const msg = `页面过大 (${(rawHtml.length / 1024 / 1024).toFixed(1)}MB)，跳过抓取`;
				this.logger.log({ level: "warn", type: "tool", message: msg, data: { url } });
				return msg;
			}

			const text = this.htmlToText(rawHtml);
			const result = text.slice(0, maxLength);

			this.logger.log({
				level: "info",
				type: "tool",
				message: `抓取网页: ${url}`,
				data: {
					url,
					status: resp.status,
					rawLength: rawHtml.length,
					textLength: text.length,
					resultLength: result.length,
					truncated: text.length > maxLength,
				},
			});

			return result;
		} catch (e) {
			const errMsg = `抓取失败: ${e instanceof Error ? e.message : String(e)}`;
			this.logger.log({ level: "error", type: "tool", message: errMsg, data: { url } });
			return errMsg;
		}
	}

	private htmlToText(html: string): string {
		const doc = new DOMParser().parseFromString(html, "text/html");

		for (const el of doc.querySelectorAll("script, style, noscript, nav, footer, header")) {
			el.remove();
		}

		for (const anchor of doc.querySelectorAll("a[href]")) {
			const href = anchor.getAttribute("href") || "";
			const text = anchor.textContent?.trim();
			if (text && href && text !== href) {
				anchor.textContent = `[${text}](${href})`;
			}
		}

		for (const strong of doc.querySelectorAll("strong, b")) {
			strong.textContent = `**${strong.textContent}**`;
		}
		for (const em of doc.querySelectorAll("em, i")) {
			em.textContent = `*${em.textContent}*`;
		}

		for (const heading of doc.querySelectorAll("h1, h2, h3, h4, h5, h6")) {
			const level = parseInt(heading.tagName[1]!, 10);
			heading.textContent = `${"#".repeat(level)} ${heading.textContent}`;
		}

		let text = doc.body?.textContent || "";
		text = text.replace(/\u00A0/g, " ").replace(/\n{3,}/g, "\n\n").trim();
		return text;
	}
}
