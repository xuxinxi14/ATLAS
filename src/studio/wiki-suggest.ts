import { escapeHtml } from "../html.ts";
import { knowledgeRepository } from "../knowledge/repository.ts";
import type { KnowledgeEntry } from "../knowledge/types.ts";

export interface WikiLinkTrigger {
  /** Document offset of the opening `[[` */
  from: number;
  /** Document offset to replace up to (includes trailing `]]` if present right after cursor) */
  to: number;
  /** Raw query inside `[[...` before the cursor */
  query: string;
  /** Whether preceded by `!` (`![[`) */
  embed: boolean;
}

export interface WikiLinkSuggestion {
  insertText: string;
  displayText: string;
  code: string;
  subtitle: string;
  slug: string;
  isHeading: boolean;
}

/**
 * Inspects document text around `cursor` and returns an active `[[...` trigger if present.
 */
export function detectWikiLinkTrigger(
  docText: string,
  cursor: number,
): WikiLinkTrigger | null {
  if (cursor < 2 || cursor > docText.length) return null;
  const lineStart = docText.lastIndexOf("\n", cursor - 1) + 1;
  const beforeCursor = docText.slice(lineStart, cursor);

  // Match the last unclosed `[[` on the current line
  const match = /(!?)\[\[([^[\]\n]*)$/.exec(beforeCursor);
  if (!match) return null;

  const embed = Boolean(match[1]);
  const query = match[2];
  const openBracketOffset = lineStart + match.index + (embed ? 1 : 0);
  const afterCursor = docText.slice(cursor, cursor + 2);
  const replaceTo = afterCursor === "]]" ? cursor + 2 : cursor;

  return {
    from: openBracketOffset,
    to: replaceTo,
    query,
    embed,
  };
}

/**
 * Returns ranked wiki-link or heading-anchor completions for the given `[[query`.
 */
export function queryWikiLinkSuggestions(
  rawQuery: string,
  currentEntrySlug?: string,
  limit = 8,
): WikiLinkSuggestion[] {
  const allEntries = knowledgeRepository.all(true);
  const [rawNotePart, rawHeadingPart] = rawQuery.split("|")[0].split("#");

  // 1. Heading completion mode: `[[Note#heading` or `[[#heading`
  if (rawHeadingPart !== undefined) {
    const noteKey = rawNotePart.trim().toLowerCase();
    const headingKey = rawHeadingPart.trim().toLowerCase();
    let targetEntry: KnowledgeEntry | undefined;

    if (!noteKey && currentEntrySlug) {
      targetEntry =
        knowledgeRepository.bySlug(currentEntrySlug) ??
        knowledgeRepository.byId(currentEntrySlug);
    } else if (noteKey) {
      targetEntry = allEntries.find((e) =>
        [
          e.title,
          e.slug,
          e.id,
          e.visualCode,
          e.slug.split("/").at(-1) ?? "",
          ...(e.aliases ?? []),
        ].some((v) => v.toLowerCase() === noteKey),
      );
      if (!targetEntry) {
        targetEntry = allEntries.find((e) =>
          [e.title, e.slug, e.id, e.visualCode].some((v) =>
            v.toLowerCase().includes(noteKey),
          ),
        );
      }
    }

    if (!targetEntry) return [];

    const suggestions: WikiLinkSuggestion[] = [];
    for (const tocItem of targetEntry.toc) {
      if (
        !headingKey ||
        tocItem.text.toLowerCase().includes(headingKey) ||
        tocItem.id.toLowerCase().includes(headingKey)
      ) {
        const prefix = noteKey ? targetEntry.title : "";
        suggestions.push({
          insertText: `${prefix}#${tocItem.text}`,
          displayText: `# ${tocItem.text}`,
          code: `H${tocItem.level}`,
          subtitle: `${targetEntry.visualCode} · ${targetEntry.title}`,
          slug: targetEntry.slug,
          isHeading: true,
        });
      }
      if (suggestions.length >= limit) break;
    }
    return suggestions;
  }

  // 2. Entry completion mode: `[[query`
  const q = rawNotePart.trim().toLowerCase();
  const useSlugInsert = q.includes("/");

  const scored = allEntries
    .map((entry) => {
      if (!q) {
        return {
          entry,
          score: entry.category === "inbox" ? 1 : 10,
        };
      }
      const titleLower = entry.title.toLowerCase();
      const slugLower = entry.slug.toLowerCase();
      const stemLower = (entry.slug.split("/").at(-1) ?? "").toLowerCase();
      const codeLower = entry.visualCode.toLowerCase();
      const idLower = entry.id.toLowerCase();

      let score = 0;
      if (titleLower === q || slugLower === q || codeLower === q) score += 100;
      else if (
        titleLower.startsWith(q) ||
        stemLower.startsWith(q) ||
        codeLower.startsWith(q)
      )
        score += 60;
      else if (
        titleLower.includes(q) ||
        slugLower.includes(q) ||
        idLower.includes(q)
      )
        score += 35;
      else if (
        entry.tags.some((t) => t.toLowerCase().includes(q)) ||
        (entry.aliases ?? []).some((a) => a.toLowerCase().includes(q))
      )
        score += 20;

      return { entry, score };
    })
    .filter((item) => item.score > 0)
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.entry.visualCode.localeCompare(b.entry.visualCode),
    )
    .slice(0, limit);

  return scored.map(({ entry }) => ({
    insertText: useSlugInsert ? entry.slug : entry.title,
    displayText: entry.title,
    code: entry.visualCode,
    subtitle: `${entry.categoryTitle} · ${entry.slug}`,
    slug: entry.slug,
    isHeading: false,
  }));
}

export function renderWikiSuggestPopoverMarkup(
  suggestions: WikiLinkSuggestion[],
  activeIndex: number,
): string {
  if (suggestions.length === 0) return "";
  const clampedIdx = Math.max(0, Math.min(activeIndex, suggestions.length - 1));
  const itemsHtml = suggestions
    .map((item, idx) => {
      const isActive = idx === clampedIdx;
      return `
        <button
          type="button"
          role="option"
          aria-selected="${isActive}"
          class="studio-wiki-suggest-item ${isActive ? "active" : ""}"
          data-wiki-suggest-idx="${idx}"
          data-wiki-insert="${escapeHtml(item.insertText)}"
        >
          <span class="wiki-suggest-code">${escapeHtml(item.code)}</span>
          <span class="wiki-suggest-main">
            <strong>${escapeHtml(item.displayText)}</strong>
            <small>${escapeHtml(item.subtitle)}</small>
          </span>
          <kbd class="wiki-suggest-hint">${item.isHeading ? "#章节" : "[[双链]]"}</kbd>
        </button>
      `;
    })
    .join("");

  return `
    <div class="studio-wiki-suggest-head">
      <span>WIKI LINK AUTOCOMPLETE // 双链补全（输入 # 可补全章节锚点）</span>
      <kbd>↑↓ · Enter</kbd>
    </div>
    <div class="studio-wiki-suggest-list" role="listbox">
      ${itemsHtml}
    </div>
  `;
}
