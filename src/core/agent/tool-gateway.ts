import type { ToolCall, ToolDefinition } from "@/types";
import type { RegisteredTool, ToolHandler, ToolResult } from "./types";

export class ToolGateway {
  private handlers = new Map<string, ToolHandler>();
  private definitions: ToolDefinition[] = [];

  register(name: string, handler: ToolHandler, definition: ToolDefinition): void {
    if (this.handlers.has(name)) {
      console.warn(`[ToolGateway] Overwriting existing tool: ${name}`);
    }
    this.handlers.set(name, handler);
    this.definitions.push(definition);
  }

  registerMany(tools: RegisteredTool[]): void {
    for (const tool of tools) {
      this.register(tool.name, tool.handler, tool.definition);
    }
  }

  async execute(name: string, args: unknown): Promise<ToolResult> {
    const handler = this.handlers.get(name);
    if (!handler) {
      return { content: `Error: Unknown tool '${name}'`, isError: true };
    }
    try {
      return await handler(args);
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e);
      return { content: `Error: ${errMsg}`, isError: true };
    }
  }

  async executeCalls(calls: ToolCall[]): Promise<ToolResult[]> {
    const results: ToolResult[] = [];
    for (const call of calls) {
      let args: unknown;
      try {
        args = JSON.parse(call.function.arguments);
      } catch {
        results.push({ content: `Error: Invalid JSON arguments for '${call.function.name}'`, isError: true });
        continue;
      }
      const result = await this.execute(call.function.name, args);
      results.push(result);
    }
    return results;
  }

  getDefinitions(): ToolDefinition[] {
    return this.definitions;
  }

  hasTool(name: string): boolean {
    return this.handlers.has(name);
  }

  clear(): void {
    this.handlers.clear();
    this.definitions = [];
  }
}
