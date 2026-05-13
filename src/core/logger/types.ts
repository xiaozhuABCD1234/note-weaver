export interface LogEntry {
  id: string;
  timestamp: string;
  level: "debug" | "info" | "warn" | "error";
  type: "chat" | "tool" | "rag" | "api" | "system" | "command";
  message: string;
  data?: Record<string, unknown>;
  truncated?: string[];
}

export interface LoggerConfig {
  enabled: boolean;
  maxEntryLength: number;
  maxFileSize: number;
  retentionDays: number;
}

export const DEFAULT_LOGGER_CONFIG: LoggerConfig = {
  enabled: true,
  maxEntryLength: 5000,
  maxFileSize: 1 * 1024 * 1024,
  retentionDays: 7,
};
