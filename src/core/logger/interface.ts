import type { LogEntry } from "./types";

export interface IAgentLogger {
  log(entry: Omit<LogEntry, "id" | "timestamp">): void;
  logLarge(entry: Omit<LogEntry, "id" | "timestamp">): void;
  initialize(): Promise<void>;
}
