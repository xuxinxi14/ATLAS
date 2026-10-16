import { escapeHtml } from "../html.ts";
import {
  knowledgeRepository,
  statusMeta,
  typeMeta,
} from "../knowledge/repository.ts";
import { buildEntryHash, buildLibraryHash } from "./router.ts";

export function renderTelemetryHomeMarkup(hasWebGL = true): string {
  const telemetry = knowledgeRepository.telemetry();
  const total = Math.max(1, telemetry.totalEntries);
  const proficientPct = Math.round(
    (telemetry.statusCounts.proficient / total) * 100,
  );

  const portalCardsHtml = telemetry.portalStats
    .map((p) => {
      const pct = p.total > 0 ? Math.round((p.proficient / p.total) * 100) : 0;
      return `
        <article class="atlas-portal-card" data-portal-id="${escapeHtml(p.id)}">
          <div class="atlas-portal-card-top">
            <span class="atlas-portal-code">[${escapeHtml(p.codePrefix)}-SERIES]</span>
            <span class="atlas-portal-en">${escapeHtml(p.en)}</span>
          </div>
          <h3>${escapeHtml(p.title)}</h3>
          <p class="atlas-portal-desc">${escapeHtml(p.description)}</p>
          <div class="atlas-portal-progress" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100">
            <div class="atlas-portal-progress-bar" style="width:${pct}%"></div>
          </div>
          <div class="atlas-portal-metrics">
            <span>共 <b>${p.total}</b> 篇</span>
            <span class="metric-proficient">● 已掌握 ${p.proficient}</span>
            ${p.learning > 0 ? `<span class="metric-learning">◐ 解析中 ${p.learning}</span>` : ""}
            ${p.todo > 0 ? `<span class="metric-todo">○ 待解密 ${p.todo}</span>` : ""}
            ${p.review > 0 ? `<span class="metric-review">◈ 需校准 ${p.review}</span>` : ""}
          </div>
          <div class="atlas-portal-actions">
            <a href="${buildLibraryHash(p.id)}" class="atlas-btn atlas-btn-secondary">二维目录 (${p.total})</a>
            ${hasWebGL ? `<button type="button" class="atlas-btn atlas-btn-ghost" data-atlas-action="open-3d-portal" data-portal="${escapeHtml(p.id)}">3D 档案列 ↗</button>` : ""}
          </div>
        </article>
      `;
    })
    .join("");

  const reviewHtml =
    telemetry.reviewQueue.length > 0
      ? telemetry.reviewQueue
          .map(
            (item) => `
          <a href="${buildEntryHash(item.slug)}" class="atlas-review-item">
            <div class="atlas-review-badge">◈ 待校准</div>
            <div class="atlas-review-main">
              <strong>${escapeHtml(item.title)}</strong>
              <span>${escapeHtml(item.categoryTitle)} · 上次更新 ${escapeHtml(item.updated)} · ${escapeHtml(item.reason)}</span>
            </div>
            <span class="atlas-review-cta">30秒速览 →</span>
          </a>
        `,
          )
          .join("")
      : `<div class="atlas-review-empty">✓ 当前所有已归档技能均处于有效校准周期内</div>`;

  const recentHtml = telemetry.recentEntries
    .map((entry) => {
      const sMeta = statusMeta(entry.status);
      const tMeta = typeMeta(entry.type);
      return `
        <a href="${buildEntryHash(entry.slug)}" class="atlas-recent-row">
          <span class="atlas-code-pill">${escapeHtml(entry.visualCode)}</span>
          <span class="atlas-status-dot ${sMeta.badgeClass}" title="${escapeHtml(sMeta.label)}"></span>
          <strong class="atlas-recent-title">${escapeHtml(entry.title)}</strong>
          <span class="atlas-type-tag ${tMeta.badgeClass}">${escapeHtml(tMeta.label)}</span>
          <span class="atlas-recent-cat">${escapeHtml(entry.categoryTitle)}</span>
          <time class="atlas-recent-date">${escapeHtml(entry.updated)}</time>
        </a>
      `;
    })
    .join("");

  return `
    <div class="atlas-surface-scroll">
      <div class="atlas-container">
        <header class="atlas-hero">
          <div class="atlas-hero-left">
            <div class="atlas-eyebrow">ATLAS · PERSONAL KNOWLEDGE TERMINAL // TELEMETRY HUD</div>
            <h2>个人知识档案终端</h2>
            <p class="atlas-hero-sub">
              以本地 <code>content/**/*.md</code> 为唯一权威知识源。支持零 Front Matter 随手记、同级 <code>./assets/</code> 截图粘贴、二维三栏阅读器与三维档案大厅点亮反馈。
            </p>
            <div class="atlas-hero-actions">
              <a href="#/library" class="atlas-btn atlas-btn-primary">⊞ 打开二维知识索引 (${telemetry.totalEntries})</a>
              ${
                hasWebGL
                  ? `<button type="button" class="atlas-btn atlas-btn-accent" data-atlas-action="enter-archive">◈ 进入三维档案大厅 ↗</button>`
                  : `<span class="atlas-webgl-fallback-note">当前环境未启用 WebGL，已自动为您开启全功能二维阅读模式</span>`
              }
              <button type="button" class="atlas-btn atlas-btn-secondary" data-action="search">⌕ 全局命令检索 <kbd>Ctrl+K</kbd></button>
              <button type="button" class="atlas-btn atlas-btn-ghost" data-atlas-action="quick-new-guide">＋ 如何快速记笔记</button>
            </div>
          </div>

          <div class="atlas-telemetry-box" aria-label="系统遥测统计">
            <div class="telemetry-header">
              <span>SYSTEM TELEMETRY</span>
              <span>UPDATED: ${escapeHtml(telemetry.generatedAt)}</span>
            </div>
            <div class="telemetry-kpi-grid">
              <div class="telemetry-kpi">
                <span class="kpi-label">已归档正式条目</span>
                <strong class="kpi-value">${String(telemetry.totalEntries).padStart(2, "0")}</strong>
                <small>掌握率 ${proficientPct}%</small>
              </div>
              <div class="telemetry-kpi">
                <span class="kpi-label">点亮实体卡 (已掌握)</span>
                <strong class="kpi-value kpi-proficient">${String(telemetry.statusCounts.proficient).padStart(2, "0")}</strong>
                <small>● PROFICIENT</small>
              </div>
              <div class="telemetry-kpi">
                <span class="kpi-label">学习中 / 待解密槽</span>
                <strong class="kpi-value kpi-learning">${telemetry.statusCounts.learning} / ${telemetry.statusCounts.todo}</strong>
                <small>◐ LEARNING / ○ TODO</small>
              </div>
              <div class="telemetry-kpi">
                <span class="kpi-label">速查微卡 / 草稿箱</span>
                <strong class="kpi-value">${telemetry.typeCounts.snippet} / ${telemetry.inboxCount}</strong>
                <small>SNIPPET / INBOX</small>
              </div>
            </div>
            <div class="telemetry-status-legend">
              <span class="legend-item"><i class="dot status-proficient"></i>已掌握 (${telemetry.statusCounts.proficient})</span>
              <span class="legend-item"><i class="dot status-learning"></i>解析中 (${telemetry.statusCounts.learning})</span>
              <span class="legend-item"><i class="dot status-todo"></i>待解密虚影 (${telemetry.statusCounts.todo})</span>
              <span class="legend-item"><i class="dot status-review"></i>需校准 (${telemetry.statusCounts.review})</span>
              <a href="#/library/inbox" class="legend-item legend-inbox"><i class="dot status-draft"></i>闪念草稿箱 (${telemetry.inboxCount})</a>
            </div>
          </div>
        </header>

        <section class="atlas-section" aria-label="待复习校准队列">
          <div class="atlas-section-head">
            <h3>◈ 待校准与温习提醒 (REVIEW QUEUE)</h3>
            <span>自动筛选标记为 <code>review</code> 或超过 180 天未校准的操作档案</span>
          </div>
          <div class="atlas-review-list">
            ${reviewHtml}
          </div>
        </section>

        <section class="atlas-section" aria-label="五大知识门户">
          <div class="atlas-section-head">
            <h3>五大知识领域门户 (KNOWLEDGE PORTALS)</h3>
            <span>对应三维大厅五列档案架 · 支持任意数量文档动态扩展</span>
          </div>
          <div class="atlas-portal-grid">
            ${portalCardsHtml}
          </div>
        </section>

        <div class="atlas-two-col-section">
          <section class="atlas-section" aria-label="最近更新档案">
            <div class="atlas-section-head">
              <h3>最近更新档案 (RECENT UPDATES)</h3>
              <a href="#/library" class="atlas-link-more">查看全部 →</a>
            </div>
            <div class="atlas-recent-list">
              ${recentHtml}
            </div>
          </section>

          <section class="atlas-section" aria-label="零阻力记录工作流">
            <div class="atlas-section-head">
              <h3>⚡ 零阻力记录三种方式 (QUICK AUTHORING)</h3>
            </div>
            <div class="atlas-workflow-cards">
              <div class="workflow-card">
                <strong>1. Obsidian / VS Code 直写（最推荐）</strong>
                <p>用 Obsidian 打开 <code>content/</code> 目录，在任一分类或 <code>inbox/</code> 下新建 <code>.md</code>。<strong>无需手填 Front Matter</strong>，直接写 <code># 标题</code> 和正文，截图直接 <code>Ctrl+V</code> 存入同级 <code>./assets/</code>。</p>
              </div>
              <div class="workflow-card">
                <strong>2. 命令行一键生成模板</strong>
                <p>终端执行 <code>npm run new "笔记标题"</code>（默认进入草稿箱）或 <code>npm run new tools "Aegisub 打轴"</code>，秒级创建带快速复习区的文件。</p>
              </div>
              <div class="workflow-card">
                <strong>3. AI Agent 对话一键归档</strong>
                <p>在排错或学习后直接告诉 AI：「把刚才的排错过程归档到 ATLAS」，自动生成合规 Markdown 并运行校验构建。</p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  `;
}
