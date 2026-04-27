import { TFile } from "obsidian";

export interface Chunk {
  content: string;
  filePath: string;
  fileName: string;
  heading: string | null;
  startPos: number;
  endPos: number;
}

export interface SearchResult {
  chunk: Chunk;
  score: number;
}

export interface RagConfig {
  enabled: boolean;
  maxChunks: number;
  chunkSize: number;
  chunkOverlap: number;
}

export interface TokenIndex {
  [token: string]: Map<number, { freq: number; chunk: Chunk }>;
}

export interface FileInfo {
  file: TFile;
  content: string;
}
