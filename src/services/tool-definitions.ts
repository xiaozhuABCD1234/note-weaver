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
		description: "搜索互联网获取实时信息（支持 Brave Search / DuckDuckGo）",
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

export const GREP_CONTENT_DEFINITION: ToolDefinition = {
	type: "function",
	function: {
		name: "grep_content",
		description: "用正则表达式搜索 vault 中所有 Markdown 笔记的内容，返回匹配的文件路径、行号及匹配行",
		parameters: {
			type: "object",
			properties: {
				pattern: { type: "string", description: "正则表达式模式（支持 JavaScript RegExp 语法）" },
				caseSensitive: { type: "boolean", description: "是否区分大小写，默认 false" },
				maxResults: { type: "number", description: "最大返回结果数，默认 50" },
			},
			required: ["pattern"],
		},
	},
};

export const SAVE_KNOWLEDGE_DEFINITION: ToolDefinition = {
	type: "function",
	function: {
		name: "save_knowledge",
		description: "将知识点保存到知识库文件夹。创建或更新一篇结构化知识笔记，自动建立 [[wikilinks]] 链接。适用于用户要求整理笔记、提取知识点、构建知识图谱时使用",
		parameters: {
			type: "object",
			properties: {
				title: { type: "string", description: "知识点标题，用作文件名" },
				content: { type: "string", description: "笔记正文（Markdown 格式），正文中可用 [[wikilink]] 指向其他笔记" },
				type: {
					type: "string",
					enum: ["concept", "relationship", "summary", "note"],
					description: "知识类型：concept（概念）、relationship（关系）、summary（摘要）、note（一般笔记）",
				},
				tags: {
					type: "array",
					items: { type: "string" },
					description: "标签列表，用于分类和检索",
				},
				relatedNotes: {
					type: "array",
					items: { type: "string" },
					description: "关联的笔记路径列表（相对于 vault 根目录）。会自动在笔记底部生成关联笔记链接",
				},
			},
			required: ["title", "content", "type", "tags"],
		},
	},
};

export const WRITE_NOTE_DEFINITION: ToolDefinition = {
	type: "function",
	function: {
		name: "write_note",
		description: "创建新笔记或覆盖已有笔记",
		parameters: {
			type: "object",
			properties: {
				path: { type: "string", description: "笔记路径，相对于 vault 根目录" },
				content: { type: "string", description: "笔记完整内容，使用 Markdown 格式" },
			},
			required: ["path", "content"],
		},
	},
};

export const APPEND_NOTE_DEFINITION: ToolDefinition = {
	type: "function",
	function: {
		name: "append_note",
		description: "向已有笔记末尾追加内容",
		parameters: {
			type: "object",
			properties: {
				path: { type: "string", description: "笔记路径" },
				content: { type: "string", description: "要追加的内容" },
			},
			required: ["path", "content"],
		},
	},
};

export const DELETE_NOTE_DEFINITION: ToolDefinition = {
	type: "function",
	function: {
		name: "delete_note",
		description: "将 vault 中的笔记或空文件夹移入回收站。注意：此操作可通过回收站恢复，建议先与用户确认再执行",
		parameters: {
			type: "object",
			properties: {
				path: { type: "string", description: "要删除的笔记或空文件夹路径" },
			},
			required: ["path"],
		},
	},
};

export const RENAME_NOTE_DEFINITION: ToolDefinition = {
	type: "function",
	function: {
		name: "rename_note",
		description: "重命名或移动笔记到新路径。会自动更新 vault 中所有指向该笔记的内部链接",
		parameters: {
			type: "object",
			properties: {
				path: { type: "string", description: "笔记当前路径" },
				newPath: { type: "string", description: "笔记新路径，可用于重命名或移动到不同文件夹" },
			},
			required: ["path", "newPath"],
		},
	},
};

export const EDIT_NOTE_DEFINITION: ToolDefinition = {
	type: "function",
	function: {
		name: "edit_note",
		description: "在笔记中做精确文本替换：查找 oldSnippet 并替换为 newSnippet。适用于修改笔记中的特定段落",
		parameters: {
			type: "object",
			properties: {
				path: { type: "string", description: "笔记路径" },
				oldSnippet: { type: "string", description: "要查找并替换的旧文本" },
				newSnippet: { type: "string", description: "替换后的新文本" },
			},
			required: ["path", "oldSnippet", "newSnippet"],
		},
	},
};

export const GET_NOTE_METADATA_DEFINITION: ToolDefinition = {
	type: "function",
	function: {
		name: "get_note_metadata",
		description: "获取笔记的元数据信息，包括标题、创建时间、修改时间、标签、frontmatter 字段等",
		parameters: {
			type: "object",
			properties: {
				path: { type: "string", description: "笔记路径" },
			},
			required: ["path"],
		},
	},
};

export const DELEGATE_TASK_DEFINITION: ToolDefinition = {
	type: "function",
	function: {
		name: "delegate_task",
		description: "将需要大量信息收集、调研或分析的复杂任务委派给子 Agent 执行",
		parameters: {
			type: "object",
			properties: {
				prompt: { type: "string", description: "子 Agent 需要完成的任务描述" },
			},
			required: ["prompt"],
		},
	},
};

export const LIST_RECENT_NOTES_DEFINITION: ToolDefinition = {
	type: "function",
	function: {
		name: "list_recent_notes",
		description: "列出最近修改的笔记，按修改时间排序。limit 可选，默认返回最近 10 篇",
		parameters: {
			type: "object",
			properties: {
				limit: { type: "number", description: "返回的笔记数量上限，可选" },
			},
			required: [],
		},
	},
};

export const SHARED_READONLY_DEFINITIONS: ToolDefinition[] = [
	READ_NOTE_DEFINITION,
	SEARCH_NOTES_DEFINITION,
	SEARCH_CONTENT_DEFINITION,
	GREP_CONTENT_DEFINITION,
	LIST_FOLDER_DEFINITION,
	WEB_SEARCH_DEFINITION,
	FETCH_WEBPAGE_DEFINITION,
];
