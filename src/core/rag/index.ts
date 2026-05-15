import { App, TFile, TFolder } from "obsidian";
import { Chunk, RagConfig, SearchResult } from "./types";
import { chunkText } from "./chunker";
import { createSearcher } from "./searcher";
import { AgentLogger } from "@/core/logger/index";

export type { RagConfig } from "./types";

export const DEFAULT_RAG_CONFIG: RagConfig = {
  enabled: true,
  maxChunks: 5,
  chunkSize: 1000,
  chunkOverlap: 200,
  scope: "current-folder",
};

export class RagEngine {
  private app: App;
  private config: RagConfig;
  private chunks: Chunk[] = [];
  private searcher: ReturnType<typeof createSearcher> | null = null;
  private indexBuilt = false;
  private building = false;
  private logger: AgentLogger;

  constructor(app: App, config: RagConfig, logger: AgentLogger) {
    this.app = app;
    this.config = config;
    this.logger = logger;
  }

  updateConfig(config: Partial<RagConfig>): void {
    this.config = { ...this.config, ...config };
    if (this.indexBuilt) {
      this.searcher = createSearcher(this.chunks);
    }
  }

  getConfig(): RagConfig {
    return { ...this.config };
  }

  async buildIndex(force = false): Promise<void> {
    if (this.building) return;
    if (this.indexBuilt && !force) return;

    this.building = true;
    try {
      const markdownFiles = this.app.vault.getMarkdownFiles();
      const allChunks: Chunk[] = [];

      for (const file of markdownFiles) {
        try {
          const content = await this.app.vault.cachedRead(file);
          const fileChunks = chunkText(content, file.path, file.basename, {
            chunkSize: this.config.chunkSize,
            chunkOverlap: this.config.chunkOverlap,
          });
          allChunks.push(...fileChunks);
        } catch {
          continue;
        }
      }

      this.chunks = allChunks;
      this.searcher = createSearcher(this.chunks);
      this.indexBuilt = true;

      this.logger.log({
        level: "info",
        type: "rag",
        message: `RAG 索引构建完成`,
        data: { fileCount: markdownFiles.length, chunkCount: allChunks.length },
      });
    } finally {
      this.building = false;
    }
  }

  isIndexBuilt(): boolean {
    return this.indexBuilt;
  }

  getChunkCount(): number {
    return this.chunks.length;
  }

  getIndexedFileCount(): number {
    const files = new Set(this.chunks.map((c) => c.filePath));
    return files.size;
  }

  async retrieve(query: string, topK?: number): Promise<SearchResult[]> {
    if (!this.config.enabled) return [];
    if (!query.trim()) return [];

    if (!this.indexBuilt) {
      await this.buildIndex();
    }

    const k = topK ?? this.config.maxChunks;
    if (!this.searcher) return [];

    let results = this.searcher.search(query, k);

    if (this.config.scope === "current-folder") {
      const folderPath = this.getCurrentFolderPath();
      if (!folderPath) return [];
      results = results.filter(
        (r) =>
          r.chunk.filePath === folderPath ||
          r.chunk.filePath.startsWith(folderPath + "/"),
      );
    }

    this.logger.log({
      level: "debug",
      type: "rag",
      message: `RAG 检索: "${query.slice(0, 200)}"`,
      data: {
        query: query,
        resultCount: results.length,
        topScore: results.length > 0 ? results[0]!.score : 0,
        scope: this.config.scope,
      },
    });

    return results;
  }

  async getContextForQuery(query: string): Promise<string> {
    const results = await this.retrieve(query);
    if (results.length === 0) return "";

    const parts: string[] = [];
    parts.push("以下是与当前问题相关的 Vault 笔记内容：\n");

    for (const result of results) {
      const { chunk, score } = result;
      const headingInfo = chunk.heading
        ? ` > ${chunk.heading}`
        : "";
      parts.push(`📄 笔记: ${chunk.filePath}${headingInfo}`);
      parts.push(`--- 相关片段 (相关度: ${score.toFixed(2)}) ---`);
      parts.push(chunk.content);
      parts.push("---\n");
    }

    return parts.join("\n");
  }

  async getNoteByPath(path: string): Promise<Chunk | null> {
    const file = this.app.vault.getFileByPath(path);
    if (!file) return null;

    try {
      const content = await this.app.vault.cachedRead(file);
      return {
        content,
        filePath: file.path,
        fileName: file.basename,
        heading: null,
        startPos: 0,
        endPos: content.length,
      };
    } catch {
      return null;
    }
  }

  async getNotesByPaths(paths: string[]): Promise<Chunk[]> {
    const results: Chunk[] = [];
    for (const path of paths) {
      const chunk = await this.getNoteByPath(path);
      if (chunk) {
        results.push(chunk);
      }
    }
    return results;
  }

  async searchNotes(query: string): Promise<{ file: TFile; snippet: string; score: number }[]> {
    const results = await this.retrieve(query, this.config.maxChunks);

    const fileMap = new Map<string, { file: TFile; snippet: string; score: number }>();
    for (const r of results) {
      const existing = fileMap.get(r.chunk.filePath);
      if (!existing || r.score > existing.score) {
        const file = this.app.vault.getFileByPath(r.chunk.filePath);
        if (file) {
          fileMap.set(r.chunk.filePath, {
            file,
            snippet: r.chunk.content.slice(0, 200),
            score: r.score,
          });
        }
      }
    }

    return Array.from(fileMap.values()).sort((a, b) => b.score - a.score);
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

  onFileCreated(file: TFile): void {
    void this.handleFileChange(file);
  }

  onFileModified(file: TFile): void {
    void this.handleFileChange(file);
  }

  onFileDeleted(filePath: string): void {
    const before = this.chunks.length;
    this.chunks = this.chunks.filter((c) => c.filePath !== filePath);
    if (this.chunks.length !== before && this.searcher) {
      this.searcher = createSearcher(this.chunks);
    }
  }

  private getCurrentFolderPath(): string | null {
    const activeFile = this.app.workspace.getActiveFile();
    if (!activeFile) return null;
    return activeFile.parent?.path ?? null;
  }

  private async handleFileChange(file: TFile): Promise<void> {
    if (file.extension !== "md") return;
    this.onFileDeleted(file.path);

    try {
      const content = await this.app.vault.cachedRead(file);
      const fileChunks = chunkText(content, file.path, file.basename, {
        chunkSize: this.config.chunkSize,
        chunkOverlap: this.config.chunkOverlap,
      });
      this.chunks.push(...fileChunks);
      if (this.searcher) {
        this.searcher = createSearcher(this.chunks);
      }
    } catch {
      // ignore read errors
    }
  }
}
