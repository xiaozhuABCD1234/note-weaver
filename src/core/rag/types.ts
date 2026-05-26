export type FileScope = "current-folder" | "all-vault";

export interface RelatedNote {
  path: string;
  reason: string;
  score: number;
}

export interface RagConfig {
  enabled: boolean;
  maxRelatedNotes: number;
  scope: FileScope;
  includeForwardLinks: boolean;
  includeBacklinks: boolean;
  includeTagMatches: boolean;
  linkDepth: number;
}
