import { Notice, Plugin, TFile, WorkspaceLeaf } from "obsidian";
import OpenAI from "openai";
import {
	DEFAULT_SETTINGS,
	NoteWeaverSettings,
	NoteWeaverSettingTab,
} from "./settings";
import { ChatView, VIEW_TYPE_CHAT } from "./view";
import { ChatMessage, chatStream, createOpenAIClient } from "./api";
import { getSelectedText } from "./note-operations";
import { RagEngine } from "./core/rag/index";

export default class NoteWeaver extends Plugin {
	settings!: NoteWeaverSettings;
	ragEngine!: RagEngine;

	async onload() {
		await this.loadSettings();

		this.ragEngine = new RagEngine(this.app, this.settings.rag);

		const statusBarItemEl = this.addStatusBarItem();
		// eslint-disable-next-line obsidianmd/ui/sentence-case
		statusBarItemEl.setText("Note Weaver 已加载");

		this.addSettingTab(new NoteWeaverSettingTab(this.app, this));

		this.registerEvent(
			this.app.vault.on("create", (file) => {
				if (!(file instanceof TFile)) return;
				this.ragEngine.onFileCreated(file);
			}),
		);

		this.registerEvent(
			this.app.vault.on("modify", (file) => {
				if (!(file instanceof TFile)) return;
				this.ragEngine.onFileModified(file);
			}),
		);

		this.registerEvent(
			this.app.vault.on("delete", (file) => {
				this.ragEngine.onFileDeleted(file.path);
			}),
		);

		this.addCommand({
			id: "ai-modify-selection",
			name: "AI: 修改选中文本",
			editorCallback: async (editor) => {
				const selection = editor.getSelection();
				if (!selection) {
					new Notice("请先在编辑器中选中要修改的文本");
					return;
				}
				const leaf = await this.activateView();
				if (leaf?.view instanceof ChatView) {
					// eslint-disable-next-line @typescript-eslint/no-unsafe-call
					leaf.view.setPendingSelection(selection);
					new Notice("已读取选中文本，请在 AI 助手中输入修改要求");
				}
			},
		});

		this.addCommand({
			id: "rebuild-rag-index",
			name: "重建知识索引",
			callback: async () => {
				await this.buildRagIndex();
			},
		});

		this.registerView(VIEW_TYPE_CHAT, (leaf) => new ChatView(leaf, this));

		this.addRibbonIcon("bot", "AI 助手", async () => {
			await this.activateView();
		});
	}

	onunload() {}

	async buildRagIndex(): Promise<void> {
		new Notice("正在重建知识索引...");
		await this.ragEngine.buildIndex(true);
		new Notice(
			`知识索引重建完成，已索引 ${this.ragEngine.getIndexedFileCount()} 篇笔记，${this.ragEngine.getChunkCount()} 个片段`,
		);
	}

	/**
	 * 激活或创建插件视图
	 * 如果视图已存在则切换到该视图，否则创建新视图
	 */
	async activateView(): Promise<WorkspaceLeaf | null> {
		const { workspace } = this.app;

		let leaf: WorkspaceLeaf | null = null;

		const leaves = workspace.getLeavesOfType(VIEW_TYPE_CHAT);

		if (leaves.length > 0) {
			leaf = leaves[0] ?? null;
		} else {
			leaf = workspace.getRightLeaf(false);
			if (!leaf) {
				return null;
			}
			await leaf.setViewState({ type: VIEW_TYPE_CHAT, active: true });
		}
		if (leaf) {
			await workspace.revealLeaf(leaf);
		}
		return leaf;
	}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			(await this.loadData()) as Partial<NoteWeaverSettings>,
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	getOpenAIClient(): OpenAI {
		return createOpenAIClient(
			this.settings.baseUrl,
			this.decodeApiKey(this.settings.apiKey),
		);
	}

	private decodeApiKey(encoded: string): string {
		try {
			return atob(encoded);
		} catch {
			return encoded;
		}
	}

	getChatStream(messages: ChatMessage[], signal?: AbortSignal) {
		const client = this.getOpenAIClient();
		return chatStream(client, this.settings.modelName, messages, this.settings.maxTokens, signal);
	}

	/**
	 * 验证插件配置的有效性
	 *
	 * 验证步骤:
	 * 1. 检查 URL 和 API Key 是否可以正常连接到 OpenAI 兼容 API
	 * 2. 检查指定模型是否存在且可用
	 *
	 * @returns [boolean, string] - 返回元组，[0] 表示是否配置有效，[1] 为状态消息
	 *
	 * @example
	 * const [isValid, message] = await this.validateConfig();
	 * if (!isValid) {
	 *   new Notice(`配置无效: ${message}`);
	 * }
	 */
	async validateConfig(): Promise<[boolean, string]> {
		const client = new OpenAI({
			baseURL: this.settings.baseUrl,
			apiKey: this.decodeApiKey(this.settings.apiKey),
			dangerouslyAllowBrowser: true,
		});

		// 步骤1: 验证 URL 和 API Key
		try {
			await client.models.list();
		} catch (error) {
			if (error instanceof OpenAI.APIConnectionError) {
				return [false, "无法连接到指定URL"];
			}
			if (error instanceof OpenAI.AuthenticationError) {
				return [false, "API Key 无效"];
			}
			return [
				false,
				`连接失败: ${error instanceof Error ? error.message : String(error)}`,
			];
		}

		// 步骤2: 验证模型
		try {
			await client.chat.completions.create({
				model: this.settings.modelName,
				messages: [{ role: "user", content: "test json" }],
				response_format: { type: "json_object" },
				max_tokens: 1,
			});
			return [true, "所有配置有效"];
		} catch (error) {
			if (error instanceof OpenAI.NotFoundError) {
				return [false, `模型 '${this.settings.modelName}' 不存在`];
			}
			return [
				false,
				`模型验证失败: ${
					error instanceof Error ? error.message : String(error)
				}`,
			];
		}
	}
}
