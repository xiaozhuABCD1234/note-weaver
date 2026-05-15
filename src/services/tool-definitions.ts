import type { ToolDefinition } from "@/types";

export const READ_NOTE_DEFINITION: ToolDefinition = {
	type: "function",
	function: {
		name: "read_note",
		description: "读取 vault 中指定路径的笔记完整内容",
		parameters: {
			type: "object",
			properties: {
				path: { type: "string", description: "笔记路径，相对于 vault 根目录" },
			},
			required: ["path"],
		},
	},
};

export const SEARCH_NOTES_DEFINITION: ToolDefinition = {
	type: "function",
	function: {
		name: "search_notes",
		description: "按文件名或路径搜索 vault 中的笔记，返回匹配的文件路径列表",
		parameters: {
			type: "object",
			properties: {
				query: { type: "string", description: "搜索关键词，匹配文件名和路径" },
			},
			required: ["query"],
		},
	},
};

export const SEARCH_CONTENT_DEFINITION: ToolDefinition = {
	type: "function",
	function: {
		name: "search_content",
		description: "在所有 Markdown 笔记中搜索文本内容，返回匹配的文件路径及周围上下文片段",
		parameters: {
			type: "object",
			properties: {
				query: { type: "string", description: "要搜索的文本内容关键词" },
			},
			required: ["query"],
		},
	},
};

export const LIST_FOLDER_DEFINITION: ToolDefinition = {
	type: "function",
	function: {
		name: "list_folder",
		description: "列出 vault 中指定文件夹内的文件和子文件夹",
		parameters: {
			type: "object",
			properties: {
				path: { type: "string", description: "文件夹路径，相对于 vault 根目录。留空则列出根目录" },
			},
			required: [],
		},
	},
};

export const WEB_SEARCH_DEFINITION: ToolDefinition = {
	type: "function",
	function: {
		name: "web_search",
		description: "通过 DuckDuckGo 搜索互联网获取实时信息",
		parameters: {
			type: "object",
			properties: {
				query: { type: "string", description: "搜索关键词" },
			},
			required: ["query"],
		},
	},
};

export const FETCH_WEBPAGE_DEFINITION: ToolDefinition = {
	type: "function",
	function: {
		name: "fetch_webpage",
		description: "抓取指定 URL 网页的可读文本内容",
		parameters: {
			type: "object",
			properties: {
				url: { type: "string", description: "完整的网页 URL" },
			},
			required: ["url"],
		},
	},
};

export const SHARED_READONLY_DEFINITIONS: ToolDefinition[] = [
	READ_NOTE_DEFINITION,
	SEARCH_NOTES_DEFINITION,
	SEARCH_CONTENT_DEFINITION,
	LIST_FOLDER_DEFINITION,
	WEB_SEARCH_DEFINITION,
	FETCH_WEBPAGE_DEFINITION,
];
