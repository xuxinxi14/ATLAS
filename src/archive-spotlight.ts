import { escapeHtml } from "./html.ts";
import { records } from "./data.ts";
import { knowledgeRepository } from "./knowledge/repository.ts";
import { buildLocalKnowledgeGraph } from "./knowledge/graph.ts";

export type ArchiveSpotlightMode =
  | "all"
  | "saved"
  | "status:review"
  | "status:learning"
  | "status:proficient"
  | "related"
  | string;

export function resolveSpotlightMatchingIndices(
  filterMode: ArchiveSpotlightMode,
  currentSelectedIdx: number,
  savedIds: ReadonlySet<string>,
): number[] {
  const mode = (filterMode || "all").trim();
  if (!mode || mode === "all") {
    return records.map((_, idx) => idx);
  }

  if (mode === "saved") {
    return records
      .map((r, idx) =>
        savedIds.has(r.id) || savedIds.has(r.entryId) ? idx : -1,
      )
      .filter((idx) => idx >= 0);
  }

  if (mode.startsWith("status:")) {
    const targetStatus = mode.slice("status:".length).trim().toLowerCase();
    return records
      .map((r, idx) => (r.status.toLowerCase() === targetStatus ? idx : -1))
      .filter((idx) => idx >= 0);
  }

  if (mode === "related") {
    const currentRec = records[currentSelectedIdx] ?? records[0];
    if (!currentRec) return [];
    const entry =
      knowledgeRepository.byId(currentRec.entryId) ??
      knowledgeRepository.bySlug(currentRec.slug);
    if (!entry) return [currentSelectedIdx];
    const graph = buildLocalKnowledgeGraph(entry);
    const connectedIds = new Set<string>([
      entry.id,
      ...graph.nodes.map((n) => n.entry.id),
    ]);
    return records
      .map((r, idx) => (connectedIds.has(r.entryId) ? idx : -1))
      .filter((idx) => idx >= 0);
  }

  if (mode.startsWith("tag:")) {
    const targetTag = mode.slice("tag:".length).trim().toLowerCase();
    return records
      .map((r, idx) =>
        r.tags.some((t) => t.toLowerCase().includes(targetTag)) ? idx : -1,
      )
      .filter((idx) => idx >= 0);
  }

  return records.map((_, idx) => idx);
}

export function stepSpotlightArchiveIndex(
  matchingIndices: number[],
  currentSelectedIdx: number,
  direction: 1 | -1 = 1,
): number {
  if (matchingIndices.length === 0) return currentSelectedIdx;
  const pos = matchingIndices.indexOf(currentSelectedIdx);
  if (pos === -1) {
    return direction > 0
      ? matchingIndices[0]
      : matchingIndices[matchingIndices.length - 1];
  }
  const nextPos =
    (pos + direction + matchingIndices.length) % matchingIndices.length;
  return matchingIndices[nextPos];
}

export function renderArchiveSpotlightHudMarkup(
  filterMode: ArchiveSpotlightMode,
  currentSelectedIdx: number,
  savedIds: ReadonlySet<string>,
): string {
  const mode = (filterMode || "all").trim();
  const matches = resolveSpotlightMatchingIndices(
    mode,
    currentSelectedIdx,
    savedIds,
  );

  const pills: { id: string; label: string; title: string }[] = [
    { id: "all", label: "ALL 全部", title: "显示全部三维阵列磁带盒" },
    { id: "related", label: "◈ 星图关联", title: "高亮当前选中档案的前后置与双链关联节点" },
    { id: "status:review", label: "↺ 需校准", title: "高亮需温习与校准的档案" },
    { id: "status:learning", label: "◐ 解析中", title: "高亮正在学习实践中的档案" },
    { id: "status:proficient", label: "● 已掌握", title: "高亮已掌握归档的档案" },
    { id: "saved", label: "★ 已收藏", title: "高亮已收藏的档案" },
  ];

  const isCustomTag =
    mode.startsWith("tag:") && !pills.some((p) => p.id === mode);
  if (isCustomTag) {
    pills.push({
      id: mode,
      label: `#${mode.slice(4)}`,
      title: `按标签 #${mode.slice(4)} 过滤三维阵列`,
    });
  }

  return `
    <div class="archive-spotlight-bar" data-active-spotlight="${escapeHtml(mode)}">
      <span class="spotlight-kicker">3D SPOTLIGHT //</span>
      <div class="spotlight-pills" role="toolbar" aria-label="三维档案阵列星图与状态筛选">
        ${pills
          .map(
            (p) => `
              <button
                type="button"
                class="spotlight-pill ${mode === p.id ? "active" : ""}"
                data-spotlight-filter="${escapeHtml(p.id)}"
                aria-pressed="${mode === p.id}"
                title="${escapeHtml(p.title)}"
              >${escapeHtml(p.label)}</button>
            `,
          )
          .join("")}
      </div>
      ${
        mode !== "all"
          ? `<div class="spotlight-match-controls">
              <span class="spotlight-match-count">命中 <b>${String(matches.length).padStart(2, "0")}</b> / ${String(records.length).padStart(2, "0")}</span>
              ${
                matches.length > 0
                  ? `<button
                      type="button"
                      class="spotlight-step-btn"
                      data-action="step-spotlight-next"
                      title="在三维阵列中跳转至下一个匹配档案"
                    >下一匹配 ⇢</button>`
                  : ""
              }
            </div>`
          : ""
      }
    </div>
  `;
}
