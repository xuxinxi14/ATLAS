import searchIndexData from "../generated/search-index.json" with { type: "json" };
import type { EntryStatus, EntryType } from "../knowledge/types.ts";

export interface SearchIndexItem {
  id: string;
  slug: string;
  visualCode: string;
  globalCode?: string;
  title: string;
  category: string;
  categoryTitle: string;
  type: EntryType;
  status: EntryStatus;
  tags: string[];
  summary: string;
  headings: string;
  body: string;
  updated: string;
}

export interface SearchResult {
  item: SearchIndexItem;
  score: number;
  snippet: string;
  matchedFields: string[];
}

export interface SearchFilterOptions {
  category?: string;
  type?: EntryType | "all";
  status?: EntryStatus | "all";
  includeDrafts?: boolean;
}

const indexItems = searchIndexData as SearchIndexItem[];

export function normalizeSearchText(input: string): string {
  let out = "";
  for (let i = 0; i < input.length; i++) {
    const code = input.charCodeAt(i);
    // Full-width ASCII variants (FF01..FF5E) -> standard ASCII (21..7E)
    if (code >= 0xff01 && code <= 0xff5e) {
      out += String.fromCharCode(code - 0xfee0);
    } else if (code === 0x3000) {
      out += " ";
    } else {
      out += input[i];
    }
  }
  return out.toLowerCase().trim();
}

function extractCjkBigrams(str: string): string[] {
  const cjk = str.replace(/[^\u4e00-\u9fa5]/g, "");
  if (cjk.length < 2) return cjk ? [cjk] : [];
  const bigrams: string[] = [];
  for (let i = 0; i < cjk.length - 1; i++) {
    bigrams.push(cjk.slice(i, i + 2));
  }
  return bigrams;
}

function buildSnippet(text: string, tokens: string[], fallback: string): string {
  const normText = normalizeSearchText(text);
  for (const tok of tokens) {
    const idx = normText.indexOf(tok);
    if (idx !== -1) {
      const start = Math.max(0, idx - 22);
      const end = Math.min(text.length, idx + tok.length + 58);
      const prefix = start > 0 ? "…" : "";
      const suffix = end < text.length ? "…" : "";
      return `${prefix}${text.slice(start, end).replace(/\s+/g, " ")}${suffix}`;
    }
  }
  return fallback;
}

export function searchKnowledge(
  rawQuery: string,
  filters: SearchFilterOptions = {},
): SearchResult[] {
  const query = normalizeSearchText(rawQuery);
  const {
    category = "all",
    type = "all",
    status = "all",
    includeDrafts = true,
  } = filters;

  const candidates = indexItems.filter((item) => {
    if (!includeDrafts && item.status === "draft") return false;
    if (
      category &&
      category !== "all" &&
      category !== "全部档案" &&
      item.category !== category &&
      item.categoryTitle !== category
    ) {
      return false;
    }
    if (type !== "all" && item.type !== type) return false;
    if (status !== "all" && item.status !== status) return false;
    return true;
  });

  if (!query) {
    return candidates.map((item) => ({
      item,
      score: 1,
      snippet: item.summary,
      matchedFields: [],
    }));
  }

  const tokens = query.split(/\s+/).filter(Boolean);
  const bigrams = extractCjkBigrams(query);
  const results: SearchResult[] = [];

  for (const item of candidates) {
    const normTitle = normalizeSearchText(item.title);
    const normCode = normalizeSearchText(
      `${item.visualCode} ${item.globalCode ?? ""} ${item.id} ${item.slug}`,
    );
    const normTags = normalizeSearchText(item.tags.join(" "));
    const normSummary = normalizeSearchText(item.summary);
    const normHeadings = normalizeSearchText(item.headings);
    const normBody = normalizeSearchText(item.body);

    let score = 0;
    const matchedFields = new Set<string>();
    let allTokensMatched = true;

    for (const tok of tokens) {
      let tokenScore = 0;
      if (normTitle === tok) {
        tokenScore += 140;
        matchedFields.add("标题");
      } else if (normTitle.startsWith(tok)) {
        tokenScore += 100;
        matchedFields.add("标题");
      } else if (normTitle.includes(tok)) {
        tokenScore += 80;
        matchedFields.add("标题");
      }

      if (normCode.includes(tok)) {
        tokenScore += 90;
        matchedFields.add("编号");
      }
      if (normTags.includes(tok)) {
        tokenScore += 55;
        matchedFields.add("标签");
      }
      if (normSummary.includes(tok)) {
        tokenScore += 32;
        matchedFields.add("摘要");
      }
      if (normHeadings.includes(tok)) {
        tokenScore += 24;
        matchedFields.add("章节");
      }
      if (normBody.includes(tok)) {
        tokenScore += 12;
        matchedFields.add("正文");
      }

      if (tokenScore === 0) {
        allTokensMatched = false;
      } else {
        score += tokenScore;
      }
    }

    if (allTokensMatched && tokens.length > 1) {
      score += 120;
      if (normTitle.includes(query)) score += 90;
      if (normBody.includes(query)) score += 50;
    } else if (!allTokensMatched) {
      score = Math.floor(score * 0.2);
    }

    // Fallback for multi-character Chinese phrases where sub-bigrams match across title/tags/body
    if (!allTokensMatched && bigrams.length >= 2) {
      let bigramHits = 0;
      for (const bg of bigrams) {
        if (normTitle.includes(bg)) {
          bigramHits += 2;
          matchedFields.add("标题");
        } else if (normTags.includes(bg) || normSummary.includes(bg)) {
          bigramHits += 1;
          matchedFields.add("摘要");
        } else if (normBody.includes(bg)) {
          bigramHits += 0.5;
          matchedFields.add("正文");
        }
      }
      if (bigramHits >= Math.ceil(bigrams.length * 0.6)) {
        score += bigramHits * 10;
      }
    }

    if (score > 0) {
      const snippet = matchedFields.has("正文") && !matchedFields.has("摘要")
        ? buildSnippet(item.body, [query, ...tokens], item.summary)
        : item.summary;
      results.push({
        item,
        score,
        snippet,
        matchedFields: [...matchedFields],
      });
    }
  }

  return results.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return b.item.updated.localeCompare(a.item.updated);
  });
}
