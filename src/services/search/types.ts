import type { IAgentLogger } from "@/core/logger/interface";

export interface SearchResult {
	title: string;
	url: string;
	snippet: string;
}

export interface SearchEngineConfig {
	maxResults: number;
	timeoutMs: number;
	logger: IAgentLogger;
}

export interface SearchEngine {
	readonly name: string;
	search(query: string, config: SearchEngineConfig, signal?: AbortSignal): Promise<SearchResult[]>;
}

export const USER_AGENTS = [
	"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
	"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
	"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15",
	"Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0",
	"Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
	"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
	"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0",
	"Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
];

export function randomUserAgent(): string {
	return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)]!;
}

const BLOCKED_KEYWORDS = [
	"please verify you're a human",
	"please verify you are a human",
	"unusual traffic from",
	"captcha",
	"challenge-platform",
	"verify you are human",
	"verify your identity",
	"确认您是真人",
	"验证您的身份",
	"流量异常",
	"人机验证",
	"安全检查",
	"安全验证",
	"your computer or network may be sending automated queries",
	"our systems have detected unusual traffic",
];

export function isBlockedResponse(html: string): boolean {
	const lower = html.toLowerCase();
	return BLOCKED_KEYWORDS.some((s) => lower.includes(s));
}

export function withTimeout<T>(promise: Promise<T>, ms: number, message: string, signal?: AbortSignal): Promise<T> {
	if (signal?.aborted) return Promise.reject(new DOMException("Aborted", "AbortError"));
	let timer: ReturnType<typeof setTimeout>;
	const onAbort = () => {
		clearTimeout(timer);
	};
	signal?.addEventListener("abort", onAbort, { once: true });
	const timeout = new Promise<never>((_, reject) => {
		timer = setTimeout(() => reject(new Error(message)), ms);
	});
	return Promise.race([promise, timeout]).finally(() => {
		clearTimeout(timer);
		signal?.removeEventListener("abort", onAbort);
	});
}
