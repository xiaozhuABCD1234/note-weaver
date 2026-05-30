import { App, TFile } from "obsidian";

export function getForwardLinks(app: App, file: TFile, linkDepth: number): Map<string, number> {
	const result = new Map<string, number>();
	const visited = new Set<string>();
	traverseForwardLinks(app, file.path, linkDepth, linkDepth, visited, result);
	result.delete(file.path);
	return result;
}

function traverseForwardLinks(
	app: App,
	filePath: string,
	linkDepth: number,
	remainingDepth: number,
	visited: Set<string>,
	result: Map<string, number>,
): void {
	if (visited.has(filePath)) return;
	visited.add(filePath);
	if (remainingDepth <= 0) return;

	const links = app.metadataCache.resolvedLinks[filePath];
	if (!links) return;

	const currentDepth = linkDepth - remainingDepth + 1;
	for (const targetPath of Object.keys(links)) {
		if (targetPath === filePath) continue;
		if (!result.has(targetPath)) {
			result.set(targetPath, currentDepth);
		}
		traverseForwardLinks(app, targetPath, linkDepth, remainingDepth - 1, visited, result);
	}
}

export function getBacklinks(app: App, file: TFile): Map<string, string> {
	const result = new Map<string, string>();
	const filePath = file.path;
	for (const [sourcePath, links] of Object.entries(app.metadataCache.resolvedLinks)) {
		if (sourcePath === filePath) continue;
		if (links && filePath in links) {
			result.set(sourcePath, sourcePath);
		}
	}
	return result;
}
