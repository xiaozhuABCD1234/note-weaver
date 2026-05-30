import { App, TFile } from "obsidian";

export function getNotesByTags(app: App, file: TFile): Map<string, string> {
	const result = new Map<string, string>();
	const fileCache = app.metadataCache.getFileCache(file);
	if (!fileCache) return result;

	const tags = new Set<string>();
	if (fileCache.frontmatter?.tags) {
		const frontTags: unknown = fileCache.frontmatter.tags;
		if (Array.isArray(frontTags)) {
			for (const t of frontTags) {
				tags.add(typeof t === "string" ? t : String(t));
			}
		} else if (typeof frontTags === "string") {
			tags.add(frontTags);
		}
	}
	if (fileCache.tags) {
		for (const t of fileCache.tags) {
			tags.add(t.tag.replace(/^#/, ""));
		}
	}

	if (tags.size === 0) return result;

	const allFiles = app.vault.getMarkdownFiles();
	for (const f of allFiles) {
		if (f.path === file.path) continue;
		const fc = app.metadataCache.getFileCache(f);
		if (!fc) continue;

		const matchingTags: string[] = [];
		for (const t of tags) {
			if (fc.frontmatter?.tags) {
				const ft: unknown = fc.frontmatter.tags;
				if (Array.isArray(ft) && ft.includes(t)) {
					matchingTags.push(t);
					continue;
				}
				if (typeof ft === "string" && ft === t) {
					matchingTags.push(t);
					continue;
				}
			}
			if (fc.tags?.some((it) => it.tag.replace(/^#/, "") === t)) {
				matchingTags.push(t);
			}
		}

		if (matchingTags.length > 0) {
			result.set(f.path, matchingTags.join(", "));
		}
	}

	return result;
}
