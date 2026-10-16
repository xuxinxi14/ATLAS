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
import { buildEntryHash } from "../app/router.ts";
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
        `${entry.visualCode} ${entry.title} ${entry.summary} ${entry.tags.join(" ")} ${entry.plainText}`,
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
      title: "全部领域",
      count: telemetry.totalEntries,
    },
    ...portals.map((p) => ({
      id: p.id,
      title: p.title,
      count:
        telemetry.portalStats.find((s) => s.id === p.id)?.total ?? 0,
    })),
    {
      id: "inbox",
      title: "闪念草稿箱",
      count: telemetry.inboxCount,
    },
  ];

  const tabsHtml = portalTabs
    .map(
      (tab) => `
      <button
        type="button"
        class="atlas-cat-tab ${state.category === tab.id ? "active" : ""}"
        data-library-category="${escapeHtml(tab.id)}"
        aria-pressed="${state.category === tab.id}"
      >
        <span>${escapeHtml(tab.title)}</span>
        <small>${tab.count}</small>
      </button>
    `,
    )
    .join("");

  const cardsHtml =
    entries.length > 0
      ? entries
          .map((entry) => {
            const sMeta = statusMeta(entry.status);
            const tMeta = typeMeta(entry.type);
            const isSaved =
              savedIds.has(entry.id) || savedIds.has(entry.globalCode);
            return `
            <article class="atlas-entry-card ${sMeta.badgeClass}" data-entry-id="${escapeHtml(entry.id)}">
              <div class="entry-card-top">
                <div class="entry-card-codes">
                  <span class="atlas-code-pill">${escapeHtml(entry.visualCode)}</span>
                  <span class="atlas-status-pill ${sMeta.badgeClass}" title="${escapeHtml(sMeta.hint)}">
                    <i class="dot ${sMeta.badgeClass}"></i>${escapeHtml(sMeta.label)}
                  </span>
                  <span class="atlas-type-tag ${tMeta.badgeClass}">${escapeHtml(tMeta.label)}</span>
                  ${entry.autoInferred ? `<span class="atlas-inferred-badge" title="零 Front Matter 自动推导条目">AUTO</span>` : ""}
                </div>
                <span class="entry-card-cat">${escapeHtml(entry.categoryTitle)}</span>
              </div>

              <h3 class="entry-card-title">
                <a href="${buildEntryHash(entry.slug)}">${escapeHtml(entry.title)}</a>
              </h3>

              <p class="entry-card-summary">${escapeHtml(entry.summary)}</p>

              <div class="entry-card-tags">
                ${entry.tags.map((t) => `<span class="atlas-tag">#${escapeHtml(t)}</span>`).join("")}
              </div>

              <div class="entry-card-footer">
                <div class="entry-card-meta">
                  <span>更新于 ${escapeHtml(entry.updated)}</span>
                  <span>· ${escapeHtml(entry.version_scope)}</span>
                </div>
                <div class="entry-card-actions">
                  ${
                    hasWebGL && entry.category !== "inbox"
                      ? `<button type="button" class="atlas-btn-mini" data-atlas-action="locate-3d" data-entry-id="${escapeHtml(entry.id)}" title="在 3D 档案阵列中抽取该卡">◈ 3D 抽卡</button>`
                      : ""
                  }
                  <button type="button" class="atlas-btn-mini ${isSaved ? "active" : ""}" data-atlas-action="toggle-save" data-entry-id="${escapeHtml(entry.id)}" title="收藏此知识条目">${isSaved ? "★ 已收藏" : "☆ 收藏"}</button>
                  <a href="${buildEntryHash(entry.slug)}" class="atlas-btn-mini atlas-btn-mini-primary">阅读档案 →</a>
                </div>
              </div>
            </article>
          `;
          })
          .join("")
      : `
        <div class="atlas-empty-state">
          <p>当前筛选条件下未找到匹配的知识档案。</p>
          <button type="button" class="atlas-btn atlas-btn-secondary" data-atlas-action="reset-library-filters">重置全部筛选条件</button>
        </div>
      `;

  return `
    <div class="atlas-surface-scroll">
      <div class="atlas-container">
        <header class="atlas-library-header">
          <div>
            <div class="atlas-eyebrow">ATLAS · 2D KNOWLEDGE INDEX // DIRECT ACCESS</div>
            <h2>二维知识索引目录</h2>
          </div>
          <div class="atlas-library-header-actions">
            <a href="#/home" class="atlas-btn atlas-btn-ghost">← 遥测概览</a>
            ${hasWebGL ? `<button type="button" class="atlas-btn atlas-btn-secondary" data-atlas-action="enter-archive">◈ 切换至 3D 档案大厅</button>` : ""}
          </div>
        </header>

        <nav class="atlas-cat-tabs" aria-label="知识领域切换">
          ${tabsHtml}
        </nav>

        <div class="atlas-filter-bar" role="region" aria-label="多维筛选与排序">
          <div class="filter-search-wrap">
            <span class="filter-search-icon" aria-hidden="true">⌕</span>
            <input
              id="atlas-library-search"
              type="search"
              placeholder="筛选标题、标签、命令或摘要..."
              value="${escapeHtml(state.query)}"
              aria-label="筛选知识目录"
            />
          </div>

          <div class="filter-selects">
            <label>
              <span>类型</span>
              <select id="atlas-library-type">
                <option value="all" ${state.type === "all" ? "selected" : ""}>全部类型</option>
                <option value="skill" ${state.type === "skill" ? "selected" : ""}>技能操作 (Skill)</option>
                <option value="snippet" ${state.type === "snippet" ? "selected" : ""}>速查微卡 (Snippet)</option>
                <option value="concept" ${state.type === "concept" ? "selected" : ""}>核心概念 (Concept)</option>
                <option value="troubleshooting" ${state.type === "troubleshooting" ? "selected" : ""}>故障排错 (Troubleshooting)</option>
              </select>
            </label>

            <label>
              <span>状态</span>
              <select id="atlas-library-status">
                <option value="all" ${state.status === "all" ? "selected" : ""}>全部状态</option>
                <option value="proficient" ${state.status === "proficient" ? "selected" : ""}>● 已掌握 (Proficient)</option>
                <option value="learning" ${state.status === "learning" ? "selected" : ""}>◐ 解析中 (Learning)</option>
                <option value="todo" ${state.status === "todo" ? "selected" : ""}>○ 待解密 (Todo)</option>
                <option value="review" ${state.status === "review" ? "selected" : ""}>◈ 需校准 (Review)</option>
                <option value="draft" ${state.status === "draft" ? "selected" : ""}>闪念草稿 (Draft)</option>
              </select>
            </label>

            <label>
              <span>排序</span>
              <select id="atlas-library-sort">
                <option value="updated" ${state.sortBy === "updated" ? "selected" : ""}>按最近更新</option>
                <option value="status" ${state.sortBy === "status" ? "selected" : ""}>按待校准/学习状态优先</option>
                <option value="title" ${state.sortBy === "title" ? "selected" : ""}>按标题名称</option>
              </select>
            </label>

            <div class="filter-layout-toggle" role="group" aria-label="布局视图切换">
              <button type="button" class="${state.layout === "grid" ? "active" : ""}" data-library-layout="grid" title="卡片网格">⊞ 卡片</button>
              <button type="button" class="${state.layout === "list" ? "active" : ""}" data-library-layout="list" title="紧凑列表">☰ 列表</button>
            </div>
          </div>
        </div>

        <div class="atlas-library-count">
          共显示 <strong>${entries.length}</strong> 份知识档案
        </div>

        <div class="atlas-entries-container layout-${state.layout}">
          ${cardsHtml}
        </div>
      </div>
    </div>
  `;
}
