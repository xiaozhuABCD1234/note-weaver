import { App, TFile, TFolder } from "obsidian";
import { RagConfig, RelatedNote } from "./types";

export type { RagConfig } from "./types";

export const DEFAULT_RAG_CONFIG: RagConfig = {
  enabled: true,
  maxRelatedNotes: 5,
  scope: "current-folder",
  includeForwardLinks: true,
  includeBacklinks: true,
  includeTagMatches: true,
  linkDepth: 2,
};

export class RagEngine {
  private app: App;
  private config: RagConfig;
  private getKbPath: () => string;

  constructor(app: App, config: RagConfig, getKbPath?: () => string) {
    this.app = app;
    this.config = config;
    this.getKbPath = getKbPath ?? (() => "");
  }

  updateConfig(config: Partial<RagConfig>): void {
    this.config = { ...this.config, ...config };
  }

  getConfig(): RagConfig {
    return { ...this.config };
  }

  async getContextForQuery(_query: string): Promise<string> {
    if (!this.config.enabled) return "";

    const currentFile = this.app.workspace.getActiveFile();
    if (!currentFile) return "";

    const related = await this.collectRelatedNotes(currentFile, _query);
    if (related.length === 0) return "";

    const parts: string[] = [];
    parts.push("## 联想笔记\n");

    for (const note of related) {
      const content = await this.readNoteContent(note.path);
      if (!content) continue;
      parts.push(`相关笔记: ${note.path}（${note.reason}）`);
      parts.push("完整内容：");
      parts.push("```markdown");
      parts.push(content);
      parts.push("```\n");
    }

    return parts.join("\n");
  }

  private async collectRelatedNotes(
    currentFile: TFile,
    query: string,
  ): Promise<RelatedNote[]> {
    const seen = new Map<string, { reason: string; score: number }>();

    if (this.config.includeForwardLinks) {
      const forwardLinks = this.getForwardLinks(currentFile, 1);
      for (const [path, depth] of forwardLinks) {
        if (!seen.has(path)) {
          seen.set(path, {
            reason: `正向链接（第${depth}层）`,
            score: 100 - depth,
          });
        }
      }
    }

    if (this.config.includeBacklinks) {
      const backlinks = this.getBacklinks(currentFile);
      for (const [path] of backlinks) {
        if (!seen.has(path)) {
          seen.set(path, { reason: "反向链接", score: 80 });
        }
      }
    }

    if (this.config.includeTagMatches) {
      const tagMatches = this.getNotesByTags(currentFile);
      for (const [path, tags] of tagMatches) {
        if (!seen.has(path)) {
          seen.set(path, {
            reason: `标签匹配（${tags}）`,
            score: 60,
          });
        }
      }
    }

    if (query.trim() && seen.size < this.config.maxRelatedNotes) {
      const keywordMatches = await this.keywordSearch(query);
      for (const [path, count] of keywordMatches) {
        if (!seen.has(path)) {
          seen.set(path, {
            reason: "关键词匹配",
            score: 40 + Math.min(count, 10),
          });
        }
      }
    }

    let results = Array.from(seen.entries()).map(([path, info]) => ({
      path,
      reason: info.reason,
      score: info.score,
    }));

    if (this.config.scope === "current-folder") {
      const folderPath = this.getCurrentFolderPath();
      if (folderPath) {
        results = results.filter(
          (r) =>
            r.path === folderPath || r.path.startsWith(folderPath + "/"),
        );
      }
    }

    const kbPath = this.getKbPath();
    if (kbPath) {
      for (const r of results) {
        if (r.path.startsWith(kbPath + "/") || r.path === kbPath) {
          r.score += 30;
        }
      }
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, this.config.maxRelatedNotes);
  }

  private getForwardLinks(file: TFile, depth: number): Map<string, number> {
    const result = new Map<string, number>();
    const visited = new Set<string>();
    this.traverseForwardLinks(file.path, depth, visited, result);
    result.delete(file.path);
    return result;
  }

  private traverseForwardLinks(
    filePath: string,
    remainingDepth: number,
    visited: Set<string>,
    result: Map<string, number>,
  ): void {
    if (visited.has(filePath)) return;
    visited.add(filePath);
    if (remainingDepth <= 0) return;

    const links = this.app.metadataCache.resolvedLinks[filePath];
    if (!links) return;

    const currentDepth = this.config.linkDepth - remainingDepth + 1;
    for (const targetPath of Object.keys(links)) {
      if (targetPath === filePath) continue;
      if (!result.has(targetPath)) {
        result.set(targetPath, currentDepth);
      }
      this.traverseForwardLinks(
        targetPath,
        remainingDepth - 1,
        visited,
        result,
      );
    }
  }

  private getBacklinks(file: TFile): Map<string, string> {
    const result = new Map<string, string>();
    const filePath = file.path;
    for (const [sourcePath, links] of Object.entries(
      this.app.metadataCache.resolvedLinks,
    )) {
      if (sourcePath === filePath) continue;
      if (links && filePath in links) {
        result.set(sourcePath, sourcePath);
      }
    }
    return result;
  }

  private getNotesByTags(file: TFile): Map<string, string> {
    const result = new Map<string, string>();
    const fileCache = this.app.metadataCache.getFileCache(file);
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

    const allFiles = this.app.vault.getMarkdownFiles();
    for (const f of allFiles) {
      if (f.path === file.path) continue;
      const fc = this.app.metadataCache.getFileCache(f);
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

  private async keywordSearch(query: string): Promise<Map<string, number>> {
    const result = new Map<string, number>();
    const q = query.toLowerCase();

    const files = this.app.vault.getMarkdownFiles();
    for (const file of files) {
      try {
        const content = await this.app.vault.cachedRead(file);
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

  private async readNoteContent(path: string): Promise<string | null> {
    const file = this.app.vault.getAbstractFileByPath(path);
    if (!(file instanceof TFile)) return null;
    try {
      return await this.app.vault.cachedRead(file);
    } catch {
      return null;
    }
  }

  private getCurrentFolderPath(): string | null {
    const activeFile = this.app.workspace.getActiveFile();
    if (!activeFile) return null;
    return activeFile.parent?.path ?? null;
  }

  async getNoteByPath(path: string): Promise<{
    content: string;
    filePath: string;
    fileName: string;
  } | null> {
    const file = this.app.vault.getFileByPath(path);
    if (!file) return null;
    try {
      const content = await this.app.vault.cachedRead(file);
      return { content, filePath: file.path, fileName: file.basename };
    } catch {
      return null;
    }
  }

  async getNotesByPaths(
    paths: string[],
  ): Promise<{ content: string; filePath: string; fileName: string }[]> {
    const results: {
      content: string;
      filePath: string;
      fileName: string;
    }[] = [];
    for (const p of paths) {
      const note = await this.getNoteByPath(p);
      if (note) results.push(note);
    }
    return results;
  }

  async searchNotes(
    query: string,
  ): Promise<{ file: TFile; snippet: string; score: number }[]> {
    const currentFile = this.app.workspace.getActiveFile();
    if (!currentFile) return [];

    const related = await this.collectRelatedNotes(currentFile, query);
    const result: { file: TFile; snippet: string; score: number }[] = [];

    for (const r of related) {
      const file = this.app.vault.getFileByPath(r.path);
      if (!file) continue;
      try {
        const content = await this.app.vault.cachedRead(file);
        result.push({
          file,
          snippet: content.slice(0, 200),
          score: r.score,
        });
      } catch {
        continue;
      }
    }

    return result.sort((a, b) => b.score - a.score);
  }

  listNotesInDir(dirPath: string): TFile[] {
    const folder = this.app.vault.getAbstractFileByPath(dirPath);
    if (!folder || !(folder instanceof TFolder)) return [];

    const files: TFile[] = [];
    for (const child of folder.children) {
      if (child instanceof TFile && child.extension === "md") {
        files.push(child);
      }
    }
    return files.sort((a, b) => a.name.localeCompare(b.name));
  }
}
