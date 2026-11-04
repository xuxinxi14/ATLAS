import { escapeHtml } from "../html.ts";
import type { KnowledgeEntry } from "../knowledge/types.ts";

export type AnnotationColor = "amber" | "emerald" | "sky";

export interface ReaderAnnotation {
  id: string;
  entryId: string;
  slug: string;
  quote: string;
  note: string;
  color: AnnotationColor;
  createdAt: string;
}

const STORAGE_KEY = "atlas-reader-annotations";
let memoryFallbackStore: Record<string, ReaderAnnotation[]> = {};

export function loadAllReaderAnnotations(): Record<string, ReaderAnnotation[]> {
  try {
    if (typeof localStorage !== "undefined") {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        return parsed as Record<string, ReaderAnnotation[]>;
      }
    }
  } catch {
    // Fallback to in-memory store
  }
  return { ...memoryFallbackStore };
}

export function saveAllReaderAnnotations(
  store: Record<string, ReaderAnnotation[]>,
): void {
  memoryFallbackStore = { ...store };
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    }
  } catch {
    // Ignore storage quota errors
  }
}

export function getEntryAnnotations(
  entryId: string,
  slug?: string,
): ReaderAnnotation[] {
  const store = loadAllReaderAnnotations();
  const byId = store[entryId] ?? [];
  if (slug && slug !== entryId && store[slug]) {
    const merged = [...byId];
    const seen = new Set(byId.map((a) => a.id));
    for (const item of store[slug]) {
      if (!seen.has(item.id)) merged.push(item);
    }
    return merged;
  }
  return byId;
}

export function addEntryAnnotation(input: {
  entryId: string;
  slug: string;
  quote?: string;
  note: string;
  color?: AnnotationColor;
}): ReaderAnnotation {
  const store = loadAllReaderAnnotations();
  const list = [...(store[input.entryId] ?? [])];
  const now = new Date();
  const createdAt = `${now.toISOString().slice(0, 10)} ${now.toTimeString().slice(0, 5)}`;
  const item: ReaderAnnotation = {
    id: `ann-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    entryId: input.entryId,
    slug: input.slug,
    quote: String(input.quote ?? "").trim(),
    note: String(input.note ?? "").trim(),
    color: input.color ?? "amber",
    createdAt,
  };
  list.unshift(item);
  store[input.entryId] = list;
  saveAllReaderAnnotations(store);
  return item;
}

export function removeEntryAnnotation(
  entryId: string,
  annotationId: string,
): boolean {
  const store = loadAllReaderAnnotations();
  const list = store[entryId];
  if (!Array.isArray(list)) return false;
  const next = list.filter((a) => a.id !== annotationId);
  if (next.length === list.length) return false;
  if (next.length === 0) {
    delete store[entryId];
  } else {
    store[entryId] = next;
  }
  saveAllReaderAnnotations(store);
  return true;
}

export function formatAnnotationsAsMarkdownSection(
  annotations: ReaderAnnotation[],
): string {
  if (annotations.length === 0) return "";
  const lines: string[] = ["## 个人批注与重点摘录", ""];
  for (const ann of annotations) {
    if (ann.quote) {
      lines.push(`> 「${ann.quote.replace(/\r?\n/g, " ")}」`);
    }
    if (ann.note) {
      lines.push(`- **批注**（${ann.createdAt}）：${ann.note}`);
    } else {
      lines.push(`- *重点标记于 ${ann.createdAt}*`);
    }
    lines.push("");
  }
  return lines.join("\n").trimEnd();
}

/**
 * Safely wraps matched quote substrings in `<mark class="atlas-inline-highlight">`
 * inside HTML text segments (skipping tags, code blocks, and math blocks).
 */
export function applyInlineHighlightsToHtml(
  html: string,
  annotations: ReaderAnnotation[],
): string {
  const withQuotes = annotations.filter((a) => a.quote && a.quote.length >= 2);
  if (withQuotes.length === 0 || !html) return html;

  // Split HTML by protected blocks (<pre...>...<\/pre>, <code...>...<\/code>, or any HTML tag)
  const tokenRegex =
    /(<pre[\s\S]*?<\/pre>|<code[\s\S]*?<\/code>|<[^>]+>)/gi;
  const parts = html.split(tokenRegex);

  for (let i = 0; i < parts.length; i++) {
    const seg = parts[i];
    if (!seg || seg.startsWith("<")) continue;
    let updated = seg;
    for (const ann of withQuotes) {
      const escapedQuote = escapeHtml(ann.quote);
      if (!escapedQuote || !updated.includes(escapedQuote)) continue;
      const tip = escapeHtml(ann.note ? `批注：${ann.note}` : "个人重点高亮");
      const replacement = `<mark class="atlas-inline-highlight" data-color="${escapeHtml(ann.color)}" data-annotation-id="${escapeHtml(ann.id)}" title="${tip}">${escapedQuote}</mark>`;
      updated = updated.replace(escapedQuote, replacement);
    }
    parts[i] = updated;
  }

  return parts.join("");
}

export function renderReaderAnnotationsDrawerMarkup(
  entry: KnowledgeEntry,
  annotations: ReaderAnnotation[],
  readOnly = false,
): string {
  const listHtml =
    annotations.length > 0
      ? `<div class="reader-annotations-list">
          ${annotations
            .map(
              (ann) => `
              <article class="reader-annotation-card" data-color="${escapeHtml(ann.color)}" data-annotation-id="${escapeHtml(ann.id)}">
                <div class="annotation-card-top">
                  <span class="annotation-color-dot" data-color="${escapeHtml(ann.color)}"></span>
                  <time class="annotation-time">${escapeHtml(ann.createdAt)}</time>
                  <button
                    type="button"
                    class="annotation-delete-btn"
                    data-reader-note-action="delete"
                    data-entry-id="${escapeHtml(entry.id)}"
                    data-annotation-id="${escapeHtml(ann.id)}"
                    title="删除此条批注"
                    aria-label="删除批注"
                  >×</button>
                </div>
                ${
                  ann.quote
                    ? `<blockquote class="annotation-quote">「${escapeHtml(ann.quote)}」</blockquote>`
                    : ""
                }
                ${
                  ann.note
                    ? `<p class="annotation-note-body">${escapeHtml(ann.note)}</p>`
                    : ""
                }
              </article>
            `,
            )
            .join("")}
        </div>`
      : `<p class="reader-side-muted">暂无个人批注。可在正文中选中任意文字后点击「引用选中文字」，或直接在下方输入页边速记。</p>`;

  return `
    <div class="reader-annotations-panel" id="reader-annotations-panel" data-entry-id="${escapeHtml(entry.id)}" data-entry-slug="${escapeHtml(entry.slug)}">
      <div class="reader-annotation-composer">
        <div class="annotation-composer-row">
          <input
            id="reader-note-quote-input"
            type="text"
            class="annotation-quote-input"
            placeholder="可选：高亮原文句子（或点击右侧拾取选中文本）"
            autocomplete="off"
          />
          <button
            type="button"
            class="annotation-pick-selection-btn"
            data-reader-note-action="capture-selection"
            title="将正文当前选中的文字填入摘录框"
          >拾取选中</button>
        </div>
        <textarea
          id="reader-note-body-input"
          class="annotation-body-input"
          rows="2"
          placeholder="输入页边批注、实验心得或待验证问题…"
        ></textarea>
        <div class="annotation-composer-footer">
          <div class="annotation-color-picker" role="radiogroup" aria-label="高亮颜色">
            <button type="button" class="annotation-color-btn active" data-note-color="amber" title="琥珀黄高亮" aria-label="琥珀黄"></button>
            <button type="button" class="annotation-color-btn" data-note-color="emerald" title="翠绿高亮" aria-label="翠绿"></button>
            <button type="button" class="annotation-color-btn" data-note-color="sky" title="天青蓝高亮" aria-label="天青蓝"></button>
          </div>
          <button
            type="button"
            class="annotation-save-btn"
            data-reader-note-action="add"
            data-entry-id="${escapeHtml(entry.id)}"
            data-entry-slug="${escapeHtml(entry.slug)}"
          >＋ 添加批注</button>
        </div>
      </div>

      ${listHtml}

      ${
        annotations.length > 0
          ? `<div class="reader-annotations-export-bar">
              <button
                type="button"
                class="annotation-export-btn"
                data-reader-note-action="copy-markdown"
                data-entry-id="${escapeHtml(entry.id)}"
              >⎘ 复制全部批注 Markdown</button>
              ${
                readOnly
                  ? ""
                  : `<button
                      type="button"
                      class="annotation-export-btn is-primary"
                      data-reader-note-action="append-to-studio"
                      data-entry-id="${escapeHtml(entry.id)}"
                      data-entry-slug="${escapeHtml(entry.slug)}"
                    >⇪ 写入笔记末尾 (Studio)</button>`
              }
            </div>`
          : ""
      }
    </div>
  `;
}
