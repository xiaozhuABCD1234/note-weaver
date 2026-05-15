export interface QuickAskConfig {
	enabled: boolean;
	triggerChar: string;
	mode: "ask" | "edit" | "continue";
}

export const DEFAULT_QUICK_ASK_CONFIG: QuickAskConfig = {
	enabled: true,
	triggerChar: "@",
	mode: "ask",
};

export interface QuickAskResult {
	content: string;
	accepted: boolean;
}
