import type { IAgentLogger } from "@/core/logger/interface";
import type { SearchEngine, SearchEngineConfig, SearchResult } from "./types";
import { BraveSearchEngine } from "./engines/brave";
import { DuckDuckGoEngine } from "./engines/duckduckgo";

export type EngineName = "brave" | "duckduckgo";

export const ENGINE_NAMES: Record<EngineName, string> = {
	brave: "Brave Search API",
	duckduckgo: "DuckDuckGo",
};

export interface EngineRegistryConfig {
	primaryEngine: EngineName;
	braveApiKey: string;
	maxResults: number;
	logger: IAgentLogger;
}

export class EngineRegistry {
	private engines = new Map<string, SearchEngine>();
	private braveEngine: BraveSearchEngine;
	private ddgEngine: DuckDuckGoEngine;
	private consecutiveFailures = 0;

	constructor(config: EngineRegistryConfig) {
		this.braveEngine = new BraveSearchEngine(config.braveApiKey);
		this.ddgEngine = new DuckDuckGoEngine();

		this.engines.set("brave", this.braveEngine);
		this.engines.set("duckduckgo", this.ddgEngine);

		this.config = config;
	}

	private config: EngineRegistryConfig;

	updateConfig(config: Partial<EngineRegistryConfig>): void {
		Object.assign(this.config, config);
		this.braveEngine.updateApiKey(this.config.braveApiKey);
		this.consecutiveFailures = 0;
	}

	private getTimeout(): number {
		if (this.consecutiveFailures >= 4) return 3_000;
		if (this.consecutiveFailures >= 2) return 5_000;
		return 10_000;
	}

	private shouldSkipEngine(name: EngineName): boolean {
		return name === "brave" && !this.config.braveApiKey;
	}

	private async delayBetweenRequests(): Promise<void> {
		const jitter = Math.random() * 1000 + 500;
		await new Promise((r) => setTimeout(r, jitter));
	}

	async search(query: string, signal?: AbortSignal): Promise<SearchResult[]> {
		const primary = this.config.primaryEngine;
		const secondary: EngineName = primary === "brave" ? "duckduckgo" : "brave";

		const config: SearchEngineConfig = {
			maxResults: this.config.maxResults,
			timeoutMs: this.getTimeout(),
			logger: this.config.logger,
		};

		const primaryEngine = this.engines.get(primary);
		if (primaryEngine && !this.shouldSkipEngine(primary)) {
			const results = await primaryEngine.search(query, config, signal);
			if (results.length > 0) {
				this.consecutiveFailures = 0;
				return results;
			}
			this.consecutiveFailures++;
			await this.delayBetweenRequests();
		}

		if (signal?.aborted) return [];

		const fallback = this.engines.get(secondary);
		if (fallback) {
			const fallbackConfig: SearchEngineConfig = {
				...config,
				timeoutMs: this.getTimeout(),
			};
			const results = await fallback.search(query, fallbackConfig, signal);
			if (results.length > 0) {
				this.consecutiveFailures = 0;
			}
			return results;
		}

		return [];
	}

	getPrimaryEngineName(): EngineName {
		return this.config.primaryEngine;
	}

	getCurrentEngine(): EngineName {
		return this.config.primaryEngine;
	}

	getPrimaryEngineLabel(): string {
		return ENGINE_NAMES[this.config.primaryEngine];
	}

	getBraveApiKey(): string {
		return this.config.braveApiKey;
	}

	getMaxResults(): number {
		return this.config.maxResults;
	}
}
