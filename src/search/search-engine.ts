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

export interface ParsedSearchQuery {
  tags: string[];
  categories: string[];
  statuses: string[];
  types: string[];
  codes: string[];
  freeTokens: string[];
  freeQuery: string;
  hasOperators: boolean;
}

const STATUS_ALIASES: Record<string, EntryStatus> = {
  proficient: "proficient",
  mastered: "proficient",
  已掌握: "proficient",
  learning: "learning",
  解析中: "learning",
  todo: "todo",
  待解密: "todo",
  待整理: "todo",
  review: "review",
  需校准: "review",
  需温习: "review",
  draft: "draft",
  草稿: "draft",
};

const TYPE_ALIASES: Record<string, EntryType> = {
  concept: "concept",
  概念: "concept",
  核心概念: "concept",
  skill: "skill",
  技能: "skill",
  技能操作: "skill",
  troubleshooting: "troubleshooting",
  排障: "troubleshooting",
  故障排错: "troubleshooting",
  snippet: "snippet",
  速查: "snippet",
  速查微卡: "snippet",
};

export function parseSearchQueryOperators(rawQuery: string): ParsedSearchQuery {
  const norm = normalizeSearchText(rawQuery);
  const rawTokens = norm ? norm.split(/\s+/).filter(Boolean) : [];
  const tags: string[] = [];
  const categories: string[] = [];
  const statuses: string[] = [];
  const types: string[] = [];
  const codes: string[] = [];
  const freeTokens: string[] = [];

  for (const tok of rawTokens) {
    if (tok.startsWith("#") && tok.length > 1) {
      tags.push(tok.slice(1));
      continue;
    }
    const opMatch = /^(tag|cat|domain|portal|status|is|type|code):(.+)$/.exec(
      tok,
    );
    if (opMatch) {
      const [, prefix, val] = opMatch;
      if (prefix === "tag") tags.push(val);
      else if (prefix === "cat" || prefix === "domain" || prefix === "portal")
        categories.push(val);
      else if (prefix === "status" || prefix === "is")
        statuses.push(STATUS_ALIASES[val] ?? val);
      else if (prefix === "type") types.push(TYPE_ALIASES[val] ?? val);
      else if (prefix === "code") codes.push(val);
      continue;
    }
    freeTokens.push(tok);
  }

  return {
    tags,
    categories,
    statuses,
    types,
    codes,
    freeTokens,
    freeQuery: freeTokens.join(" "),
    hasOperators:
      tags.length > 0 ||
      categories.length > 0 ||
      statuses.length > 0 ||
      types.length > 0 ||
      codes.length > 0,
  };
}

export function matchesSearchOperators(
  item: {
    id: string;
    slug: string;
    visualCode: string;
    globalCode?: string;
    category: string;
    categoryTitle: string;
    type: EntryType;
    status: EntryStatus;
    tags: string[];
    body?: string;
    plainText?: string;
  },
  parsed: ParsedSearchQuery,
): boolean {
  if (!parsed.hasOperators) return true;

  if (parsed.tags.length > 0) {
    const normTags = normalizeSearchText(item.tags.join(" "));
    if (!parsed.tags.every((t) => normTags.includes(t))) return false;
  }
  if (parsed.categories.length > 0) {
    const normCat = normalizeSearchText(`${item.category} ${item.categoryTitle}`);
    if (!parsed.categories.every((c) => normCat.includes(c))) return false;
  }
  if (parsed.statuses.length > 0) {
    const normStatus = normalizeSearchText(item.status);
    if (!parsed.statuses.every((s) => normStatus === s || normStatus.includes(s)))
      return false;
  }
  if (parsed.types.length > 0) {
    const normType = normalizeSearchText(item.type);
    if (!parsed.types.every((t) => normType === t || normType.includes(t)))
      return false;
  }
  if (parsed.codes.length > 0) {
    const normCodeAndBody = normalizeSearchText(
      `${item.visualCode} ${item.globalCode ?? ""} ${item.id} ${item.slug} ${item.body ?? item.plainText ?? ""}`,
    );
    if (!parsed.codes.every((c) => normCodeAndBody.includes(c))) return false;
  }
  return true;
}

const indexItems: SearchIndexItem[] = [...(searchIndexData as SearchIndexItem[])];

export function hotReloadSearchIndex(newItems: SearchIndexItem[]) {
  indexItems.splice(0, indexItems.length, ...newItems);
}

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
  const parsed = parseSearchQueryOperators(rawQuery);
  const query = parsed.freeQuery;
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
    if (!matchesSearchOperators(item, parsed)) return false;
    return true;
  });

  if (!query) {
    const opFields: string[] = [];
    if (parsed.tags.length > 0) opFields.push("标签");
    if (parsed.categories.length > 0) opFields.push("领域");
    if (parsed.statuses.length > 0) opFields.push("状态");
    if (parsed.types.length > 0) opFields.push("类型");
    if (parsed.codes.length > 0) opFields.push("编号");
    return candidates.map((item) => ({
      item,
      score: parsed.hasOperators ? 100 : 1,
      snippet: item.summary,
      matchedFields: opFields,
    }));
  }

  const tokens = parsed.freeTokens;
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
