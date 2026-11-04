import { escapeHtml } from "../html.ts";
import { buildEntryHash, buildStudioHash } from "../app/router.ts";
import { knowledgeRepository } from "./repository.ts";
import { resolveEntryRelations } from "./graph.ts";
import type { KnowledgeEntry } from "./types.ts";

export type AuditIssueKind =
  | "broken-link"
  | "orphan-node"
  | "missing-quickstart"
  | "stale-review"
  | "inbox-draft";

export interface KnowledgeAuditIssue {
  kind: AuditIssueKind;
  severity: "warning" | "info";
  entryId: string;
  slug: string;
  visualCode: string;
  title: string;
  category: string;
  detail: string;
  brokenTargets?: string[];
}

export interface KnowledgeHealthReport {
  healthScore: number;
  totalChecked: number;
  brokenLinkCount: number;
  orphanCount: number;
  missingQuickstartCount: number;
  staleOrReviewCount: number;
  inboxDraftCount: number;
  issues: KnowledgeAuditIssue[];
}

function extractUnresolvedWikiTargets(
  entry: KnowledgeEntry,
  allEntries: KnowledgeEntry[],
): string[] {
  const broken = new Set<string>();

  // 1. Check rendered HTML for .atlas-unresolved-link spans
  const htmlRegex =
    /<span[^>]*class="[^"]*atlas-unresolved-link[^"]*"[^>]*data-unresolved-target="([^"]+)"/gi;
  let match: RegExpExecArray | null;
  while ((match = htmlRegex.exec(entry.html)) !== null) {
    if (match[1]) broken.add(match[1].trim());
  }

  // 2. Also scan raw markdown outside fenced & inline code blocks for non-image [[target]]
  const rawMd = (entry.markdown ?? "")
    .replace(/^[ \t]*(?:```|~~~)[^\n]*\n[\s\S]*?^[ \t]*(?:```|~~~)[ \t]*$/gm, "")
    .replace(/`[^`\n]+`/g, "");
  const wikiRegex = /(?<!\!)\[\[([^\]|#\n]+)(?:#[^\]|\n]+)?(?:\|[^\]\n]+)?\]\]/g;
  while ((match = wikiRegex.exec(rawMd)) !== null) {
    const rawTarget = (match[1] ?? "").trim();
    if (!rawTarget) continue;
    const clean = rawTarget.replace(/\.md$/i, "").replace(/^\/+|\/+$/g, "");
    const cleanLower = clean.toLowerCase();
    const resolved =
      knowledgeRepository.bySlug(clean) ??
      knowledgeRepository.byId(clean) ??
      allEntries.find(
        (e) =>
          e.id.toLowerCase() === cleanLower ||
          e.slug.toLowerCase() === cleanLower ||
          e.title.toLowerCase() === cleanLower ||
          e.slug.split("/").pop()?.toLowerCase() === cleanLower ||
          (e.aliases ?? []).some((a) => a.toLowerCase() === cleanLower),
      );
    if (!resolved) {
      broken.add(rawTarget);
    }
  }

  return [...broken];
}

export function inspectKnowledgeHealth(
  entriesInput?: KnowledgeEntry[],
): KnowledgeHealthReport {
  const allEntries = entriesInput ?? knowledgeRepository.all(true);
  const issues: KnowledgeAuditIssue[] = [];

  let brokenLinkCount = 0;
  let orphanCount = 0;
  let missingQuickstartCount = 0;
  let staleOrReviewCount = 0;
  let inboxDraftCount = 0;

  for (const entry of allEntries) {
    // 1. Broken wiki-links
    const brokenTargets = extractUnresolvedWikiTargets(entry, allEntries);
    if (brokenTargets.length > 0) {
      brokenLinkCount += brokenTargets.length;
      issues.push({
        kind: "broken-link",
        severity: "warning",
        entryId: entry.id,
        slug: entry.slug,
        visualCode: entry.visualCode,
        title: entry.title,
        category: entry.category,
        detail: `包含 ${brokenTargets.length} 处未解析双链：${brokenTargets.map((t) => `[[${t}]]`).join("、")}`,
        brokenTargets,
      });
    }

    // 2. Inbox drafts awaiting promotion
    if (entry.category === "inbox" || entry.status === "draft") {
      inboxDraftCount++;
      issues.push({
        kind: "inbox-draft",
        severity: "info",
        entryId: entry.id,
        slug: entry.slug,
        visualCode: entry.visualCode,
        title: entry.title,
        category: entry.category,
        detail: "位于闪念草稿箱，建议补充验证后一键转正归档至五大正式领域",
      });
      continue;
    }

    // 3. Orphan node check (no prerequisites, no related, no backlinks)
    const rels = resolveEntryRelations(entry);
    if (rels.totalDirectCount === 0) {
      orphanCount++;
      issues.push({
        kind: "orphan-node",
        severity: "info",
        entryId: entry.id,
        slug: entry.slug,
        visualCode: entry.visualCode,
        title: entry.title,
        category: entry.category,
        detail: "孤立知识节点（无前置/关联条目或双链反链），建议补充 [[双链]] 或 related 关联",
      });
    }

    // 4. Missing Quickstart / thin structure
    if (!entry.quickstartHtml || entry.findings.length === 0) {
      missingQuickstartCount++;
      issues.push({
        kind: "missing-quickstart",
        severity: "info",
        entryId: entry.id,
        slug: entry.slug,
        visualCode: entry.visualCode,
        title: entry.title,
        category: entry.category,
        detail: "缺少「## 快速复习」结构化要点区块，建议补充核心结论列表",
      });
    }

    // 5. Review needed
    if (entry.status === "review") {
      staleOrReviewCount++;
      issues.push({
        kind: "stale-review",
        severity: "info",
        entryId: entry.id,
        slug: entry.slug,
        visualCode: entry.visualCode,
        title: entry.title,
        category: entry.category,
        detail: `标记为需校准温习（上次更新：${entry.updated}）`,
      });
    }
  }

  const penalty =
    brokenLinkCount * 8 +
    orphanCount * 3 +
    missingQuickstartCount * 3 +
    staleOrReviewCount * 2 +
    inboxDraftCount * 1;
  const healthScore = Math.max(40, Math.min(100, 100 - penalty));

  return {
    healthScore,
    totalChecked: allEntries.length,
    brokenLinkCount,
    orphanCount,
    missingQuickstartCount,
    staleOrReviewCount,
    inboxDraftCount,
    issues,
  };
}

export function renderKnowledgeAuditPanelMarkup(
  readOnly = false,
  compact = false,
): string {
  const report = inspectKnowledgeHealth();
  const displayIssues = compact ? report.issues.slice(0, 6) : report.issues;

  const kindBadgeLabel: Record<AuditIssueKind, string> = {
    "broken-link": "⚠ 悬空双链",
    "orphan-node": "◌ 孤立节点",
    "missing-quickstart": "☷ 缺少速览",
    "stale-review": "↺ 需校准",
    "inbox-draft": "⚡ 待转正草稿",
  };

  const issuesHtml =
    displayIssues.length > 0
      ? `<div class="atlas-audit-issue-list">
          ${displayIssues
            .map(
              (iss) => `
              <div class="atlas-audit-issue-row" data-issue-kind="${escapeHtml(iss.kind)}" data-severity="${escapeHtml(iss.severity)}">
                <div class="audit-issue-main">
                  <span class="audit-issue-badge" data-issue-kind="${escapeHtml(iss.kind)}">${escapeHtml(kindBadgeLabel[iss.kind])}</span>
                  <a href="${buildEntryHash(iss.slug)}" class="audit-issue-title">
                    <b>${escapeHtml(iss.visualCode)}</b>
                    <span>${escapeHtml(iss.title)}</span>
                  </a>
                  <p class="audit-issue-detail">${escapeHtml(iss.detail)}</p>
                </div>
                <div class="audit-issue-actions">
                  <a href="${buildEntryHash(iss.slug)}" class="audit-act-btn">阅读</a>
                  ${
                    readOnly
                      ? ""
                      : `<a href="${buildStudioHash(iss.slug)}" class="audit-act-btn is-edit">✎ 修复</a>`
                  }
                </div>
              </div>
            `,
            )
            .join("")}
        </div>`
      : `<div class="atlas-audit-clean">✓ 全库 ${report.totalChecked} 份档案结构完整、双链全部连通，无悬空引用或孤立节点。</div>`;

  return `
    <div class="atlas-audit-panel" id="atlas-audit-panel">
      <div class="atlas-audit-summary-bar">
        <div class="audit-score-pill">
          <small>HEALTH INDEX</small>
          <strong>${report.healthScore}<span>/100</span></strong>
        </div>
        <div class="audit-metric-chips">
          <span class="audit-chip ${report.brokenLinkCount > 0 ? "is-warn" : ""}">悬空双链 <b>${report.brokenLinkCount}</b></span>
          <span class="audit-chip ${report.orphanCount > 0 ? "is-info" : ""}">孤立节点 <b>${report.orphanCount}</b></span>
          <span class="audit-chip">缺少速览 <b>${report.missingQuickstartCount}</b></span>
          <span class="audit-chip">需温习 <b>${report.staleOrReviewCount}</b></span>
          <span class="audit-chip">草稿箱 <b>${report.inboxDraftCount}</b></span>
        </div>
      </div>
      ${issuesHtml}
    </div>
  `;
}
