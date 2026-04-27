import { Chunk, SearchResult, TokenIndex } from "./types";

const STOP_WORDS = new Set([
  "的", "了", "在", "是", "我", "有", "和", "就", "不", "人", "都", "一",
  "一个", "上", "也", "很", "到", "说", "要", "去", "你", "会", "着",
  "没有", "看", "好", "自己", "这", "他", "她", "它", "们",
  "the", "a", "an", "is", "are", "was", "were", "be", "been", "being",
  "have", "has", "had", "do", "does", "did", "will", "would", "could",
  "should", "may", "might", "shall", "can", "need", "dare", "ought",
  "used", "to", "of", "in", "for", "on", "with", "at", "by", "from",
  "as", "into", "through", "during", "before", "after", "above", "below",
  "between", "out", "off", "over", "under", "again", "further", "then",
  "once", "here", "there", "when", "where", "why", "how", "all", "each",
  "every", "both", "few", "more", "most", "other", "some", "such", "no",
  "nor", "not", "only", "own", "same", "so", "than", "too", "very",
  "and", "but", "or", "if", "while", "that", "this", "these", "those",
  "it", "its", "what", "which", "who", "whom", "whose",
]);

const CJK_REGEX = /[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/;

function tokenize(text: string): string[] {
  const tokens: string[] = [];
  const lower = text.toLowerCase();

  let i = 0;
  while (i < lower.length) {
    if (CJK_REGEX.test(lower[i] ?? "")) {
      tokens.push(lower[i] ?? "");
      i++;
    } else if (/[a-z0-9]/.test(lower[i] ?? "")) {
      let word = "";
      while (i < lower.length && /[a-z0-9]/.test(lower[i] ?? "")) {
        word += lower[i];
        i++;
      }
      if (word.length > 0 && !STOP_WORDS.has(word)) {
        tokens.push(word);
      }
    } else {
      i++;
    }
  }

  return tokens;
}

function buildInvertedIndex(chunks: Chunk[]): TokenIndex {
  const index: TokenIndex = {};

  for (let ci = 0; ci < chunks.length; ci++) {
    const chunk = chunks[ci];
    if (!chunk) continue;
    const content = `${chunk.fileName} ${chunk.heading ?? ""} ${chunk.content}`;
    const tokens = tokenize(content);
    const seen = new Set<number>();

    for (const token of tokens) {
      if (!index[token]) {
        index[token] = new Map();
      }
      const postings = index[token];
      if (postings && !seen.has(ci)) {
        seen.add(ci);
        const existing = postings.get(ci);
        postings.set(ci, { freq: (existing?.freq ?? 0) + 1, chunk });
      } else if (postings) {
        const existing = postings.get(ci);
        if (existing) {
          existing.freq++;
        }
      }
    }
  }

  return index;
}

function bm25Score(
  queryTokens: string[],
  docId: number,
  tokenIndex: TokenIndex,
  totalDocs: number,
  avgDocLen: number,
  docLengths: number[],
): number {
  const k1 = 1.5;
  const b = 0.75;
  let score = 0;

  const seen = new Set<string>();
  for (const qt of queryTokens) {
    if (seen.has(qt)) continue;
    seen.add(qt);

    const postings = tokenIndex[qt];
    if (!postings) continue;

    const df = postings.size;
    const idf = Math.log(
      (totalDocs - df + 0.5) / (df + 0.5) + 1,
    );

    const posting = postings.get(docId);
    if (!posting) continue;

    const tf = posting.freq;
    const docLen = docLengths[docId] ?? 1;
    score += idf * ((tf * (k1 + 1)) / (tf + k1 * (1 - b + b * (docLen / avgDocLen))));
  }

  return score;
}

export function createSearcher(chunks: Chunk[]) {
  const tokenIndex = buildInvertedIndex(chunks);
  const totalDocs = chunks.length;
  const docLengths = chunks.map(
    (c) => tokenize(`${c.fileName} ${c.heading ?? ""} ${c.content}`).length,
  );
  const avgDocLen =
    docLengths.reduce((sum, len) => sum + len, 0) / Math.max(totalDocs, 1);

  function search(query: string, topK: number): SearchResult[] {
    const queryTokens = tokenize(query);
    if (queryTokens.length === 0) return [];

    const scored: { docId: number; score: number }[] = [];
    for (let docId = 0; docId < totalDocs; docId++) {
      const score = bm25Score(
        queryTokens,
        docId,
        tokenIndex,
        totalDocs,
        avgDocLen,
        docLengths,
      );
      if (score > 0) {
        scored.push({ docId, score });
      }
    }

    scored.sort((a, b) => b.score - a.score);

    return scored.slice(0, topK).map((s) => {
      const chunk = chunks[s.docId];
      if (!chunk) throw new Error("Unexpected: chunk not found");
      return { chunk, score: s.score };
    });
  }

  return { search };
}
