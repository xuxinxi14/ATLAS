import { assetUrl } from "../asset-url.ts";
import { escapeHtml } from "../html.ts";
import { publicReadOnly } from "../public-mode.ts";
import {
  knowledgeRepository,
  statusMeta,
  typeMeta,
} from "../knowledge/repository.ts";
import type { KnowledgeEntry } from "../knowledge/types.ts";
import {
  buildEntryHash,
  buildLibraryHash,
  buildStudioHash,
} from "../app/router.ts";

export function hydrateEntryHtmlImages(html: string): string {
  return html.replace(
    /src="([^"]+)"(\s+alt="[^"]*"\s+loading="lazy"\s+data-atlas-image="([^"]+)")/g,
    (_, _oldSrc, rest, rawMediaPath) =>
      `src="${escapeHtml(assetUrl(rawMediaPath))}"${rest}`,
  );
}

/**
 * Prefetch images referenced by an entry immediately upon clicking "展开全文" (0–220ms takeover stage).
 */
export function prefetchEntryAssets(slugOrId: string): Promise<void> {
  const entry =
    knowledgeRepository.bySlug(slugOrId) ?? knowledgeRepository.byId(slugOrId);
  if (!entry) return Promise.resolve();
  const urls: string[] = [];
  const regex = /data-atlas-image="([^"]+)"/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(entry.html)) !== null) {
    urls.push(assetUrl(match[1]));
  }
  if (urls.length === 0) return Promise.resolve();
  return Promise.allSettled(
    urls.map(
      (src) =>
        new Promise<void>((resolve) => {
          const img = new Image();
          img.onload = () => resolve();
          img.onerror = () => resolve();
          img.src = src;
        }),
    ),
  ).then(() => undefined);
}

/**
 * Remove duplicate leading "快速复习" heading only if needed, or enhance ordered steps rhythm.
 */
function formatOpticalBodyHtml(rawHtml: string): string {
  return hydrateEntryHtmlImages(rawHtml);
}

export function renderReaderViewMarkup(
  slugOrId: string,
  savedIds: Set<string>,
  hasWebGL = true,
  origin = { hash: "#/archive", label: "档案大厅" },
  readOnly = publicReadOnly,
): string {
  const entry =
    knowledgeRepository.bySlug(slugOrId) ?? knowledgeRepository.byId(slugOrId);
  if (!entry) {
    return `
      <div class="atlas-surface-scroll">
        <div class="rhine-library-stage">
          <div class="rhine-empty-specimen" data-stagger="0">
            <span>∅</span>
            <h2>SPECIMEN NOT FOUND // 未找到指定的知识档案</h2>
            <p>请求路径：<code>${escapeHtml(slugOrId)}</code></p>
            <div style="display:flex;gap:16px;justify-content:center;margin-top:20px">
              <a href="${escapeHtml(origin.hash)}" class="solid-button" style="max-width:260px">← ${escapeHtml(origin.label)}<span>返回来源页面</span></a>
              <a href="#/library" class="solid-button secondary-solid" style="max-width:240px">2D LIBRARY ↗<span>返回二维索引</span></a>
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

  // Build on-demand Archive Directory Tree (inside the collapsible 目录 drawer)
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

  // On-demand TOC list
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
      : `<p class="reader-side-muted">本篇为精简速查微卡，无多级章节目录</p>`;

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
                <h4>前置知识 // PREREQUISITES</h4>
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
                <h4>关联知识 // RELATED SPECIMENS</h4>
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
      : `<p class="reader-side-muted">本地实践记录与技术总结</p>`;

  const hydratedBodyHtml = formatOpticalBodyHtml(entry.html);

  return `
    <div class="optical-reader-stage" id="optical-reader-stage" data-has-webgl="${hasWebGL}">
      <!-- Top-Right Optical Reader Stage Signature (matches reference top-right) -->
      <div class="optical-stage-signature" aria-hidden="true">
        <b>ATLAS</b><span>/</span><span>OPTICAL READER</span><i></i>
      </div>

      <!-- Fallback 2D Cassette Silhouette only when WebGL is disabled -->
      ${
        !hasWebGL
          ? `<div class="optical-fallback-cassette" aria-hidden="true">
              <div class="fallback-cassette-label">
                <small>RHINE LAB, LLC.</small>
                <strong>${escapeHtml(entry.globalCode || "NO.001")}</strong>
              </div>
              <div class="fallback-cassette-rings">
                <span class="ring-large"></span>
                <span class="ring-small"></span>
              </div>
            </div>`
          : ""
      }

      <!-- The Optical Reader Screen Assembly -->
      <div class="optical-reader-device" id="optical-reader-device">
        <!-- Left Receiver Spine & Side Slot Bezel (connects 3D Cassette to Optical Screen) -->
        <div class="optical-receiver-spine" aria-hidden="true">
          <div class="optical-slot-well"></div>
          <div class="optical-slot-rail"></div>
          <span class="optical-contact-led top"></span>
          <span class="optical-contact-led mid"></span>
          <div class="optical-spine-dots top"><i></i><i></i><i></i></div>
          <div class="optical-spine-dots mid"><i></i><i></i><i></i></div>
          <div class="optical-spine-fastener"></div>
        </div>

        <!-- Main Warm-White Optical Reading Screen -->
        <div class="optical-screen-frame">
          <!-- Single Warm-Amber Activation Trace Line -->
          <div class="optical-amber-trace" aria-hidden="true"></div>

          <!-- 4 Subtle Corner Calibration Reticles -->
          <i class="optical-corner tl" aria-hidden="true"></i>
          <i class="optical-corner tr" aria-hidden="true"></i>
          <i class="optical-corner bl" aria-hidden="true"></i>
          <i class="optical-corner br" aria-hidden="true"></i>

          <!-- Top Navigation Inside Optical Screen (Only Back, Loaded Pill when receded, TOC, More) -->
          <header class="optical-screen-topbar">
            <button
              type="button"
              class="optical-return-btn"
              data-atlas-action="exit-optical-reader"
              title="退片并返回${escapeHtml(origin.label)} (Esc)"
            >
              <span class="optical-return-arrow">←</span>
              <span>${escapeHtml(origin.label)}</span>
            </button>

            <div class="optical-loaded-pill" id="optical-loaded-pill">
              <i class="optical-loaded-dot"></i>
              <span class="optical-loaded-title">${escapeHtml(entry.visualCode)} · ${escapeHtml(entry.title)}</span>
              <small>已载入</small>
            </div>

            <div class="optical-top-actions">
              <button
                type="button"
                class="optical-top-btn"
                data-optical-toggle="toc"
                aria-expanded="false"
                aria-controls="optical-toc-drawer"
              >
                目录
              </button>
              <i class="optical-top-divider" aria-hidden="true"></i>
              <button
                type="button"
                class="optical-top-btn optical-more-btn"
                data-optical-toggle="more"
                aria-expanded="false"
                aria-controls="optical-more-menu"
                aria-label="更多档案操作"
              >
                •••
              </button>
            </div>
          </header>

          <!-- More Actions Menu Popover -->
          <div class="optical-more-menu" id="optical-more-menu" hidden>
            ${readOnly ? "" : `<a href="${buildStudioHash(entry.slug)}" class="optical-menu-item">
              <span>✎ 编辑档案</span>
              <kbd>E</kbd>
            </a>`}
            <button
              type="button"
              class="optical-menu-item"
              data-atlas-action="toggle-save"
              data-entry-id="${escapeHtml(entry.id)}"
            >
              <span>${isSaved ? "★ 取消收藏" : "☆ 收藏档案"}</span>
              <kbd>S</kbd>
            </button>
            <button
              type="button"
              class="optical-menu-item"
              data-optical-action="toggle-dossier"
            >
              <span>ⓘ 档案信息与溯源</span>
              <kbd>I</kbd>
            </button>
            <button
              type="button"
              class="optical-menu-item"
              data-optical-action="toggle-recede"
              aria-pressed="false"
            >
              <span id="optical-recede-label">⇄ 宽幅沉浸阅读</span>
              <kbd>F</kbd>
            </button>
            <a
              href="${escapeHtml(assetUrl(`archives/ATLAS-${entry.id}.txt`))}"
              download="ATLAS-${escapeHtml(entry.id)}.txt"
              class="optical-menu-item"
            >
              <span>↓ 导出 TXT 档案</span>
              <kbd>.TXT</kbd>
            </a>
            <a href="${buildLibraryHash(entry.category)}" class="optical-menu-item">
              <span>⌕ 二维知识索引</span>
              <kbd>L</kbd>
            </a>
          </div>

          <!-- On-Demand Slide-Over Drawer: TOC & Archive Directory (Collapsed by default) -->
          <aside class="optical-toc-drawer" id="optical-toc-drawer" hidden>
            <div class="optical-drawer-head">
              <div class="optical-drawer-tabs">
                <button type="button" class="optical-drawer-tab active" data-optical-drawer-tab="toc">本文章节 (${entry.toc.length})</button>
                <button type="button" class="optical-drawer-tab" data-optical-drawer-tab="tree">全部档案 (${allEntries.length})</button>
              </div>
              <button type="button" class="optical-drawer-close" data-optical-toggle="toc" aria-label="收起目录">×</button>
            </div>
            <div class="atlas-reader-sidebar-right optical-drawer-pane" id="optical-pane-toc">
              ${tocHtml}
            </div>
            <div class="atlas-reader-sidebar-left optical-drawer-pane" id="optical-pane-tree" hidden>
              ${sidebarTreeHtml}
            </div>
          </aside>

          <!-- Center Single-Column Scrollable Reading Canvas -->
          <div class="optical-screen-scroll" id="atlas-reader-scroll">
            <article class="optical-reading-column">
              <!-- Above-the-fold Single Reading Order: Code/Portal -> Title -> Summary -> Rule -> Body -->
              <header class="optical-article-header">
                <div class="optical-header-reveal">
                  <div class="optical-meta-line">
                    <span class="optical-meta-code">${escapeHtml(entry.visualCode)}</span>
                    <span class="optical-meta-sep" aria-hidden="true">/</span>
                    <span>${escapeHtml(entry.categoryTitle)}</span>
                  </div>
                  <h1>${escapeHtml(entry.title)}</h1>
                </div>
                <div class="optical-body-reveal">
                  <p class="optical-article-summary">${escapeHtml(entry.summary)}</p>
                  <div class="optical-article-rule" role="separator"></div>
                </div>
              </header>

              <!-- Main Markdown Body (18-20px, 1.78-1.85 line-height, 680-760px column) -->
              <div class="reader-markdown-body optical-markdown-body optical-body-reveal">
                ${hydratedBodyHtml}
              </div>

              <!-- Merged Metadata, Tags, Sources & Related Knowledge (Collapsed by default, expanded on demand) -->
              <details class="optical-archive-dossier optical-body-reveal" id="optical-archive-dossier">
                <summary>
                  <span>档案信息 · ARCHIVE METADATA &amp; RELATIONS</span>
                  <small>${escapeHtml(sMeta.label)} · 更新于 ${escapeHtml(entry.updated)}${entry.autoInferred ? ' · <b class="atlas-inferred-badge">AUTO-INFERRED</b>' : ""}</small>
                </summary>
                <div class="optical-dossier-grid">
                  <dl class="optical-dossier-meta">
                    <div>
                      <dt>编号与序列</dt>
                      <dd>${escapeHtml(entry.globalCode)} · ${escapeHtml(entry.visualCode)} (${escapeHtml(entry.en)})</dd>
                    </div>
                    <div>
                      <dt>所属领域</dt>
                      <dd><a href="${buildLibraryHash(entry.category)}">${escapeHtml(entry.categoryTitle)}</a> · ${escapeHtml(entry.subcategory)}</dd>
                    </div>
                    <div>
                      <dt>适用版本</dt>
                      <dd>${escapeHtml(entry.version_scope)}</dd>
                    </div>
                    <div>
                      <dt>掌握度状态</dt>
                      <dd><i data-status="${escapeHtml(entry.status)}"></i>${escapeHtml(sMeta.label)} (${escapeHtml(sMeta.en)})</dd>
                    </div>
                    <div>
                      <dt>更新与创建</dt>
                      <dd>${escapeHtml(entry.updated)} <small>(创建于 ${escapeHtml(entry.created)})</small></dd>
                    </div>
                    <div>
                      <dt>知识形态</dt>
                      <dd>${escapeHtml(tMeta.label)}${entry.autoInferred ? ' <b class="atlas-inferred-badge">AUTO-INFERRED</b>' : ""}</dd>
                    </div>
                  </dl>

                  ${
                    entry.tags.length > 0
                      ? `<div class="optical-dossier-tags">
                          ${entry.tags.map((t) => `<a href="#/library?q=${encodeURIComponent(t)}" class="specimen-tag">#${escapeHtml(t)}</a>`).join("")}
                        </div>`
                      : ""
                  }

                  <div class="optical-dossier-relations">
                    ${relationsHtml}
                  </div>
                  <div class="optical-dossier-sources">
                    <p class="reader-side-path">源文件：<code>${escapeHtml(entry.relPath)}</code></p>
                    ${sourcesHtml}
                  </div>
                </div>
              </details>

              <!-- Consecutive Article Navigation (Triggers 0.72s short optical transition) -->
              <footer class="optical-article-footer optical-body-reveal">
                <div class="reader-prev-next">
                  ${
                    prevEntry
                      ? `<a href="${buildEntryHash(prevEntry.slug)}" class="prev-next-card prev" data-optical-short-switch="true">
                          <small>← 上一篇 // ${escapeHtml(prevEntry.visualCode)}</small>
                          <strong>${escapeHtml(prevEntry.title)}</strong>
                        </a>`
                      : `<div></div>`
                  }
                  ${
                    nextEntry
                      ? `<a href="${buildEntryHash(nextEntry.slug)}" class="prev-next-card next" data-optical-short-switch="true">
                          <small>下一篇 // ${escapeHtml(nextEntry.visualCode)} →</small>
                          <strong>${escapeHtml(nextEntry.title)}</strong>
                        </a>`
                      : `<div></div>`
                  }
                </div>
              </footer>
            </article>
          </div>

          <!-- Bottom Status Bar Inside Optical Screen (matches reference: ● LINK ESTABLISHED) -->
          <footer class="optical-screen-footbar">
            <div class="optical-link-status">
              <i class="optical-amber-dot"></i>
              <span>LINK ESTABLISHED</span>
            </div>
            <div class="optical-foot-hints">
              <span>ESC 返回</span>
              <span aria-hidden="true">·</span>
              <span>目录</span>
              <span aria-hidden="true">·</span>
              <span>更多</span>
            </div>
          </footer>
        </div>
      </div>
    </div>
  `;
}
