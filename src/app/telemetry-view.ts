import { escapeHtml } from "../html.ts";
import {
  knowledgeRepository,
  statusMeta,
  typeMeta,
} from "../knowledge/repository.ts";
import { buildEntryHash, buildLibraryHash } from "./router.ts";
import { publicReadOnly } from "../public-mode.ts";

export function renderTelemetryHomeMarkup(hasWebGL = true, readOnly = publicReadOnly): string {
  const telemetry = knowledgeRepository.telemetry();
  const allPublished = knowledgeRepository.all(false);
  const total = Math.max(1, telemetry.totalEntries);
  const proficientPct = Math.round(
    (telemetry.statusCounts.proficient / total) * 100,
  );

  // Build concentric SVG arcs for the 5 portals (Rhine Lab Orbital Scan aesthetic)
  const radii = [86, 73, 60, 47, 34];
  const orbitalArcsHtml = telemetry.portalStats
    .map((p, idx) => {
      const r = radii[idx] ?? 34;
      const circumference = +(2 * Math.PI * r).toFixed(1);
      const ratio = p.total > 0 ? Math.max(0.18, p.proficient / p.total) : 0.15;
      const arcLen = +(circumference * ratio * 0.78).toFixed(1);
      const gapLen = +(circumference - arcLen).toFixed(1);
      const rot = -90 + idx * 38;
      return `
        <circle cx="110" cy="110" r="${r}" class="orbital-track" />
        <g transform="rotate(${rot} 110 110)"><circle
          cx="110"
          cy="110"
          r="${r}"
          class="orbital-arc orbital-arc-${idx}"
          stroke-dasharray="${arcLen} ${gapLen}"
        /></g>
      `;
    })
    .join("");

  // Build global vertical tick bar for all entries
  const allTicksHtml = allPublished
    .map((entry) => {
      const sMeta = statusMeta(entry.status);
      return `<a href="${buildEntryHash(entry.slug)}" class="rhine-spectrum-tick" data-status="${escapeHtml(entry.status)}" title="${escapeHtml(entry.visualCode)} · ${escapeHtml(entry.title)} [${escapeHtml(sMeta.label)}]"></a>`;
    })
    .join("");

  // 5-Lane Architectural Matrix Columns
  const portalColumnsHtml = telemetry.portalStats
    .map((p, idx) => {
      const pct = p.total > 0 ? Math.round((p.proficient / p.total) * 100) : 0;
      const laneEntries = knowledgeRepository.listByCategory(p.id);
      const ticksHtml = laneEntries
        .map((e) => {
          const sMeta = statusMeta(e.status);
          return `<a href="${buildEntryHash(e.slug)}" class="portal-lane-tick" data-status="${escapeHtml(e.status)}" title="${escapeHtml(e.visualCode)} · ${escapeHtml(e.title)} (${escapeHtml(sMeta.label)})"></a>`;
        })
        .join("");

      return `
        <article class="rhine-portal-col" data-portal-id="${escapeHtml(p.id)}">
          <div class="portal-col-top">
            <span class="portal-col-lane">LANE 0${idx + 1}</span>
            <span class="portal-col-code">${escapeHtml(p.codePrefix)}-SERIES</span>
          </div>
          <div class="portal-col-en">${escapeHtml(p.en)}</div>
          <div class="portal-col-title-row">
            <h4>${escapeHtml(p.title)}</h4>
            <strong class="portal-col-count">${String(p.total).padStart(2, "0")}</strong>
          </div>
          <p class="portal-col-desc">${escapeHtml(p.description)}</p>
          <div class="portal-col-ticks" aria-label="${escapeHtml(p.title)} 档案刻度">
            ${ticksHtml}
          </div>
          <div class="rhine-rule-bar" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100">
            <i style="width:${pct}%"></i>
          </div>
          <div class="portal-col-stats">
            <span>CALIBRATED <b>${pct}%</b></span>
            <span>● ${p.proficient} / ${p.total}</span>
          </div>
          <div class="portal-col-actions">
            <a href="${buildLibraryHash(p.id)}" class="rhine-inline-action">2D INDEX <span>→</span></a>
            ${
              hasWebGL
                ? `<button type="button" class="rhine-inline-action" data-atlas-action="open-3d-portal" data-portal="${escapeHtml(p.id)}">3D COLUMN <span>↗</span></button>`
                : ""
            }
          </div>
        </article>
      `;
    })
    .join("");

  // Calibration / Review Queue
  const reviewHtml =
    telemetry.reviewQueue.length > 0
      ? telemetry.reviewQueue
          .map(
            (item) => `
          <a href="${buildEntryHash(item.slug)}" class="rhine-calibration-row">
            <span class="calibration-tag">◈ REVIEW</span>
            <div class="calibration-main">
              <strong>${escapeHtml(item.title)}</strong>
              <small>${escapeHtml(item.categoryTitle)} · UPDATED ${escapeHtml(item.updated)} · ${escapeHtml(item.reason)}</small>
            </div>
            <span class="calibration-go">CALIBRATE <span>↗</span></span>
          </a>
        `,
          )
          .join("")
      : `<div class="rhine-calibration-ok"><span>■</span> ALL SPECIMENS WITHIN CALIBRATION WINDOW · 全部词条处于有效校准周期内</div>`;

  // Recent Transmissions Ledger
  const recentRowsHtml = telemetry.recentEntries
    .map((entry) => {
      const sMeta = statusMeta(entry.status);
      const tMeta = typeMeta(entry.type);
      const fullEntry = knowledgeRepository.bySlug(entry.slug);
      const summaryText = fullEntry?.summary ?? entry.categoryTitle;
      return `
        <a href="${buildEntryHash(entry.slug)}" class="rhine-ledger-row">
          <span class="ledger-code">${escapeHtml(entry.visualCode)}</span>
          <span class="ledger-title-cell">
            <strong>${escapeHtml(entry.title)}</strong>
            <small>${escapeHtml(tMeta.label)} · ${escapeHtml(summaryText)}</small>
          </span>
          <span class="ledger-portal">${escapeHtml(entry.categoryTitle)}</span>
          <span class="ledger-status"><i data-status="${escapeHtml(entry.status)}"></i>${escapeHtml(sMeta.label)}</span>
          <span class="ledger-date">${escapeHtml(entry.updated)} <i>↗</i></span>
        </a>
      `;
    })
    .join("");

  return `
    <div class="home-outer-brand" aria-hidden="true">RHINE LAB / ATLAS</div>
    <section class="home-observation-deck" aria-label="玻璃总控面">
    <div class="atlas-surface-scroll">
      <div class="rhine-telemetry-stage">
        <!-- Left Wing: Observation Core & Calibration Ring -->
        <aside class="rhine-telemetry-left">
          <div class="rhine-section-kicker" data-stagger="0">
            <span>00 // SYSTEM TELEMETRY · 遥测中枢</span>
            <span>SYNTHESIZE OS // ${escapeHtml(telemetry.generatedAt)}</span>
          </div>
          <div class="rhine-anchor-rule" data-rule><i></i></div>

          <div class="rhine-title-block" data-stagger="1">
            <h2>TELEMETRY MATRIX<small>知识库观测与校准中枢</small></h2>
            <p class="rhine-subtitle">
              本地 <code>content/**/*.md</code> 实时映射 · 零 Front Matter 自动推导 · 二维编目与三维阵列同源驱动
            </p>
          </div>

          <div class="rhine-orbital-panel" data-stagger="1">
            <div class="rhine-orbital-graphic" aria-hidden="true">
              <svg viewBox="0 0 220 220">
                <g class="orbital-crosshairs">
                  <line x1="110" y1="4" x2="110" y2="18" />
                  <line x1="110" y1="202" x2="110" y2="216" />
                  <line x1="4" y1="110" x2="18" y2="110" />
                  <line x1="202" y1="110" x2="216" y2="110" />
                  <circle cx="110" cy="110" r="100" class="orbital-outer-ring" />
                </g>
                <g class="orbital-lanes">
                  ${orbitalArcsHtml}
                </g>
                <g class="orbital-nodes">
                  <circle cx="110" cy="24" r="4.5" class="orbital-amber-dot" />
                  <circle cx="170" cy="152" r="3.5" class="orbital-amber-dot-secondary" />
                </g>
              </svg>
              <div class="orbital-center-readout">
                <strong>${proficientPct}<span>%</span></strong>
                <small>MASTERED</small>
              </div>
            </div>

            <div class="rhine-kpi-column">
              <div class="rhine-giant-kpi">
                <span class="kpi-eyebrow">ARCHIVED SPECIMENS / 正式档案</span>
                <div class="kpi-giant-row">
                  <strong>${String(telemetry.totalEntries).padStart(3, "0")}</strong>
                  <span>+${String(telemetry.inboxCount).padStart(2, "0")} INBOX</span>
                </div>
              </div>

              <div class="rhine-mini-kpis">
                <div>
                  <dt>PROFICIENT / 已掌握</dt>
                  <dd>${String(telemetry.statusCounts.proficient).padStart(2, "0")}</dd>
                </div>
                <div>
                  <dt>ACTIVE / 解析与待办</dt>
                  <dd>${String(telemetry.statusCounts.learning + telemetry.statusCounts.todo).padStart(2, "0")}</dd>
                </div>
                <div>
                  <dt>SNIPPETS / 速查微卡</dt>
                  <dd>${String(telemetry.typeCounts.snippet).padStart(2, "0")}</dd>
                </div>
              </div>
            </div>
          </div>

          <div class="rhine-spectrum-block" data-stagger="2">
            <div class="spectrum-head">
              <span>SPECIMEN CALIBRATION SPECTRUM // 档案状态刻度</span>
              <span>${telemetry.totalEntries} UNITS</span>
            </div>
            <div class="rhine-spectrum-ticks" aria-label="全部档案状态刻度条">
              ${allTicksHtml}
            </div>
            <div class="rhine-spectrum-legend">
              <span><i data-status="proficient"></i>已掌握 (${telemetry.statusCounts.proficient})</span>
              <span><i data-status="learning"></i>解析中 (${telemetry.statusCounts.learning})</span>
              <span><i data-status="todo"></i>待解密 (${telemetry.statusCounts.todo})</span>
              <span><i data-status="review"></i>需校准 (${telemetry.statusCounts.review})</span>
              <a href="#/library/inbox"><i data-status="draft"></i>闪念草稿 (${telemetry.inboxCount}) ↗</a>
            </div>
          </div>

          <section class="rhine-calibration-section" data-stagger="2" aria-label="待校准与温习提醒">
            <div class="rhine-subhead">
              <span>01 // CALIBRATION QUEUE · 待校准与温习提醒</span>
              <small>REVIEW &gt; 180D</small>
            </div>
            <div class="rhine-calibration-list">
              ${reviewHtml}
            </div>
          </section>

          <section class="rhine-protocol-section" data-stagger="3" aria-label="${readOnly ? "档案浏览指引" : "零阻力归档协议"}">
            <div class="rhine-subhead">
              <span>${readOnly ? "02 // READING PROTOCOL · 档案浏览指引" : "02 // AUTHORING PROTOCOL · 零阻力记录协议"}</span>
              <small>${readOnly ? "2D INDEX + 3D ARCHIVE" : "WEB STUDIO + AI"}</small>
            </div>
            <ol class="rhine-protocol-list">
              ${readOnly
                ? `<li><span>01</span><div><strong>二维知识索引</strong> — 按领域、状态或关键词检索，选择档案后展开全文。</div></li>
                   <li><span>02</span><div><strong>三维档案大厅</strong> — 在玻璃档案阵列中浏览，进入详情并阅读完整内容。</div></li>`
                : `<li><span>01</span><div><strong>WebUI 内置编撰台 [N]</strong> — 无需打开外部软件，直接在浏览器可视化创建、编辑笔记与粘贴截图，实时写入 <code>content/</code>。</div></li>
                   <li><span>02</span><div><strong>AI 对话一键导入</strong> — 在编撰台点击「复制 AI 提示词」发给任意 AI，将生成的 Markdown 一键解析并归档入库。</div></li>`}
            </ol>
            <div class="rhine-primary-actions">
              ${readOnly ? "" : `<a href="#/studio" class="solid-button">
                ARCHIVE STUDIO ✎<span>新建或编辑笔记 [N]</span>
              </a>`}
              <a href="#/library" class="solid-button secondary-solid">
                2D LIBRARY ↗<span>二维知识索引 (${telemetry.totalEntries})</span>
              </a>
              ${
                hasWebGL
                  ? `<button type="button" class="solid-button secondary-solid" data-atlas-action="enter-archive">3D ARCHIVE →<span>进入三维档案大厅</span></button>`
                  : `<span class="atlas-webgl-fallback-note">当前环境未启用 WebGL，已自动为您开启全功能二维阅读模式</span>`
              }
            </div>
          </section>
        </aside>

        <!-- Right Wing: 5-Lane Matrix & Recent Ledger -->
        <div class="rhine-telemetry-right">
          <section class="rhine-portals-section" data-stagger="1" aria-label="五大知识领域门户">
            <div class="rhine-section-kicker">
              <span>03 // FIVE-LANE ARCHIVE MATRIX · 五大知识领域门户</span>
              <span>SYNCHRONIZED WITH 3D ARCHIVE LANES 01–05</span>
            </div>
            <div class="rhine-anchor-rule" data-rule><i></i></div>

            <div class="rhine-portal-columns">
              ${portalColumnsHtml}
            </div>
          </section>

          <section class="rhine-recent-section" data-stagger="2" aria-label="最近更新档案">
            <div class="rhine-section-kicker">
              <span>04 // RECENT TRANSMISSIONS · 最近更新与归档流</span>
              <a href="${buildLibraryHash("all")}" class="rhine-kicker-link">ALL ARCHIVES (${telemetry.totalEntries}) →</a>
            </div>
            <div class="rhine-ledger-header">
              <span>SERIAL / 编号</span>
              <span>SPECIMEN / 档案标题与摘要</span>
              <span>PORTAL / 所属门类</span>
              <span>STATUS / 掌握度</span>
              <span>UPDATED / 日期</span>
            </div>
            <div class="rhine-ledger-list">
              ${recentRowsHtml}
            </div>
          </section>
        </div>
      </div>
    </div>
    </section>
  `;
}
