import { App } from "obsidian";

export async function keywordSearch(app: App, query: string): Promise<Map<string, number>> {
	const result = new Map<string, number>();
	const q = query.toLowerCase();

	const files = app.vault.getMarkdownFiles();
	for (const file of files) {
		try {
			const content = await app.vault.cachedRead(file);
			let count = 0;
			let idx = 0;
			while ((idx = content.toLowerCase().indexOf(q, idx)) !== -1) {
				count++;
				idx += q.length;
			}
			if (count > 0) {
				result.set(file.path, count);
			}
		} catch {
			continue;
		}
	}

	return result;
}
