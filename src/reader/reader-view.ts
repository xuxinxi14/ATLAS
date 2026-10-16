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
    (_, _oldSrc, rest, rawMediaPath) =>
      `src="${escapeHtml(assetUrl(rawMediaPath))}"${rest}`,
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
        <div class="rhine-library-stage">
          <div class="rhine-empty-specimen" data-stagger="0">
            <span>∅</span>
            <h2>SPECIMEN NOT FOUND // 未找到指定的知识档案</h2>
            <p>请求路径：<code>${escapeHtml(slugOrId)}</code></p>
            <div style="display:flex;gap:16px;justify-content:center;margin-top:20px">
              <a href="#/library" class="solid-button" style="max-width:260px">BACK TO LIBRARY →<span>返回二维索引</span></a>
              <a href="#/home" class="solid-button secondary-solid" style="max-width:240px">TELEMETRY ↗<span>返回遥测中枢</span></a>
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

  // Build Left Sidebar Tree with Rhine Lab vertical tick indicators
  const treeGroups = [
    ...portals.map((p, idx) => ({
      id: p.id,
      code: `0${idx + 1}`,
      title: p.title,
      items: allEntries.filter((e) => e.category === p.id),
    })),
    {
      id: "inbox",
      code: "INB",
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
          return `
            <li>
              <a href="${buildEntryHash(item.slug)}" class="reader-tree-item ${active ? "active" : ""}" data-status="${escapeHtml(item.status)}" ${active ? 'aria-current="page"' : ""}>
                <span class="tree-item-tick" aria-hidden="true"></span>
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
            <span><small>${escapeHtml(group.code)}</small> ${escapeHtml(group.title)}</span>
            <b>${String(group.items.length).padStart(2, "0")}</b>
          </summary>
          <ul class="reader-tree-list">
            ${itemsHtml}
          </ul>
        </details>
      `;
    })
    .join("");

  // Prev / Next within category
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
              (item, idx) => `
              <li class="toc-level-${item.level}">
                <button type="button" class="reader-toc-link" data-scroll-heading="${escapeHtml(item.id)}">
                  <small>${String(idx + 1).padStart(2, "0")}</small>
                  <span>${escapeHtml(item.text)}</span>
                </button>
              </li>
            `,
            )
            .join("")}
        </ul>`
      : `<p class="reader-side-muted">SPECIMEN COMPACT // 精简速查微卡，无多级章节</p>`;

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
                <h4>PREREQUISITES // 前置知识</h4>
                ${prereqEntries
                  .map(
                    (r) => `
                    <a href="${buildEntryHash(r.slug)}" class="reader-rel-card">
                      <span>${escapeHtml(r.visualCode)} · ${escapeHtml(r.categoryTitle)}</span>
                      <strong>${escapeHtml(r.title)} <i>↗</i></strong>
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
                <h4>RELATED SPECIMENS // 关联知识</h4>
                ${relatedEntries
                  .map(
                    (r) => `
                    <a href="${buildEntryHash(r.slug)}" class="reader-rel-card">
                      <span>${escapeHtml(r.visualCode)} · ${escapeHtml(r.categoryTitle)}</span>
                      <strong>${escapeHtml(r.title)} <i>↗</i></strong>
                    </a>
                  `,
                  )
                  .join("")}
              </div>`
            : ""
        }
      `
      : `<p class="reader-side-muted">STANDALONE SPECIMEN // 暂无显式关联条目</p>`;

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
      : `<p class="reader-side-muted">LOCAL PRACTICE // 本地实践记录与总结</p>`;

  const githubEditUrl = `${GITHUB_REPO_EDIT_BASE}${entry.relPath}`;
  const vscodeUri = `vscode://file/e:/ATLAS/${entry.relPath}`;
  const hydratedBodyHtml = hydrateEntryHtmlImages(entry.html);

  return `
    <div class="atlas-reader-layout">
      <!-- Left Column: Knowledge Tree -->
      <aside class="atlas-reader-sidebar-left" data-stagger="0" aria-label="知识目录树">
        <div class="reader-sidebar-head">
          <a href="${buildLibraryHash(entry.category)}" class="reader-back-link">← <span>DIRECTORY // 返回索引</span></a>
        </div>
        <div class="reader-tree-scroll">
          ${sidebarTreeHtml}
        </div>
      </aside>

      <!-- Center Column: Technical Dossier -->
      <div class="atlas-reader-main" id="atlas-reader-scroll" data-stagger="1">
        <article class="atlas-article">
          <header class="reader-article-header">
            <div class="detail-kicker">
              <span>FILE ${escapeHtml(entry.globalCode)} · ${escapeHtml(entry.visualCode)} // ${escapeHtml(entry.en)}</span>
              <span>${escapeHtml(sMeta.label)} · ${escapeHtml(tMeta.label)}${entry.autoInferred ? ' · <b class="atlas-inferred-badge">AUTO-INFERRED</b>' : ""}</span>
            </div>

            <h1>${escapeHtml(entry.title)}</h1>
            <p class="reader-article-summary">${escapeHtml(entry.summary)}</p>

            <div class="detail-rule" data-rule></div>

            <dl class="metadata reader-metadata">
              <div>
                <dt>DEPARTMENT / 所属领域</dt>
                <dd><a href="${buildLibraryHash(entry.category)}">${escapeHtml(entry.categoryTitle)}</a> · ${escapeHtml(entry.department)}</dd>
              </div>
              <div>
                <dt>UPDATED / 更新与创建</dt>
                <dd>${escapeHtml(entry.updated)} <small>(CREATED ${escapeHtml(entry.created)})</small></dd>
              </div>
              <div>
                <dt>TYPE &amp; SCOPE / 适用范围</dt>
                <dd>${escapeHtml(tMeta.label)} · ${escapeHtml(entry.version_scope)}</dd>
              </div>
              <div>
                <dt>STATUS / 掌握状态</dt>
                <dd><i data-status="${escapeHtml(entry.status)}"></i>${escapeHtml(sMeta.label)} · ${escapeHtml(sMeta.en)}</dd>
              </div>
            </dl>

            <div class="reader-tags-bar">
              <div class="reader-tags-row">
                ${entry.tags.map((t) => `<a href="#/library?q=${encodeURIComponent(t)}" class="specimen-tag">#${escapeHtml(t)}</a>`).join("")}
              </div>

              <div class="reader-toolbar" role="toolbar" aria-label="档案操作">
                ${
                  hasWebGL && entry.category !== "inbox"
                    ? `<button type="button" class="specimen-act" data-atlas-action="locate-3d" data-entry-id="${escapeHtml(entry.id)}">3D 定位 ↗</button>`
                    : ""
                }
                <button type="button" class="specimen-act ${isSaved ? "active" : ""}" data-atlas-action="toggle-save" data-entry-id="${escapeHtml(entry.id)}">
                  ${isSaved ? "★ 已收藏" : "＋ 收藏档案"}
                </button>
                <a href="${escapeHtml(assetUrl(`archives/ATLAS-${entry.id}.txt`))}" download="ATLAS-${escapeHtml(entry.id)}.txt" class="specimen-act">
                  EXPORT TXT ↓
                </a>
                <a href="${escapeHtml(vscodeUri)}" class="specimen-act" title="在本地 VS Code 中直接打开此 Markdown 文件">
                  VS CODE ✎
                </a>
                <a href="${escapeHtml(githubEditUrl)}" target="_blank" rel="noopener noreferrer" class="specimen-act" title="在 GitHub 网页端编辑此 Markdown 文件">
                  GITHUB ↗
                </a>
              </div>
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
                      <small>← PREVIOUS // ${escapeHtml(prevEntry.visualCode)}</small>
                      <strong>${escapeHtml(prevEntry.title)}</strong>
                    </a>`
                  : `<div></div>`
              }
              ${
                nextEntry
                  ? `<a href="${buildEntryHash(nextEntry.slug)}" class="prev-next-card next">
                      <small>NEXT // ${escapeHtml(nextEntry.visualCode)} →</small>
                      <strong>${escapeHtml(nextEntry.title)}</strong>
                    </a>`
                  : `<div></div>`
              }
            </div>
          </footer>
        </article>
      </div>

      <!-- Right Column: TOC & Relations -->
      <aside class="atlas-reader-sidebar-right" data-stagger="2" aria-label="文章大纲与关联知识">
        <div class="reader-side-section">
          <h3>01 // ON THIS PAGE · 章节大纲</h3>
          ${tocHtml}
        </div>

        <div class="reader-side-section">
          <h3>02 // KNOWLEDGE GRAPH · 关联图谱</h3>
          ${relationsHtml}
        </div>

        <div class="reader-side-section">
          <h3>03 // SOURCE · 档案溯源</h3>
          <p class="reader-side-path"><code>${escapeHtml(entry.relPath)}</code></p>
          ${sourcesHtml}
        </div>
      </aside>
    </div>
  `;
}
