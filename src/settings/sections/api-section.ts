import { Notice, Setting } from "obsidian";
import NoteWeaver from "@/main";

function encode(str: string): string {
	return btoa(str);
}

function decode(str: string): string {
	try {
		return atob(str);
	} catch {
		return str;
	}
}

export function renderApiSection(containerEl: HTMLElement, plugin: NoteWeaver): void {
	new Setting(containerEl).setName("API 设置").setHeading();

	new Setting(containerEl)
		.setName("API key")
		.setDesc("用于调用 LLM API 的密钥。存储时做基础掩码处理。")
		.addText((text) =>
			text
				.setPlaceholder("Sk-...")
				.setValue(decode(plugin.settings.apiKey))
				.onChange(async (value) => {
					plugin.settings.apiKey = encode(value);
					await plugin.saveSettings();
				}),
		)
		.then((setting) => {
			const input = setting.descEl.parentElement?.querySelector(
				'input[type="text"]',
			) as HTMLInputElement | null;
			if (input) {
				input.type = "password";
				input.addEventListener("focus", () => {
					input.type = "text";
				});
				input.addEventListener("blur", () => {
					input.type = "password";
				});
			}
		});

	new Setting(containerEl).setDesc(
		"API key 存储在本地插件配置中，请确保 vault 环境安全。",
	);

	new Setting(containerEl)
		.setName("Base URL")
		.setDesc("API 服务器地址，不同服务商地址不同")
		.addText((text) =>
			text
				.setPlaceholder("https://api.deepseek.com")
				.setValue(plugin.settings.baseUrl)
				.onChange(async (value) => {
					plugin.settings.baseUrl = value;
					await plugin.saveSettings();
				}),
		);

	new Setting(containerEl)
		.setName("Model")
		.setDesc("要使用的模型名称，如 gpt-4、claude-3-5-sonnet")
		.addText((text) =>
			text
				.setPlaceholder("deepseek-v4-flash")
				.setValue(plugin.settings.modelName)
				.onChange(async (value) => {
					plugin.settings.modelName = value;
					await plugin.saveSettings();
				}),
		);

	new Setting(containerEl)
		.setName("Max tokens")
		.setDesc("每次请求的最大 token 数")
		.addText((text) =>
			text
				.setPlaceholder("16384")
				.setValue(String(plugin.settings.maxTokens))
				.onChange(async (value) => {
					const num = parseInt(value, 10);
					if (!isNaN(num) && num > 0) {
						plugin.settings.maxTokens = num;
						await plugin.saveSettings();
					}
				}),
		);

	new Setting(containerEl)
		.setName("验证连接")
		.setDesc("测试当前 API 配置是否可用")
		.addButton((button) =>
			button.setButtonText("验证").onClick(async () => {
				button.setDisabled(true);
				button.setButtonText("验证中...");
				const [, msg] = await plugin.validateConfig();
				new Notice(msg);
				button.setDisabled(false);
				button.setButtonText("验证");
			}),
		);
}
