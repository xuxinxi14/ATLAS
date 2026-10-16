import { assetUrl } from "../asset-url.ts";
import { escapeHtml } from "../html.ts";
import {
  knowledgeRepository,
  statusMeta,
  typeMeta,
} from "../knowledge/repository.ts";
import type { KnowledgeEntry } from "../knowledge/types.ts";
import { buildEntryHash, buildLibraryHash } from "../app/router.ts";

const GITHUB_REPO_EDIT_BASE =
  "https://github.com/xuxinxi14/Personal-Atlas/edit/main/";

export function hydrateEntryHtmlImages(html: string): string {
  return html.replace(
    /src="([^"]+)"(\s+alt="[^"]*"\s+loading="lazy"\s+data-atlas-image="([^"]+)")/g,
    (_, _oldSrc, rest, rawMediaPath) => `src="${escapeHtml(assetUrl(rawMediaPath))}"${rest}`,
  );
}

export function renderReaderViewMarkup(
  slugOrId: string,
  savedIds: Set<string>,
  hasWebGL = true,
): string {
  const entry = knowledgeRepository.bySlug(slugOrId);
  if (!entry) {
    return `
      <div class="atlas-surface-scroll">
        <div class="atlas-container">
          <div class="atlas-empty-state">
            <h2>未找到指定的知识档案</h2>
            <p>请求路径：<code>${escapeHtml(slugOrId)}</code></p>
            <div class="atlas-hero-actions" style="justify-content:center;margin-top:16px">
              <a href="#/library" class="atlas-btn atlas-btn-primary">返回二维知识索引</a>
              <a href="#/home" class="atlas-btn atlas-btn-secondary">返回遥测首页</a>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  const portals = knowledgeRepository.portals();
  const allEntries = knowledgeRepository.all(true);
  const sMeta = statusMeta(entry.status);
  const tMeta = typeMeta(entry.type);
  const isSaved = savedIds.has(entry.id) || savedIds.has(entry.globalCode);

  // Build Left Sidebar Tree
  const treeGroups = [
    ...portals.map((p) => ({
      id: p.id,
      title: p.title,
      items: allEntries.filter((e) => e.category === p.id),
    })),
    {
      id: "inbox",
      title: "闪念草稿箱",
      items: allEntries.filter((e) => e.category === "inbox"),
    },
  ].filter((g) => g.items.length > 0);

  const sidebarTreeHtml = treeGroups
    .map((group) => {
      const isCurrentGroup = group.id === entry.category;
      const itemsHtml = group.items
        .map((item) => {
          const active = item.id === entry.id;
          const itemStatus = statusMeta(item.status);
          return `
            <li>
              <a href="${buildEntryHash(item.slug)}" class="reader-tree-item ${active ? "active" : ""}" ${active ? 'aria-current="page"' : ""}>
                <span class="dot ${itemStatus.badgeClass}" title="${escapeHtml(itemStatus.label)}"></span>
                <span class="tree-item-code">${escapeHtml(item.visualCode)}</span>
                <span class="tree-item-title">${escapeHtml(item.title)}</span>
              </a>
            </li>
          `;
        })
        .join("");

      return `
        <details class="reader-tree-group" ${isCurrentGroup ? "open" : ""}>
          <summary>
            <span>${escapeHtml(group.title)}</span>
            <small>${group.items.length}</small>
          </summary>
          <ul class="reader-tree-list">
            ${itemsHtml}
          </ul>
        </details>
      `;
    })
    .join("");

  // Prev / Next within category (or all published)
  const siblings = allEntries.filter((e) => e.category === entry.category);
  const currentIdx = siblings.findIndex((e) => e.id === entry.id);
  const prevEntry: KnowledgeEntry | undefined =
    currentIdx > 0 ? siblings[currentIdx - 1] : undefined;
  const nextEntry: KnowledgeEntry | undefined =
    currentIdx >= 0 && currentIdx < siblings.length - 1
      ? siblings[currentIdx + 1]
      : undefined;

  // Right Sidebar: TOC, Prerequisites, Related, Sources
  const tocHtml =
    entry.toc.length > 0
      ? `<ul class="reader-toc-list">
          ${entry.toc
            .map(
              (item) => `
              <li class="toc-level-${item.level}">
                <button type="button" class="reader-toc-link" data-scroll-heading="${escapeHtml(item.id)}">
                  ${escapeHtml(item.text)}
                </button>
              </li>
            `,
            )
            .join("")}
        </ul>`
      : `<p class="reader-side-muted">本文为精简速查卡，无多级目录</p>`;

  const resolveRelLinks = (ids: string[]) =>
    ids
      .map((id) => knowledgeRepository.byId(id))
      .filter((x): x is KnowledgeEntry => Boolean(x));

  const prereqEntries = resolveRelLinks(entry.prerequisites);
  const relatedEntries = resolveRelLinks(entry.related);

  const relationsHtml =
    prereqEntries.length > 0 || relatedEntries.length > 0
      ? `
        ${
          prereqEntries.length > 0
            ? `<div class="reader-rel-group">
                <h4>前置知识 (PREREQUISITES)</h4>
                ${prereqEntries
                  .map(
                    (r) => `
                    <a href="${buildEntryHash(r.slug)}" class="reader-rel-card">
                      <span>${escapeHtml(r.visualCode)}</span>
                      <strong>${escapeHtml(r.title)}</strong>
                    </a>
                  `,
                  )
                  .join("")}
              </div>`
            : ""
        }
        ${
          relatedEntries.length > 0
            ? `<div class="reader-rel-group">
                <h4>关联知识 (RELATED)</h4>
                ${relatedEntries
                  .map(
                    (r) => `
                    <a href="${buildEntryHash(r.slug)}" class="reader-rel-card">
                      <span>${escapeHtml(r.visualCode)}</span>
                      <strong>${escapeHtml(r.title)}</strong>
                    </a>
                  `,
                  )
                  .join("")}
              </div>`
            : ""
        }
      `
      : `<p class="reader-side-muted">暂无显式关联条目</p>`;

  const sourcesHtml =
    entry.source_urls.length > 0
      ? `<ul class="reader-source-list">
          ${entry.source_urls
            .map(
              (url) => `
              <li>
                <a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">
                  ${escapeHtml(url)} <span aria-hidden="true">↗</span>
                </a>
              </li>
            `,
            )
            .join("")}
        </ul>`
      : `<p class="reader-side-muted">本地实践记录与经验总结</p>`;

  const githubEditUrl = `${GITHUB_REPO_EDIT_BASE}${entry.relPath}`;
  const vscodeUri = `vscode://file/e:/ATLAS/${entry.relPath}`;
  const hydratedBodyHtml = hydrateEntryHtmlImages(entry.html);

  return `
    <div class="atlas-reader-layout">
      <!-- Left Column: Knowledge Tree -->
      <aside class="atlas-reader-sidebar-left" aria-label="知识目录树">
        <div class="reader-sidebar-head">
          <a href="${buildLibraryHash(entry.category)}" class="reader-back-link">← 返回二维索引</a>
          <button type="button" class="reader-Search-trigger" data-action="search">⌕ 检索 <kbd>/</kbd></button>
        </div>
        <div class="reader-tree-scroll">
          ${sidebarTreeHtml}
        </div>
      </aside>

      <!-- Center Column: Markdown Article -->
      <div class="atlas-reader-main" id="atlas-reader-scroll">
        <article class="atlas-article">
          <nav class="reader-breadcrumbs" aria-label="面包屑导航">
            <a href="#/home">ATLAS</a>
            <span>/</span>
            <a href="${buildLibraryHash(entry.category)}">${escapeHtml(entry.categoryTitle)}</a>
            <span>/</span>
            <strong>${escapeHtml(entry.visualCode)}</strong>
          </nav>

          <header class="reader-article-header">
            <div class="reader-meta-badges">
              <span class="atlas-code-pill">${escapeHtml(entry.visualCode)}</span>
              <span class="atlas-status-pill ${sMeta.badgeClass}" title="${escapeHtml(sMeta.hint)}">
                <i class="dot ${sMeta.badgeClass}"></i>${escapeHtml(sMeta.label)} · ${escapeHtml(sMeta.en)}
              </span>
              <span class="atlas-type-tag ${tMeta.badgeClass}">${escapeHtml(tMeta.label)}</span>
              ${entry.autoInferred ? `<span class="atlas-inferred-badge" title="零 Front Matter 自动推导">AUTO-INFERRED</span>` : ""}
            </div>

            <h1>${escapeHtml(entry.title)}</h1>
            <p class="reader-article-summary">${escapeHtml(entry.summary)}</p>

            <div class="reader-meta-details">
              <span><strong>更新日期：</strong>${escapeHtml(entry.updated)}</span>
              <span><strong>创建日期：</strong>${escapeHtml(entry.created)}</span>
              <span><strong>适用范围：</strong>${escapeHtml(entry.version_scope)}</span>
              <span><strong>源文件：</strong><code>${escapeHtml(entry.relPath)}</code></span>
            </div>

            <div class="reader-tags-row">
              ${entry.tags.map((t) => `<a href="#/library?q=${encodeURIComponent(t)}" class="atlas-tag">#${escapeHtml(t)}</a>`).join("")}
            </div>

            <div class="reader-toolbar" role="toolbar" aria-label="档案操作">
              ${
                hasWebGL && entry.category !== "inbox"
                  ? `<button type="button" class="atlas-btn atlas-btn-secondary" data-atlas-action="locate-3d" data-entry-id="${escapeHtml(entry.id)}">◈ 在 3D 档案架中定位</button>`
                  : ""
              }
              <button type="button" class="atlas-btn atlas-btn-secondary ${isSaved ? "active" : ""}" data-atlas-action="toggle-save" data-entry-id="${escapeHtml(entry.id)}">
                ${isSaved ? "★ 已收藏" : "☆ 收藏档案"}
              </button>
              <a href="${escapeHtml(assetUrl(`archives/ATLAS-${entry.id}.txt`))}" download="ATLAS-${escapeHtml(entry.id)}.txt" class="atlas-btn atlas-btn-ghost">
                ↓ 导出 TXT
              </a>
              <a href="${escapeHtml(vscodeUri)}" class="atlas-btn atlas-btn-ghost" title="在本地 VS Code 中直接打开此 Markdown 文件">
                ✎ 本地编辑 (VS Code)
              </a>
              <a href="${escapeHtml(githubEditUrl)}" target="_blank" rel="noopener noreferrer" class="atlas-btn atlas-btn-ghost" title="在 GitHub 网页端编辑此 Markdown 文件">
                ✎ GitHub 编辑 ↗
              </a>
            </div>
          </header>

          <div class="reader-markdown-body">
            ${hydratedBodyHtml}
          </div>

          <footer class="reader-article-footer">
            <div class="reader-prev-next">
              ${
                prevEntry
                  ? `<a href="${buildEntryHash(prevEntry.slug)}" class="prev-next-card prev">
                      <small>← 上一篇 (${escapeHtml(prevEntry.visualCode)})</small>
                      <strong>${escapeHtml(prevEntry.title)}</strong>
                    </a>`
                  : `<div></div>`
              }
              ${
                nextEntry
                  ? `<a href="${buildEntryHash(nextEntry.slug)}" class="prev-next-card next">
                      <small>下一篇 (${escapeHtml(nextEntry.visualCode)}) →</small>
                      <strong>${escapeHtml(nextEntry.title)}</strong>
                    </a>`
                  : `<div></div>`
              }
            </div>
          </footer>
        </article>
      </div>

      <!-- Right Column: TOC & Relations -->
      <aside class="atlas-reader-sidebar-right" aria-label="文章大纲与关联知识">
        <div class="reader-side-section">
          <h3>本页大纲 (ON THIS PAGE)</h3>
          ${tocHtml}
        </div>

        <div class="reader-side-section">
          <h3>知识图谱关联 (RELATIONS)</h3>
          ${relationsHtml}
        </div>

        <div class="reader-side-section">
          <h3>参考来源 (SOURCES)</h3>
          ${sourcesHtml}
        </div>
      </aside>
    </div>
  `;
}
