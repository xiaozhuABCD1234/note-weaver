import { describe, it, expect } from "@jest/globals";
import { truncateToolResult } from "../result-compressor";

describe("truncateToolResult", () => {
  it("returns content unchanged when under limit", () => {
    const result = truncateToolResult("read_note", "short content");
    expect(result).toBe("short content");
  });

  it("truncates content when over limit", () => {
    const longContent = "x".repeat(5000);
    const result = truncateToolResult("read_note", longContent);
    expect(result.length).toBeLessThan(5000);
    expect(result).toContain("[...截断:");
  });

  it("applies different limits per tool", () => {
    const content = "x".repeat(5000);
    const readResult = truncateToolResult("read_note", content);
    expect(readResult).toContain("[...截断:");

    const webResult = truncateToolResult("fetch_webpage", content);
    expect(webResult).toContain("[...截断:");
  });

  it("handles empty content", () => {
    const result = truncateToolResult("read_note", "");
    expect(result).toBe("");
  });
});
