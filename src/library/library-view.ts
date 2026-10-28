import { escapeHtml } from "../html.ts";
import {
  knowledgeRepository,
  typeMeta,
} from "../knowledge/repository.ts";
import type {
  EntryStatus,
  EntryType,
  KnowledgeEntry,
} from "../knowledge/types.ts";
import { buildEntryHash, buildStudioHash } from "../app/router.ts";
import { normalizeSearchText } from "../search/search-engine.ts";
import { publicReadOnly } from "../public-mode.ts";

export interface LibraryState {
  category: string;
  type: EntryType | "all";
  status: EntryStatus | "all";
  query: string;
  sortBy: "updated" | "title" | "status";
  layout: "grid" | "list";
  selectedId?: string | null;
  savedOnly?: boolean;
  filterOpen?: boolean;
  openRowMenuId?: string | null;
  unfiltered3DNoticeId?: string | null;
}

const STATUS_PRIORITY: Record<EntryStatus, number> = {
  review: 1,
  learning: 2,
  todo: 3,
  proficient: 4,
  draft: 5,
};

const DESK_DOMAIN_TITLES: Record<string, string> = {
  all: "全部档案",
  tools: "软件与工具",
  coding: "编程与 AI",
  computing: "编程与 AI",
  research: "科研与实验",
  academics: "学科知识",
  creation: "创作与生活",
  life: "创作与生活",
  inbox: "草稿箱",
};

const DESK_STATUS_LABELS: Record<EntryStatus, string> = {
  proficient: "已掌握",
  learning: "解析中",
  todo: "待整理",
  review: "需温习",
  draft: "草稿",
};

export function deskDomainTitle(id: string, fallback?: string): string {
  return DESK_DOMAIN_TITLES[id] ?? fallback ?? id;
}

export function deskStatusLabel(status: EntryStatus): string {
  return DESK_STATUS_LABELS[status] ?? "已掌握";
}

export function deskDisplayCode(entry: KnowledgeEntry): string {
  return entry.visualCode || entry.globalCode;
}

export function filterAndSortLibraryEntries(
  state: LibraryState,
  savedIds?: Set<string>,
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
    if (state.savedOnly && savedIds) {
      if (!savedIds.has(entry.id) && !savedIds.has(entry.globalCode)) {
        return false;
      }
    }
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
    // Preserve stable visualCode order when within a single domain and default sort
    if (
      state.sortBy === "updated" &&
      state.category !== "all" &&
      !state.query.trim() &&
      a.category === b.category
    ) {
      return deskDisplayCode(a).localeCompare(deskDisplayCode(b), "en");
    }
    return b.updated.localeCompare(a.updated);
  });

  return list;
}

export function resolveLibrarySelection(
  entries: KnowledgeEntry[],
  selectedId?: string | null,
): KnowledgeEntry | null {
  if (entries.length === 0) return null;
  if (selectedId) {
    const found = entries.find(
      (e) =>
        e.id === selectedId ||
        e.globalCode === selectedId ||
        e.visualCode === selectedId,
    );
    if (found) return found;
  }
  return entries[0] ?? null;
}

export function renderLibraryViewMarkup(
  state: LibraryState,
  savedIds: Set<string>,
  hasWebGL = true,
  readOnly = publicReadOnly,
): string {
  const portals = knowledgeRepository.portals();
  const telemetry = knowledgeRepository.telemetry();
  const entries = filterAndSortLibraryEntries(state, savedIds);
  const selectedEntry = resolveLibrarySelection(entries, state.selectedId);

  const activeFilterCount =
    (state.type !== "all" ? 1 : 0) +
    (state.status !== "all" ? 1 : 0) +
    (state.savedOnly ? 1 : 0) +
    (state.sortBy !== "updated" ? 1 : 0);

  const mainDomains = [
    {
      id: "all",
      title: "全部档案",
      count: telemetry.totalEntries,
    },
    ...portals.map((p) => ({
      id: p.id,
      title: deskDomainTitle(p.id, p.title),
      count: telemetry.portalStats.find((s) => s.id === p.id)?.total ?? 0,
    })),
  ];

  const domainNavHtml = `
    ${mainDomains
      .map((dom) => {
        const isActive = state.category === dom.id;
        return `
          <button
            type="button"
            class="desk-domain-item ${isActive ? "active" : ""}"
            data-library-category="${escapeHtml(dom.id)}"
            aria-pressed="${isActive}"
          >
            <i class="desk-domain-amber-bar" aria-hidden="true"></i>
            <span class="desk-domain-name">${escapeHtml(dom.title)}</span>
            <b class="desk-domain-count">${String(dom.count).padStart(2, "0")}</b>
          </button>
        `;
      })
      .join("")}
    <div class="desk-domain-divider" role="separator" aria-hidden="true"></div>
    <button
      type="button"
      class="desk-domain-item desk-domain-draft ${state.category === "inbox" ? "active" : ""}"
      data-library-category="inbox"
      aria-pressed="${state.category === "inbox"}"
    >
      <i class="desk-domain-amber-bar" aria-hidden="true"></i>
      <span class="desk-domain-name">草稿箱</span>
      <b class="desk-domain-count">${String(telemetry.inboxCount).padStart(2, "0")}</b>
    </button>
  `;

  const statusFilters: { value: EntryStatus | "all"; label: string }[] = [
    { value: "all", label: "全部状态" },
    { value: "proficient", label: "已掌握" },
    { value: "learning", label: "解析中" },
    { value: "todo", label: "待整理" },
    { value: "review", label: "需温习" },
    { value: "draft", label: "草稿" },
  ];

  const typeFilters: { value: EntryType | "all"; label: string }[] = [
    { value: "all", label: "全部类型" },
    { value: "skill", label: "技能操作" },
    { value: "snippet", label: "速查微卡" },
    { value: "concept", label: "核心概念" },
    { value: "troubleshooting", label: "故障排错" },
  ];

  const sortOptions: { value: LibraryState["sortBy"]; label: string }[] = [
    { value: "updated", label: "默认 / 最近更新" },
    { value: "title", label: "标题 A–Z" },
    { value: "status", label: "掌握状态优先" },
  ];

  const rowsHtml =
    entries.length > 0
      ? entries
          .map((entry) => {
            const isSelected = selectedEntry?.id === entry.id;
            const isSaved =
              savedIds.has(entry.id) || savedIds.has(entry.globalCode);
            const isMenuOpen = state.openRowMenuId === entry.id;
            const statusText = deskStatusLabel(entry.status);
            const displayCode = deskDisplayCode(entry);
            const tMeta = typeMeta(entry.type);

            return `
              <div
                class="desk-dir-row ${isSelected ? "selected" : ""}"
                role="option"
                tabindex="${isSelected ? "0" : "-1"}"
                aria-selected="${isSelected}"
                data-atlas-action="desk-select-row"
                data-entry-id="${escapeHtml(entry.id)}"
                data-status="${escapeHtml(entry.status)}"
              >
                <span class="desk-col-code">
                  <i class="desk-row-amber-mark" aria-hidden="true"></i>
                  <b>${escapeHtml(displayCode)}</b>
                </span>

                <span class="desk-col-title" title="${escapeHtml(tMeta.label)} · ${escapeHtml(entry.summary)}">
                  <strong class="desk-row-title">${escapeHtml(entry.title)}</strong>
                </span>

                <span class="desk-col-status" data-status="${escapeHtml(entry.status)}">
                  ${escapeHtml(statusText)}
                </span>

                <div class="desk-col-more">
                  <button
                    type="button"
                    class="desk-row-more-btn ${isMenuOpen ? "active" : ""}"
                    data-atlas-action="toggle-row-menu"
                    data-entry-id="${escapeHtml(entry.id)}"
                    aria-haspopup="menu"
                    aria-expanded="${isMenuOpen}"
                    aria-label="档案 ${escapeHtml(displayCode)} 更多操作"
                    title="更多操作"
                  >•••</button>

                  <div
                    class="desk-row-menu"
                    role="menu"
                    data-row-menu-for="${escapeHtml(entry.id)}"
                    ${isMenuOpen ? "" : "hidden"}
                  >
                    <a
                      href="${buildEntryHash(entry.slug)}"
                      role="menuitem"
                      class="desk-row-menu-item"
                      data-atlas-action="desk-direct-read"
                      data-entry-id="${escapeHtml(entry.id)}"
                    >直接阅读</a>
                    <button
                      type="button"
                      role="menuitem"
                      class="desk-row-menu-item ${isSaved ? "active" : ""}"
                      data-atlas-action="toggle-save"
                      data-entry-id="${escapeHtml(entry.id)}"
                    >${isSaved ? "★ 已收藏" : "＋ 收藏"}</button>
                    ${readOnly ? "" : `<a
                      href="${buildStudioHash(entry.slug)}"
                      role="menuitem"
                      class="desk-row-menu-item"
                    >✎ 编辑档案</a>`}
                    <button
                      type="button"
                      role="menuitem"
                      class="desk-row-menu-item"
                      data-atlas-action="desk-export-txt"
                      data-entry-id="${escapeHtml(entry.id)}"
                    >⇩ 导出 TXT</button>
                  </div>
                </div>
              </div>
            `;
          })
          .join("")
      : `
        <div class="desk-empty-state">
          <p class="desk-empty-title">当前检索条件下无匹配档案</p>
          <p class="desk-empty-sub">请尝试简化搜索关键词，或清除筛选条件。</p>
          <button
            type="button"
            class="desk-empty-reset-btn"
            data-atlas-action="reset-library-filters"
          >清除筛选条件</button>
        </div>
      `;

  const isSelectedDraft =
    selectedEntry &&
    (selectedEntry.category === "inbox" || selectedEntry.status === "draft");

  const selectedContextText = selectedEntry
    ? isSelectedDraft
      ? `已选 <strong>${escapeHtml(deskDisplayCode(selectedEntry))}</strong> · 草稿箱 <span class="desk-context-muted">· 无三维轨道位置</span>`
      : `已选 <strong>${escapeHtml(deskDisplayCode(selectedEntry))}</strong> · ${escapeHtml(deskDomainTitle(selectedEntry.category, selectedEntry.categoryTitle))}`
    : `当前无结果内选择 · 共 ${String(entries.length).padStart(2, "0")} 份档案`;

  const noticeEntry = state.unfiltered3DNoticeId
    ? knowledgeRepository.byId(state.unfiltered3DNoticeId)
    : undefined;
  const unfilteredNoticeHtml =
    noticeEntry && (!selectedEntry || selectedEntry.id !== noticeEntry.id)
      ? `
        <span class="desk-unfiltered-notice">
          三维当前档案 <b>${escapeHtml(deskDisplayCode(noticeEntry))}</b> 不在当前筛选中
          <button
            type="button"
            class="desk-unfiltered-reveal"
            data-atlas-action="reveal-3d-selection"
            data-entry-id="${escapeHtml(noticeEntry.id)}"
          >显示该档案</button>
        </span>
      `
      : "";

  const primaryActionHtml = isSelectedDraft && selectedEntry
    ? readOnly ? "" : `<a href="${buildStudioHash(selectedEntry.slug)}" class="desk-act-primary">继续编撰草稿 ↗</a>`
    : hasWebGL
      ? `<button
          type="button"
          class="desk-act-primary"
          data-atlas-action="desk-enter-3d"
          ${selectedEntry ? `data-entry-id="${escapeHtml(selectedEntry.id)}"` : ""}
        >${selectedEntry ? "进入三维档案室 ↗" : "进入三维档案室概览 ↗"}</button>`
      : "";

  return `
    <div class="desk-bridge-stage" aria-label="二维知识索引目录">
      <div class="desk-outer-brand" aria-hidden="true">RHINE LAB / ATLAS</div>

      <!-- Glass Index Desk / 检索桥主体 -->
      <section class="glass-index-desk" role="region" aria-label="ATLAS / LIBRARY 知识索引台">
        <div class="desk-glass-lip-top" aria-hidden="true"></div>
        <div class="desk-rail-left" aria-hidden="true"><i></i></div>
        <div class="desk-rail-right" aria-hidden="true"><i></i></div>

        <!-- Stage 02 (80-340ms) Retreating Glass Anchor -->
        <div class="desk-transition-anchor" aria-hidden="true">
          <div class="desk-anchor-row">
            <i class="desk-row-amber-mark"></i>
            <b class="desk-anchor-code">${escapeHtml(selectedEntry ? deskDisplayCode(selectedEntry) : "T-001")}</b>
            <span class="desk-anchor-title">${escapeHtml(selectedEntry?.title ?? "RHINE LAB ARCHIVE DIRECTORY")}</span>
          </div>
          <div class="desk-anchor-amber-rule"></div>
        </div>

        <div class="desk-surface-plate">
          <!-- 上沿：ATLAS / LIBRARY · 知识索引 + 搜索 / 筛选 / 新建 一行完成 -->
          <header class="desk-top-bar">
            <div class="desk-heading-block">
              <span class="desk-kicker">ATLAS / LIBRARY</span>
              <h2 class="desk-title">知识索引</h2>
            </div>

            <div class="desk-controls-row">
              <div class="desk-search-field ${state.query.trim() ? "has-query" : ""}">
                <span class="desk-search-icon" aria-hidden="true">⌕</span>
                <input
                  id="atlas-library-search"
                  type="search"
                  autocomplete="off"
                  placeholder="搜索标题、编号或正文"
                  value="${escapeHtml(state.query)}"
                  aria-label="搜索标题、编号或正文"
                />
                ${
                  state.query.trim()
                    ? `<button type="button" class="desk-search-clear" data-atlas-action="clear-library-query" aria-label="清除搜索关键词">×</button>`
                    : ""
                }
              </div>

              <div class="desk-filter-wrap">
                <button
                  type="button"
                  class="desk-filter-btn ${state.filterOpen ? "open" : ""} ${activeFilterCount > 0 ? "has-active" : ""}"
                  data-atlas-action="toggle-desk-filter"
                  aria-expanded="${Boolean(state.filterOpen)}"
                  aria-haspopup="dialog"
                >
                  <span aria-hidden="true">▽</span>
                  <span>筛选${activeFilterCount > 0 ? ` · ${activeFilterCount}` : ""}</span>
                </button>

                <div
                  class="desk-filter-popover"
                  role="dialog"
                  aria-label="筛选与排序条件"
                  ${state.filterOpen ? "" : "hidden"}
                >
                  <div class="desk-filter-section">
                    <span class="desk-filter-label">状态</span>
                    <div class="desk-filter-options">
                      ${statusFilters
                        .map(
                          (s) =>
                            `<button type="button" class="desk-filter-opt ${state.status === s.value ? "active" : ""}" data-library-status="${s.value}">${escapeHtml(s.label)}</button>`,
                        )
                        .join("")}
                    </div>
                  </div>

                  <div class="desk-filter-section">
                    <span class="desk-filter-label">类型</span>
                    <div class="desk-filter-options">
                      ${typeFilters
                        .map(
                          (t) =>
                            `<button type="button" class="desk-filter-opt ${state.type === t.value ? "active" : ""}" data-library-type="${t.value}">${escapeHtml(t.label)}</button>`,
                        )
                        .join("")}
                    </div>
                  </div>

                  <div class="desk-filter-section">
                    <span class="desk-filter-label">收藏与排序</span>
                    <div class="desk-filter-options">
                      <button
                        type="button"
                        class="desk-filter-opt ${state.savedOnly ? "active" : ""}"
                        data-atlas-action="toggle-library-saved-only"
                      >★ 仅看已收藏</button>
                      ${sortOptions
                        .map(
                          (so) =>
                            `<button type="button" class="desk-filter-opt ${state.sortBy === so.value ? "active" : ""}" data-library-sort="${so.value}">${escapeHtml(so.label)}</button>`,
                        )
                        .join("")}
                    </div>
                  </div>

                  <div class="desk-filter-footer">
                    <button
                      type="button"
                      class="desk-filter-reset"
                      data-atlas-action="reset-library-filters"
                    >重置筛选</button>
                  </div>
                </div>
              </div>

              ${readOnly ? "" : `<span class="desk-top-divider" aria-hidden="true">|</span>

              <a href="${buildStudioHash()}" class="desk-new-btn" title="新建档案 [N]">
                <span aria-hidden="true">＋</span>
                <span>新建</span>
              </a>`}
            </div>
          </header>

          <!-- 中部：左侧领域栏 + 主目录 -->
          <div class="desk-body">
            <nav class="desk-domain-nav" aria-label="知识领域导航">
              ${domainNavHtml}
            </nav>

            <div class="desk-directory">
              <div class="desk-dir-head" aria-hidden="true">
                <span class="desk-head-code">编号</span>
                <span class="desk-head-title">档案</span>
                <span class="desk-head-status">状态</span>
                <span class="desk-head-count">${String(entries.length).padStart(2, "0")} 份档案</span>
              </div>

              <div class="desk-dir-list" role="listbox" aria-label="档案列表">
                ${rowsHtml}
              </div>
            </div>
          </div>

          <!-- 下沿：上下文与双主次动作 -->
          <footer class="desk-bottom-bar">
            <div class="desk-context-status">
              <span class="desk-context-main">${selectedContextText}</span>
              ${unfilteredNoticeHtml}
            </div>

            <div class="desk-context-actions">
              ${
                selectedEntry
                  ? `<a
                      href="${buildEntryHash(selectedEntry.slug)}"
                      class="desk-act-secondary"
                      data-atlas-action="desk-direct-read"
                      data-entry-id="${escapeHtml(selectedEntry.id)}"
                    >直接阅读</a>`
                  : `<button type="button" class="desk-act-secondary" disabled>直接阅读</button>`
              }
              <span class="desk-act-sep" aria-hidden="true">|</span>
              ${primaryActionHtml}
            </div>
          </footer>
        </div>

        <div class="desk-glass-lip-bottom" aria-hidden="true">
          <i class="desk-lip-amber-tick"></i>
        </div>
      </section>

      <!-- 台下阵列视窗标识 (底部露出 12-16% 屏高的实体档案阵列) -->
      <div class="desk-under-array-window" aria-hidden="true">
        <span class="desk-under-array-label">ARCHIVE ARRAY</span>
      </div>
    </div>
  `;
}
