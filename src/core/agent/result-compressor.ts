const PER_TOOL_LIMITS: Record<string, number> = {
  read_note: 3000,
  search_content: 2000,
};

export function truncateToolResult(toolName: string, content: string): string {
  const limit = PER_TOOL_LIMITS[toolName];
  if (!limit || content.length <= limit) return content;

  const headLen = Math.floor(limit * 0.6);
  const tailLen = limit - headLen - 50;
  return (
    content.slice(0, headLen) +
    `\n\n[...截断: 原始 ${content.length} 字符, 保留首尾各 ${headLen}/${tailLen} 字符...]\n\n` +
    content.slice(-tailLen)
  );
}
