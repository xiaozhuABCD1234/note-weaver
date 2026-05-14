export interface CompressionBudget {
  maxChars: number;
  perTool?: Record<string, number>;
}

const DEFAULT_BUDGET: CompressionBudget = {
  maxChars: 12000,
  perTool: {
    read_note: 3000,
    search_content: 2000,
    fetch_webpage: 4000,
  },
};

let currentBudget = DEFAULT_BUDGET;

export function setCompressionBudget(budget: Partial<CompressionBudget>): void {
  currentBudget = { ...DEFAULT_BUDGET, ...budget };
}

export function resetCompressionBudget(): void {
  currentBudget = DEFAULT_BUDGET;
}

export function truncateToolResult(toolName: string, content: string): string {
  const limit = currentBudget.perTool?.[toolName];
  if (!limit || content.length <= limit) return content;

  const headLen = Math.floor(limit * 0.6);
  const tailLen = limit - headLen - 50;
  return (
    content.slice(0, headLen) +
    `\n\n[...截断: 原始 ${content.length} 字符, 保留首尾各 ${headLen}/${tailLen} 字符...]\n\n` +
    content.slice(-tailLen)
  );
}

export function progressiveCompress(content: string): string {
  if (content.length <= 500) return content;

  if (content.length <= 2000) {
    const keepLen = Math.floor(content.length * 0.5);
    const headLen = Math.floor(keepLen * 0.7);
    const tailLen = keepLen - headLen;
    return (
      content.slice(0, headLen) +
      `\n\n[...渐进压缩: ${content.length}→${keepLen} 字符...]\n\n` +
      content.slice(-tailLen)
    );
  }

  return (
    content.slice(0, 400) +
    `\n\n[...渐进压缩: ${content.length}→约 600 字符...]\n\n` +
    content.slice(-200)
  );
}
