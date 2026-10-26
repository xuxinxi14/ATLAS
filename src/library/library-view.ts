import { escapeHtml } from "../html.ts";
import {
  knowledgeRepository,
  statusMeta,
  typeMeta,
} from "../knowledge/repository.ts";
import type {
  EntryStatus,
  EntryType,
  KnowledgeEntry,
} from "../knowledge/types.ts";
import { buildEntryHash, buildStudioHash } from "../app/router.ts";
import { normalizeSearchText } from "../search/search-engine.ts";

export interface LibraryState {
  category: string;
  type: EntryType | "all";
  status: EntryStatus | "all";
  query: string;
  sortBy: "updated" | "title" | "status";
  layout: "grid" | "list";
}

const STATUS_PRIORITY: Record<EntryStatus, number> = {
  review: 1,
  learning: 2,
  todo: 3,
  proficient: 4,
  draft: 5,
};

export function filterAndSortLibraryEntries(
  state: LibraryState,
): KnowledgeEntry[] {
  const includeDrafts = state.category === "inbox" || state.status === "draft";
  let list = knowledgeRepository.all(true).filter((entry) => {
    if (!includeDrafts && entry.category === "inbox") return false;
    if (
      state.category &&
      state.category !== "all" &&
      entry.category !== state.category &&
      entry.categoryTitle !== state.category
    ) {
      return false;
    }
    if (state.type !== "all" && entry.type !== state.type) return false;
    if (state.status !== "all" && entry.status !== state.status) return false;
    if (state.query.trim()) {
      const q = normalizeSearchText(state.query);
      const hay = normalizeSearchText(
        `${entry.visualCode} ${entry.globalCode} ${entry.title} ${entry.summary} ${entry.tags.join(" ")} ${entry.plainText}`,
      );
      return hay.includes(q);
    }
    return true;
  });

  list = [...list].sort((a, b) => {
    if (state.sortBy === "title") {
      return a.title.localeCompare(b.title, "zh-CN");
    }
    if (state.sortBy === "status") {
      const sa = STATUS_PRIORITY[a.status] ?? 9;
      const sb = STATUS_PRIORITY[b.status] ?? 9;
      if (sa !== sb) return sa - sb;
    }
    return b.updated.localeCompare(a.updated);
  });

  return list;
}

export function renderLibraryViewMarkup(
  state: LibraryState,
  savedIds: Set<string>,
  hasWebGL = true,
): string {
  const portals = knowledgeRepository.portals();
  const telemetry = knowledgeRepository.telemetry();
  const entries = filterAndSortLibraryEntries(state);

  const portalTabs = [
    {
      id: "all",
      code: "ALL",
      title: "全部领域",
      count: telemetry.totalEntries,
    },
    ...portals.map((p, i) => ({
      id: p.id,
      code: `0${i + 1}`,
      title: p.title,
      count: telemetry.portalStats.find((s) => s.id === p.id)?.total ?? 0,
    })),
    {
      id: "inbox",
      code: "INB",
      title: "闪念草稿箱",
      count: telemetry.inboxCount,
    },
  ];

  const tabsHtml = portalTabs
    .map(
      (tab) => `
      <button
        type="button"
        class="rhine-portal-tab ${state.category === tab.id ? "active" : ""}"
        data-library-category="${escapeHtml(tab.id)}"
        aria-pressed="${state.category === tab.id}"
      >
        <small>${escapeHtml(tab.code)}</small>
        <span>${escapeHtml(tab.title)}</span>
        <b>${String(tab.count).padStart(2, "0")}</b>
      </button>
    `,
    )
    .join("");

  const typeFilters: { value: EntryType | "all"; label: string }[] = [
    { value: "all", label: "ALL TYPES / 全部类型" },
    { value: "skill", label: "SKILL / 技能操作" },
    { value: "snippet", label: "SNIPPET / 速查微卡" },
    { value: "concept", label: "CONCEPT / 核心概念" },
    { value: "troubleshooting", label: "TROUBLESHOOT / 故障排错" },
  ];

  const statusFilters: { value: EntryStatus | "all"; label: string }[] = [
    { value: "all", label: "ALL STATUS / 全部状态" },
    { value: "proficient", label: "已掌握" },
    { value: "learning", label: "解析中" },
    { value: "todo", label: "待解密" },
    { value: "review", label: "需校准" },
  ];

  const typeChipsHtml = typeFilters
    .map(
      (t) =>
        `<button type="button" class="rhine-filter-chip ${state.type === t.value ? "active" : ""}" data-library-type="${t.value}">${escapeHtml(t.label)}</button>`,
    )
    .join("");

  const statusChipsHtml = statusFilters
    .map(
      (s) =>
        `<button type="button" class="rhine-filter-chip ${state.status === s.value ? "active" : ""}" data-library-status="${s.value}">${s.value !== "all" ? `<i data-status="${s.value}"></i>` : ""}${escapeHtml(s.label)}</button>`,
    )
    .join("");

  const entriesHtml =
    entries.length > 0
      ? state.layout === "list"
        ? `
          <div class="rhine-ledger-header rhine-library-ledger-head">
            <span>SERIAL / 编号</span>
            <span>SPECIMEN / 档案标题与摘要</span>
            <span>PORTAL / 所属门类</span>
            <span>STATUS / 状态</span>
            <span>ACTION / 操作</span>
          </div>
          <div class="rhine-ledger-list">
            ${entries
              .map((entry) => {
                const sMeta = statusMeta(entry.status);
                const tMeta = typeMeta(entry.type);
                const isSaved =
                  savedIds.has(entry.id) || savedIds.has(entry.globalCode);
                return `
                  <article class="rhine-ledger-row rhine-library-ledger-row">
                    <span class="ledger-code">${escapeHtml(entry.visualCode)}<small>${escapeHtml(entry.globalCode)}</small></span>
                    <a href="${buildEntryHash(entry.slug)}" class="ledger-title-cell">
                      <strong>${escapeHtml(entry.title)}</strong>
                      <small>${escapeHtml(tMeta.label)} · ${escapeHtml(entry.summary)}</small>
                    </a>
                    <span class="ledger-portal">${escapeHtml(entry.categoryTitle)}<small>${escapeHtml(entry.updated)}</small></span>
                    <span class="ledger-status"><i data-status="${escapeHtml(entry.status)}"></i>${escapeHtml(sMeta.label)}</span>
                    <span class="ledger-actions">
                      ${
                        hasWebGL && entry.category !== "inbox"
                          ? `<button type="button" class="specimen-act" data-atlas-action="locate-3d" data-entry-id="${escapeHtml(entry.id)}" title="在 3D 阵列中抽取">3D ↗</button>`
                          : ""
                      }
                      <a href="${buildStudioHash(entry.slug)}" class="specimen-act" title="在内置编撰台中编辑">✎ 编辑</a>
                      <button type="button" class="specimen-act ${isSaved ? "active" : ""}" data-atlas-action="toggle-save" data-entry-id="${escapeHtml(entry.id)}">${isSaved ? "★ 已收藏" : "＋ 收藏"}</button>
                      <a href="${buildEntryHash(entry.slug)}" class="specimen-act specimen-act-primary">READ →</a>
                    </span>
                  </article>
                `;
              })
              .join("")}
          </div>
        `
        : entries
            .map((entry) => {
              const sMeta = statusMeta(entry.status);
              const tMeta = typeMeta(entry.type);
              const isSaved =
                savedIds.has(entry.id) || savedIds.has(entry.globalCode);
              return `
                <article class="rhine-specimen-plate" data-entry-id="${escapeHtml(entry.id)}" data-status="${escapeHtml(entry.status)}">
                  <div class="specimen-plate-rule"><i></i><span>+</span></div>
                  <div class="specimen-kicker">
                    <span class="specimen-serial">${escapeHtml(entry.visualCode)} <i>/</i> ${escapeHtml(entry.globalCode)}</span>
                    <span class="specimen-status" title="${escapeHtml(sMeta.hint)}">
                      <i data-status="${escapeHtml(entry.status)}"></i>${escapeHtml(sMeta.label)} · ${escapeHtml(sMeta.en)}
                    </span>
                  </div>

                  <div class="specimen-subkicker">
                    <span>${escapeHtml(entry.en)} // ${escapeHtml(tMeta.en)}</span>
                    <span>${escapeHtml(entry.categoryTitle)}${entry.autoInferred ? " · AUTO" : ""}</span>
                  </div>

                  <h3 class="specimen-title">
                    <a href="${buildEntryHash(entry.slug)}">
                      <span>${escapeHtml(entry.title)}</span>
                      <i aria-hidden="true">↗</i>
                    </a>
                  </h3>

                  <p class="specimen-summary">${escapeHtml(entry.summary)}</p>

                  <div class="specimen-tags">
                    ${entry.tags.map((t) => `<span class="specimen-tag">#${escapeHtml(t)}</span>`).join("")}
                  </div>

                  <div class="specimen-footer">
                    <div class="specimen-meta">
                      <span>${escapeHtml(entry.updated)}</span>
                      <span>· ${escapeHtml(entry.version_scope)}</span>
                    </div>
                    <div class="specimen-actions">
                      ${
                        hasWebGL && entry.category !== "inbox"
                          ? `<button type="button" class="specimen-act" data-atlas-action="locate-3d" data-entry-id="${escapeHtml(entry.id)}" title="在 3D 档案阵列中抽取该卡">3D 定位 ↗</button>`
                          : ""
                      }
                      <a href="${buildStudioHash(entry.slug)}" class="specimen-act" title="在内置编撰台中编辑">✎ 编辑</a>
                      <button type="button" class="specimen-act ${isSaved ? "active" : ""}" data-atlas-action="toggle-save" data-entry-id="${escapeHtml(entry.id)}">${isSaved ? "★ 已收藏" : "＋ 收藏"}</button>
                      <a href="${buildEntryHash(entry.slug)}" class="specimen-act specimen-act-primary">READ →</a>
                    </div>
                  </div>
                </article>
              `;
            })
            .join("")
      : `
        <div class="rhine-empty-specimen">
          <span>∅</span>
          <strong>NO MATCHING SPECIMENS // 未找到匹配的知识档案</strong>
          <p>请尝试其他关键词、编号，或重置当前门类与状态过滤条件。</p>
          <button type="button" class="solid-button" data-atlas-action="reset-library-filters">RESET FILTERS →<span>重置全部筛选条件</span></button>
        </div>
      `;

  return `
    <div class="atlas-surface-scroll">
      <div class="rhine-library-stage">
        <header class="rhine-library-top" data-stagger="0">
          <div class="rhine-section-kicker">
            <span>00 // ARCHIVE DIRECTORY · 二维知识索引目录</span>
            <span>SHOWING ${String(entries.length).padStart(2, "0")} OF ${String(telemetry.totalEntries + telemetry.inboxCount).padStart(2, "0")} SPECIMENS</span>
          </div>
          <div class="rhine-anchor-rule" data-rule><i></i></div>

          <div class="rhine-library-head-row">
            <div class="rhine-library-heading">
              <h2>KNOWLEDGE DIRECTORY<small>二维知识索引目录</small></h2>
            </div>

            <div class="rhine-library-search-bar">
              <div class="search-field rhine-inline-search">
                <span class="nav-glyph" aria-hidden="true"></span>
                <input
                  id="atlas-library-search"
                  type="search"
                  autocomplete="off"
                  placeholder="筛选标题、编号 (C-001 / X-001)、标签或正文命令…"
                  value="${escapeHtml(state.query)}"
                  aria-label="筛选知识目录"
                />
                <span class="key">FILTER</span>
              </div>
              <a href="${buildStudioHash()}" class="solid-button library-new-btn">
                + NEW ARCHIVE ✎<span>在 WebUI 新建笔记 [N]</span>
              </a>
            </div>
          </div>
        </header>

        <!-- Row 1: 5-Lane Portal Scale -->
        <nav class="rhine-portal-strip" data-stagger="1" aria-label="知识领域切换">
          ${tabsHtml}
        </nav>

        <!-- Row 2: Hairline Dimension Filters & View Controls -->
        <div class="rhine-dimension-bar" data-stagger="1" role="region" aria-label="多维筛选与排序">
          <div class="rhine-chip-group">
            <span class="chip-group-label">TYPE //</span>
            ${typeChipsHtml}
          </div>

          <div class="rhine-chip-group">
            <span class="chip-group-label">STATUS //</span>
            ${statusChipsHtml}
          </div>

          <div class="rhine-view-controls">
            <div class="rhine-sort-group" role="group" aria-label="排序方式">
              <span class="chip-group-label">SORT //</span>
              <button type="button" class="rhine-filter-chip ${state.sortBy === "updated" ? "active" : ""}" data-library-sort="updated">UPDATED ↓</button>
              <button type="button" class="rhine-filter-chip ${state.sortBy === "status" ? "active" : ""}" data-library-sort="status">PRIORITY</button>
              <button type="button" class="rhine-filter-chip ${state.sortBy === "title" ? "active" : ""}" data-library-sort="title">A–Z</button>
            </div>

            <div class="rhine-layout-group" role="group" aria-label="视图模式">
              <button type="button" class="rhine-filter-chip ${state.layout === "grid" ? "active" : ""}" data-library-layout="grid">MATRIX 切片</button>
              <button type="button" class="rhine-filter-chip ${state.layout === "list" ? "active" : ""}" data-library-layout="list">LEDGER 列表</button>
            </div>
          </div>
        </div>

        <div class="rhine-specimens-container layout-${state.layout}" data-stagger="2">
          ${entriesHtml}
        </div>
      </div>
    </div>
  `;
}
