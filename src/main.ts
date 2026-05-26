import { Notice, Plugin, WorkspaceLeaf } from "obsidian";
import OpenAI from "openai";
import { DEFAULT_SETTINGS, NoteWeaverSettings } from "./settings";
import { NoteWeaverSettingTab } from "./settings-tab";
import { ChatView, VIEW_TYPE_CHAT } from "./chat/view";
import { RagEngine } from "./core/rag/index";
import { VaultService } from "./services/vault-service";
import { SubAgentService } from "./services/sub-agent-service";
import { AgentLogger } from "./core/logger/index";
import { WebService } from "./services/web-service";
import { KnowledgeService } from "./services/knowledge-service";
import { ToolGateway, AgentRuntime } from "./core/agent";
import { OpenAIChatClient } from "./core/llm";
import { QuickAskController } from "./features/quick-ask";

export default class NoteWeaver extends Plugin {
	settings!: NoteWeaverSettings;
	ragEngine!: RagEngine;
	vaultService!: VaultService;
	webService!: WebService;
	knowledgeService!: KnowledgeService;
	logger!: AgentLogger;
	toolGateway!: ToolGateway;
	agentRuntime!: AgentRuntime;

	async onload() {
		await this.loadSettings();

		this.logger = new AgentLogger(
			this.app.vault.adapter,
			`${this.app.vault.configDir}/plugins/note-weaver/logs`,
		);
		await this.logger.initialize();

		this.logger.log({
			level: "info",
			type: "system",
			message: "Note Weaver 插件已加载",
			data: { version: this.manifest.version },
		});

		this.webService = new WebService(
			this.settings.webSearchMaxResults,
			this.logger,
			this.settings.webSearchEnabled,
			this.settings.webSearchEngine,
			this.settings.braveSearchApiKey,
		);
		this.ragEngine = new RagEngine(
			this.app,
			this.settings.rag,
			() => this.settings.knowledgeBasePath,
		);
		this.knowledgeService = new KnowledgeService(
			this.app,
			() => this.settings.knowledgeBasePath,
		);

		const subAgentClient = new OpenAIChatClient({
			baseUrl: this.settings.baseUrl,
			apiKey: this.decodeApiKey(this.settings.apiKey),
			model: this.settings.modelName,
			maxTokens: this.settings.maxTokens,
			thinkingMode: this.settings.thinkingMode,
			reasoningEffort: this.settings.reasoningEffort,
		});

		const subAgentService = new SubAgentService(
			subAgentClient,
			{
				model: this.settings.modelName,
				maxTokens: this.settings.maxTokens,
				maxToolRounds: 5,
				thinkingMode: this.settings.thinkingMode,
				reasoningEffort: this.settings.reasoningEffort,
			},
			this.logger,
		);

		this.vaultService = new VaultService(
			this.app,
			this.logger,
			this.webService,
			subAgentService,
			this.knowledgeService,
		);
		subAgentService.setToolExecutor((calls) =>
			this.vaultService.executeToolCalls(calls),
		);

		this.toolGateway = new ToolGateway();
		this.vaultService.registerTools(this.toolGateway);

		const llmClient = new OpenAIChatClient({
			baseUrl: this.settings.baseUrl,
			apiKey: this.decodeApiKey(this.settings.apiKey),
			model: this.settings.modelName,
			maxTokens: this.settings.maxTokens,
			thinkingMode: this.settings.thinkingMode,
			reasoningEffort: this.settings.reasoningEffort,
		});

		this.agentRuntime = new AgentRuntime(
			llmClient,
			this.toolGateway,
			{
				model: this.settings.modelName,
				maxTokens: this.settings.maxTokens,
				maxToolRounds: 10,
				thinkingMode: this.settings.thinkingMode,
				reasoningEffort: this.settings.reasoningEffort,
			},
		);

		const quickAskClient = new OpenAIChatClient({
			baseUrl: this.settings.baseUrl,
			apiKey: this.decodeApiKey(this.settings.apiKey),
			model: this.settings.modelName,
			maxTokens: Math.min(this.settings.maxTokens, 4096),
			thinkingMode: false,
			reasoningEffort: "high",
		});

		const quickAskController = new QuickAskController(this.app, {
			icClient: quickAskClient,
			config: this.settings.quickAsk,
		});
		quickAskController.load();
		this.register(() => quickAskController.unload());

		const statusBarItemEl = this.addStatusBarItem();
		// eslint-disable-next-line obsidianmd/ui/sentence-case
		statusBarItemEl.setText("Note Weaver 已加载");

		this.addSettingTab(new NoteWeaverSettingTab(this.app, this));

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
					leaf.view.setPendingSelection(selection);
					new Notice("已读取选中文本，请在 AI 助手中输入修改要求");
				}
			},
		});

		this.registerView(
			VIEW_TYPE_CHAT,
			(leaf) =>
				new ChatView(leaf, {
					agentRuntime: this.agentRuntime,
					ragEngine: this.ragEngine,
					settings: this.settings,
					logger: this.logger,
				}),
		);

		this.addRibbonIcon("bot", "AI 助手", async () => {
			await this.activateView();
		});
	}

	onunload() {
		this.logger.log({
			level: "info",
			type: "system",
			message: "Note Weaver 插件已卸载",
		});
	}

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

	private decodeApiKey(encoded: string): string {
		try {
			return atob(encoded);
		} catch {
			return encoded;
		}
	}

	async validateConfig(): Promise<[boolean, string]> {
		const client = new OpenAI({
			baseURL: this.settings.baseUrl,
			apiKey: this.decodeApiKey(this.settings.apiKey),
			dangerouslyAllowBrowser: true,
		});

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
