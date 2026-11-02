import { escapeHtml } from "../html.ts";
import { buildEntryHash } from "../app/router.ts";
import { knowledgeRepository, statusMeta, typeMeta } from "./repository.ts";
import type { KnowledgeEntry } from "./types.ts";

export type GraphRelationKind = "center" | "prerequisite" | "related" | "backlink" | "peer";

export interface KnowledgeGraphNode {
  entry: KnowledgeEntry;
  kind: GraphRelationKind;
  x: number;
  y: number;
}

export interface KnowledgeGraphEdge {
  fromId: string;
  toId: string;
  kind: Exclude<GraphRelationKind, "center">;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface EntryRelationsBundle {
  prerequisites: KnowledgeEntry[];
  related: KnowledgeEntry[];
  backlinks: KnowledgeEntry[];
  peers: KnowledgeEntry[];
  totalDirectCount: number;
}

function extractOutboundSlugsFromHtml(html: string): Set<string> {
  const slugs = new Set<string>();
  const dataSlugRe = /data-entry-slug="([^"]+)"/g;
  let m: RegExpExecArray | null;
  while ((m = dataSlugRe.exec(html)) !== null) {
    slugs.add(decodeURIComponent(m[1]).replace(/^\/+|\/+$/g, ""));
  }
  const hrefRe = /href="#\/entry\/([^"#?]+)/g;
  while ((m = hrefRe.exec(html)) !== null) {
    slugs.add(decodeURIComponent(m[1]).replace(/^\/+|\/+$/g, ""));
  }
  return slugs;
}

export function resolveEntryRelations(entry: KnowledgeEntry): EntryRelationsBundle {
  const all = knowledgeRepository.all(true);
  const prereqSet = new Set<string>();
  const relatedSet = new Set<string>();
  const backlinkSet = new Set<string>();

  const prerequisites: KnowledgeEntry[] = [];
  for (const id of entry.prerequisites) {
    const found = knowledgeRepository.byId(id) ?? knowledgeRepository.bySlug(id);
    if (found && found.id !== entry.id && !prereqSet.has(found.id)) {
      prereqSet.add(found.id);
      prerequisites.push(found);
    }
  }

  const related: KnowledgeEntry[] = [];
  for (const id of entry.related) {
    const found = knowledgeRepository.byId(id) ?? knowledgeRepository.bySlug(id);
    if (
      found &&
      found.id !== entry.id &&
      !prereqSet.has(found.id) &&
      !relatedSet.has(found.id)
    ) {
      relatedSet.add(found.id);
      related.push(found);
    }
  }

  // Also include outbound wiki/markdown links from this entry's compiled HTML in `related`
  for (const slug of extractOutboundSlugsFromHtml(entry.html)) {
    const found = knowledgeRepository.bySlug(slug);
    if (
      found &&
      found.id !== entry.id &&
      !prereqSet.has(found.id) &&
      !relatedSet.has(found.id)
    ) {
      relatedSet.add(found.id);
      related.push(found);
    }
  }

  // Compute incoming backlinks from all other entries
  const backlinks: KnowledgeEntry[] = [];
  for (const other of all) {
    if (other.id === entry.id) continue;
    const linksViaPrereq = other.prerequisites.includes(entry.id);
    const linksViaRelated = other.related.includes(entry.id);
    const outboundSlugs = extractOutboundSlugsFromHtml(other.html);
    const linksViaBody =
      outboundSlugs.has(entry.slug) || outboundSlugs.has(entry.id);

    if (linksViaPrereq || linksViaRelated || linksViaBody) {
      if (!backlinkSet.has(other.id)) {
        backlinkSet.add(other.id);
        backlinks.push(other);
      }
    }
  }

  // Domain / shared-tag peers so isolated notes still display a contextual constellation
  const connectedIds = new Set<string>([
    entry.id,
    ...prereqSet,
    ...relatedSet,
    ...backlinkSet,
  ]);
  const entryTags = new Set(entry.tags.map((t) => t.toLowerCase()));
  const peers = all
    .filter((candidate) => !connectedIds.has(candidate.id) && candidate.category !== "inbox")
    .map((candidate) => {
      let score = candidate.category === entry.category ? 2 : 0;
      for (const t of candidate.tags) {
        if (entryTags.has(t.toLowerCase())) score += 3;
      }
      if (candidate.subcategory === entry.subcategory) score += 1;
      return { candidate, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.candidate.visualCode.localeCompare(b.candidate.visualCode))
    .slice(0, 6)
    .map((item) => item.candidate);

  const uniqueDirectIds = new Set<string>([
    ...prereqSet,
    ...relatedSet,
    ...backlinkSet,
  ]);

  return {
    prerequisites,
    related,
    backlinks,
    peers,
    totalDirectCount: uniqueDirectIds.size,
  };
}

export function buildLocalKnowledgeGraph(entry: KnowledgeEntry): {
  nodes: KnowledgeGraphNode[];
  edges: KnowledgeGraphEdge[];
  bundle: EntryRelationsBundle;
} {
  const bundle = resolveEntryRelations(entry);
  const cx = 260;
  const cy = 145;
  const centerNode: KnowledgeGraphNode = {
    entry,
    kind: "center",
    x: cx,
    y: cy,
  };

  const satelliteItems: { entry: KnowledgeEntry; kind: Exclude<GraphRelationKind, "center"> }[] = [];
  const seen = new Set<string>([entry.id]);

  for (const item of bundle.prerequisites) {
    if (!seen.has(item.id)) {
      seen.add(item.id);
      satelliteItems.push({ entry: item, kind: "prerequisite" });
    }
  }
  for (const item of bundle.related) {
    if (!seen.has(item.id)) {
      seen.add(item.id);
      satelliteItems.push({ entry: item, kind: "related" });
    }
  }
  for (const item of bundle.backlinks) {
    if (!seen.has(item.id)) {
      seen.add(item.id);
      satelliteItems.push({ entry: item, kind: "backlink" });
    }
  }

  // Ensure at least 4 satellites using domain/tag peers so the constellation stays balanced
  for (const peer of bundle.peers) {
    if (satelliteItems.length >= 6) break;
    if (!seen.has(peer.id)) {
      seen.add(peer.id);
      satelliteItems.push({ entry: peer, kind: "peer" });
    }
  }

  const capped = satelliteItems.slice(0, 8);
  const count = capped.length;
  const rx = 168;
  const ry = 96;

  const nodes: KnowledgeGraphNode[] = [centerNode];
  const edges: KnowledgeGraphEdge[] = [];

  capped.forEach((sat, idx) => {
    const angle = -Math.PI / 2 + (idx * 2 * Math.PI) / Math.max(1, count);
    const x = Math.round(cx + Math.cos(angle) * rx);
    const y = Math.round(cy + Math.sin(angle) * ry);
    nodes.push({
      entry: sat.entry,
      kind: sat.kind,
      x,
      y,
    });
    edges.push({
      fromId: sat.kind === "prerequisite" || sat.kind === "backlink" ? sat.entry.id : entry.id,
      toId: sat.kind === "prerequisite" || sat.kind === "backlink" ? entry.id : sat.entry.id,
      kind: sat.kind,
      x1: cx,
      y1: cy,
      x2: x,
      y2: y,
    });
  });

  return { nodes, edges, bundle };
}

function truncateGraphTitle(title: string, maxLen = 12): string {
  const clean = title.trim();
  return clean.length > maxLen ? `${clean.slice(0, maxLen - 1)}…` : clean;
}

export function renderLocalKnowledgeGraphMarkup(entry: KnowledgeEntry): string {
  const { nodes, edges, bundle } = buildLocalKnowledgeGraph(entry);
  const relationKindLabel: Record<GraphRelationKind, string> = {
    center: "当前档案",
    prerequisite: "前置知识",
    related: "关联知识",
    backlink: "反向引用",
    peer: "同域邻接",
  };

  const edgesSvg = edges
    .map(
      (edge) => `
        <line
          class="atlas-graph-edge is-${edge.kind}"
          x1="${edge.x1}"
          y1="${edge.y1}"
          x2="${edge.x2}"
          y2="${edge.y2}"
        />
      `,
    )
    .join("");

  const nodesSvg = nodes
    .map((node) => {
      const isCenter = node.kind === "center";
      const label = truncateGraphTitle(node.entry.title, isCenter ? 14 : 11);
      const href = buildEntryHash(node.entry.slug);
      return `
        <a
          href="${escapeHtml(href)}"
          class="atlas-graph-node is-${node.kind}"
          data-preview-entry="${escapeHtml(node.entry.id)}"
          data-node-kind="${node.kind}"
          aria-label="${escapeHtml(`${relationKindLabel[node.kind]}：${node.entry.visualCode} ${node.entry.title}`)}"
        >
          <g transform="translate(${node.x}, ${node.y})">
            <circle class="graph-node-halo" r="${isCenter ? 22 : 15}" />
            <circle class="graph-node-dot" r="${isCenter ? 6.5 : 4.5}" />
            <text class="graph-node-code" y="${isCenter ? -11 : -9}" text-anchor="middle">${escapeHtml(node.entry.visualCode)}</text>
            <text class="graph-node-title" y="${isCenter ? 21 : 17}" text-anchor="middle">${escapeHtml(label)}</text>
          </g>
        </a>
      `;
    })
    .join("");

  return `
    <div class="atlas-knowledge-graph-card" data-graph-center="${escapeHtml(entry.id)}">
      <div class="atlas-graph-head">
        <div>
          <span class="atlas-graph-kicker">KNOWLEDGE CONSTELLATION // 知识关联星图</span>
          <strong>直接关联 ${bundle.totalDirectCount} 项 · 反向引用 ${bundle.backlinks.length} 项</strong>
        </div>
        <div class="atlas-graph-legend" aria-label="图谱图例">
          <span class="legend-item is-center"><i></i>当前</span>
          <span class="legend-item is-prerequisite"><i></i>前置</span>
          <span class="legend-item is-related"><i></i>关联</span>
          <span class="legend-item is-backlink"><i></i>反链</span>
          <span class="legend-item is-peer"><i></i>同域</span>
        </div>
      </div>
      <div class="atlas-graph-canvas-wrap">
        <svg
          class="atlas-knowledge-graph-svg"
          viewBox="0 0 520 290"
          role="img"
          aria-label="${escapeHtml(`${entry.title} 知识关联网络图`)}"
        >
          <circle class="atlas-graph-orbit-ring" cx="260" cy="145" r="96" />
          <circle class="atlas-graph-orbit-ring is-outer" cx="260" cy="145" r="168" />
          <g class="atlas-graph-edges">${edgesSvg}</g>
          <g class="atlas-graph-nodes">${nodesSvg}</g>
        </svg>
      </div>
    </div>
  `;
}

export function renderHoverPreviewCardMarkup(entry: KnowledgeEntry): string {
  const sMeta = statusMeta(entry.status);
  const tMeta = typeMeta(entry.type);
  const tagsHtml = entry.tags
    .slice(0, 3)
    .map((tag) => `<span class="preview-card-tag">#${escapeHtml(tag)}</span>`)
    .join("");

  return `
    <div class="atlas-hover-preview-inner" data-preview-id="${escapeHtml(entry.id)}">
      <div class="preview-card-top">
        <span class="preview-card-code">${escapeHtml(entry.visualCode)}</span>
        <span class="preview-card-sep">/</span>
        <span class="preview-card-cat">${escapeHtml(entry.categoryTitle)}</span>
        <span class="preview-card-badge" data-status="${escapeHtml(entry.status)}">${escapeHtml(sMeta.label)} · ${escapeHtml(tMeta.label)}</span>
      </div>
      <strong class="preview-card-title">${escapeHtml(entry.title)}</strong>
      <p class="preview-card-summary">${escapeHtml(entry.summary)}</p>
      ${tagsHtml ? `<div class="preview-card-tags">${tagsHtml}</div>` : ""}
    </div>
  `;
}
