import { DataAdapter, normalizePath } from "obsidian";
import { LogEntry, LoggerConfig, DEFAULT_LOGGER_CONFIG } from "./types";

function generateId(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export class AgentLogger {
  private adapter: DataAdapter;
  private config: LoggerConfig;
  private logDir: string;

  constructor(adapter: DataAdapter, logDir: string, config?: Partial<LoggerConfig>) {
    this.adapter = adapter;
    this.config = { ...DEFAULT_LOGGER_CONFIG, ...config };
    this.logDir = normalizePath(logDir);
  }

  private truncateValue(
    value: unknown,
    maxLen: number,
  ): { value: unknown; truncated: boolean } {
    if (typeof value === "string" && value.length > maxLen) {
      return {
        value:
          value.slice(0, maxLen) +
          `... [截断, 原文 ${value.length} 字符]`,
        truncated: true,
      };
    }
    if (typeof value === "object" && value !== null) {
      const result: Record<string, unknown> = {};
      let truncated = false;
      for (const [key, val] of Object.entries(
        value as Record<string, unknown>,
      )) {
        const processed = this.truncateValue(val, maxLen);
        result[key] = processed.value;
        if (processed.truncated) truncated = true;
      }
      return { value: result, truncated };
    }
    return { value, truncated: false };
  }

  logLarge(entry: Omit<LogEntry, "id" | "timestamp">): void {
    if (!this.config.enabled) return;
    const fullEntry: LogEntry = {
      id: generateId(),
      timestamp: new Date().toISOString(),
      ...entry,
    };
    this.writeEntry(fullEntry).catch(() => {});
  }

  log(entry: Omit<LogEntry, "id" | "timestamp">): void {
    if (!this.config.enabled) return;

    const truncatedFields: string[] = [];

    const processedMessage =
      typeof entry.message === "string" &&
      entry.message.length > this.config.maxEntryLength
        ? entry.message.slice(0, this.config.maxEntryLength) +
          `... [截断, 原文 ${entry.message.length} 字符]`
        : entry.message;

    if (processedMessage !== entry.message) {
      truncatedFields.push("message");
    }

    const processedData: Record<string, unknown> = {};
    if (entry.data) {
      for (const [key, val] of Object.entries(entry.data)) {
        const processed = this.truncateValue(val, this.config.maxEntryLength);
        if (processed.truncated) truncatedFields.push(key);
        processedData[key] = processed.value;
      }
    }

    const fullEntry: LogEntry = {
      id: generateId(),
      timestamp: new Date().toISOString(),
      ...entry,
      message: processedMessage,
      data: processedData,
    };

    if (truncatedFields.length > 0) {
      fullEntry.truncated = truncatedFields;
    }

    this.writeEntry(fullEntry).catch(() => {});
  }

  private async writeEntry(entry: LogEntry): Promise<void> {
    try {
      const dateStr = new Date().toISOString().slice(0, 10);
      const logFile = `${this.logDir}/${dateStr}.jsonl`;

      const dirExists = await this.adapter.exists(this.logDir);
      if (!dirExists) {
        await this.adapter.mkdir(this.logDir);
      }

      const line = JSON.stringify(entry) + "\n";
      await this.adapter.append(logFile, line);

      await this.rotateIfNeeded(logFile);
    } catch {
      // silently fail - logging should never break the plugin
    }
  }

  private async rotateIfNeeded(logFile: string): Promise<void> {
    try {
      const stat = await this.adapter.stat(logFile);
      if (stat && stat.size > this.config.maxFileSize) {
        const archiveFile = logFile.replace(
          ".jsonl",
          `.${Date.now()}.jsonl`,
        );
        const content = await this.adapter.read(logFile);
        await this.adapter.write(archiveFile, content);
        await this.adapter.write(logFile, "");
      }
    } catch {
      // ignore rotation errors
    }
  }

  private async cleanupOldLogs(): Promise<void> {
    try {
      if (!(await this.adapter.exists(this.logDir))) return;

      const listed = await this.adapter.list(this.logDir);
      const cutoff = Date.now() - this.config.retentionDays * 86400000;

      for (const file of listed.files) {
        const stat = await this.adapter.stat(file);
        if (stat && stat.mtime < cutoff) {
          await this.adapter.remove(file).catch(() => {});
        }
      }
    } catch {
      // ignore cleanup errors
    }
  }

  async initialize(): Promise<void> {
    await this.cleanupOldLogs();
  }
}
