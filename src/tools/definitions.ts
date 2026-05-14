import type { ToolDefinition } from "@/types";

function baseToolDefinitions(): ToolDefinition[] {
	return [
		{
			type: "function" as const,
			function: {
				name: "read_note",
				description: "读取 vault 中指定路径的笔记完整内容。当用户询问某篇笔记内容或需要分析笔记时使用",
				parameters: {
					type: "object",
					properties: {
						path: { type: "string", description: "笔记路径，相对于 vault 根目录，如 '日记/2024-01-01.md'" },
					},
					required: ["path"],
				},
			},
		},
		{
			type: "function" as const,
			function: {
				name: "search_notes",
				description: "按文件名或路径搜索 vault 中的笔记。返回匹配的文件路径列表。适用于用户记得文件名但不确定位置时",
				parameters: {
					type: "object",
					properties: {
						query: { type: "string", description: "搜索关键词，匹配文件名和路径" },
					},
					required: ["query"],
				},
			},
		},
		{
			type: "function" as const,
			function: {
				name: "search_content",
				description: "在所有 Markdown 笔记中搜索文本内容。返回匹配的文件路径及周围上下文片段。适用于需要按内容查找笔记时",
				parameters: {
					type: "object",
					properties: {
						query: { type: "string", description: "要搜索的文本内容关键词" },
					},
					required: ["query"],
				},
			},
		},
		{
			type: "function" as const,
			function: {
				name: "list_folder",
				description: "列出 vault 中指定文件夹内的文件和子文件夹。适用于浏览 vault 目录结构，查看某文件夹下有什么内容",
				parameters: {
					type: "object",
					properties: {
						path: { type: "string", description: "文件夹路径，相对于 vault 根目录。留空则列出根目录" },
					},
					required: [],
				},
			},
		},
		{
			type: "function" as const,
			function: {
				name: "web_search",
				description: "通过 DuckDuckGo 搜索互联网获取实时信息。适用于查询实时新闻、百科知识、最新资讯等 vault 中无法找到的信息",
				parameters: {
					type: "object",
					properties: {
						query: { type: "string", description: "搜索关键词，使用自然语言描述即可" },
					},
					required: ["query"],
				},
			},
		},
		{
			type: "function" as const,
			function: {
				name: "fetch_webpage",
				description: "抓取指定 URL 网页的可读文本内容。适用于阅读在线文章、文档或任何网页内容。通常配合 web_search 使用：先搜索找到链接，再用此工具获取详细内容",
				parameters: {
					type: "object",
					properties: {
						url: { type: "string", description: "完整的网页 URL，如 https://example.com/article" },
					},
					required: ["url"],
				},
			},
		},
	];
}

function subAgentBaseToolDefinitions(): ToolDefinition[] {
	return [
		{
			type: "function" as const,
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
		},
		{
			type: "function" as const,
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
		},
		{
			type: "function" as const,
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
		},
		{
			type: "function" as const,
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
		},
		{
			type: "function" as const,
			function: {
				name: "web_search",
				description: "通过 DuckDuckGo 搜索互联网获取实时信息",
				parameters: {
					type: "object",
					properties: {
						query: { type: "string", description: "搜索关键词，使用自然语言描述即可" },
					},
					required: ["query"],
				},
			},
		},
		{
			type: "function" as const,
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
		},
	];
}

export function getToolDefinitions(): ToolDefinition[] {
	return [
		...baseToolDefinitions(),
		{
			type: "function" as const,
			function: {
				name: "write_note",
				description: "创建新笔记或覆盖已有笔记。同时支持创建新文件和更新现有文件。content 为完整笔记内容（Markdown 格式）",
				parameters: {
					type: "object",
					properties: {
						path: { type: "string", description: "笔记路径，相对于 vault 根目录，如 '项目/需求分析.md'" },
						content: { type: "string", description: "笔记完整内容，使用 Markdown 格式" },
					},
					required: ["path", "content"],
				},
			},
		},
		{
			type: "function" as const,
			function: {
				name: "append_note",
				description: "向已有笔记末尾追加内容。适用于在笔记底部添加新信息，不会修改已有内容",
				parameters: {
					type: "object",
					properties: {
						path: { type: "string", description: "笔记路径" },
						content: { type: "string", description: "要追加的内容" },
					},
					required: ["path", "content"],
				},
			},
		},
		{
			type: "function" as const,
			function: {
				name: "delete_note",
				description: "永久删除 vault 中的笔记。注意：此操作不可逆，建议先与用户确认再执行",
				parameters: {
					type: "object",
					properties: {
						path: { type: "string", description: "要删除的笔记路径" },
					},
					required: ["path"],
				},
			},
		},
		{
			type: "function" as const,
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
		},
		{
			type: "function" as const,
			function: {
				name: "delegate_task",
				description: "将需要大量信息收集、调研或分析的复杂任务委派给子 Agent 执行。子 Agent 可以读取笔记、搜索内容、搜索互联网，但不会直接修改笔记。适用于复杂调研任务分解",
				parameters: {
					type: "object",
					properties: {
						prompt: { type: "string", description: "子 Agent 需要完成的任务描述，需清晰说明目标和输出要求" },
					},
					required: ["prompt"],
				},
			},
		},
	];
}

export function getSubAgentToolDefinitions(): ToolDefinition[] {
	return subAgentBaseToolDefinitions();
}
