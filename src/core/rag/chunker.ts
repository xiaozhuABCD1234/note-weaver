import { Chunk } from "./types";

const HEADING_REGEX = /^(#{1,6})\s+(.+)$/gm;

export interface ChunkOptions {
  chunkSize: number;
  chunkOverlap: number;
}

export function chunkText(
  content: string,
  filePath: string,
  fileName: string,
  options: ChunkOptions,
): Chunk[] {
  const headingChunks = chunkByHeadings(content, filePath, fileName);
  if (headingChunks.length > 0) {
    return headingChunks;
  }
  return chunkBySize(content, filePath, fileName, options);
}

function chunkByHeadings(
  content: string,
  filePath: string,
  fileName: string,
): Chunk[] {
  const headings: { level: number; text: string; index: number }[] = [];
  let match: RegExpExecArray | null;

  while ((match = HEADING_REGEX.exec(content)) !== null) {
    const hLevel = match[1];
    const hText = match[2];
    if (!hLevel || hText === undefined) continue;
    headings.push({
      level: hLevel.length,
      text: hText,
      index: match.index,
    });
  }

  if (headings.length === 0) return [];

  const chunks: Chunk[] = [];
  for (let i = 0; i < headings.length; i++) {
    const heading = headings[i];
    if (!heading) continue;
    const start = heading.index;
    const nextHeading = headings[i + 1];
    const end = nextHeading ? nextHeading.index : content.length;
    const sectionContent = content.slice(start, end).trim();
    if (sectionContent.length === 0) continue;

    chunks.push({
      content: sectionContent,
      filePath,
      fileName,
      heading: heading.text,
      startPos: start,
      endPos: end,
    });
  }

  return chunks;
}

function chunkBySize(
  content: string,
  filePath: string,
  fileName: string,
  options: ChunkOptions,
): Chunk[] {
  const { chunkSize, chunkOverlap } = options;
  if (chunkSize <= 0) return [];

  const chunks: Chunk[] = [];
  const step = Math.max(chunkSize - chunkOverlap, 1);
  let start = 0;

  while (start < content.length) {
    const end = Math.min(start + chunkSize, content.length);
    const chunkContent = content.slice(start, end).trim();
    if (chunkContent.length > 0) {
      chunks.push({
        content: chunkContent,
        filePath,
        fileName,
        heading: null,
        startPos: start,
        endPos: end,
      });
    }
    start += step;
    if (start >= content.length) break;
  }

  return chunks;
}
