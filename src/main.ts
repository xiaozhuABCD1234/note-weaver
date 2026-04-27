import { Plugin, WorkspaceLeaf } from "obsidian";
import OpenAI from "openai";
import {
	DEFAULT_SETTINGS,
	NoteWeaverSettings,
	NoteWeaverSettingTab,
} from "./settings";
import { ChatView, VIEW_TYPE_EXAMPLE } from "./view";
import { ChatMessage, chatStream, createOpenAIClient } from "./api";

export default class NoteWeaver extends Plugin {
	settings!: NoteWeaverSettings;

	async onload() {
		await this.loadSettings();

		const statusBarItemEl = this.addStatusBarItem();
		// eslint-disable-next-line obsidianmd/ui/sentence-case
		statusBarItemEl.setText("Note Weaver 已加载");

		this.addSettingTab(new NoteWeaverSettingTab(this.app, this));

		this.registerView(VIEW_TYPE_EXAMPLE, (leaf) => new ChatView(leaf, this));

		this.addRibbonIcon("bot", "AI 助手", async () => {
			await this.activateView();
		});
	}

	onunload() {}

	/**
	 * 激活或创建插件视图
	 * 如果视图已存在则切换到该视图，否则创建新视图
	 */
	async activateView() {
		// 获取工作区实例
		const { workspace } = this.app;

		// 定义一个可变的 leaf 变量，用于存储视图所在的页面
		let leaf: WorkspaceLeaf | null = null;

		// 查找当前已打开的同类型视图
		const leaves = workspace.getLeavesOfType(VIEW_TYPE_EXAMPLE);

		// 如果已存在该类型的视图，直接复用
		if (leaves.length > 0) {
			leaf = leaves[0] ?? null;
		} else {
			// 如果不存在，创建新的侧边栏页面
			leaf = workspace.getRightLeaf(false);
			// 检查 leaf 是否成功创建
			if (!leaf) {
				return;
			}
			// 设置视图状态，激活并显示
			await leaf.setViewState({ type: VIEW_TYPE_EXAMPLE, active: true });
		}
		// 切换到并显示该视图页面
		if (leaf) {
			await workspace.revealLeaf(leaf);
		}
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
		return createOpenAIClient(this.settings.baseUrl, this.settings.apiKey);
	}

	getChatStream(messages: ChatMessage[], signal?: AbortSignal) {
		const client = this.getOpenAIClient();
		return chatStream(client, this.settings.modelName, messages, signal);
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
			apiKey: this.settings.apiKey,
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
				messages: [{ role: "user", content: "test" }],
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
