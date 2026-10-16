import manifestData from "../generated/entries-manifest.json" with { type: "json" };
import telemetryData from "../generated/telemetry.json" with { type: "json" };
import type {
  EntryId,
  EntryStatus,
  EntryType,
  KnowledgeEntry,
  PortalDefinition,
  TelemetryData,
} from "./types";

const portalsList = manifestData.portals as PortalDefinition[];
const allEntries = manifestData.entries as KnowledgeEntry[];
const publishedEntries = allEntries.filter((e) => e.category !== "inbox");

const idMap = new Map<EntryId, KnowledgeEntry>();
const slugMap = new Map<string, KnowledgeEntry>();

for (const entry of allEntries) {
  idMap.set(entry.id, entry);
  slugMap.set(entry.slug.replace(/^\/+|\/+$/g, ""), entry);
  for (const alias of entry.aliases) {
    slugMap.set(alias.replace(/^\/+|\/+$/g, ""), entry);
  }
}

export const knowledgeRepository = {
  all(includeDrafts = false): KnowledgeEntry[] {
    return includeDrafts ? allEntries : publishedEntries;
  },
  byId(id: EntryId): KnowledgeEntry | undefined {
    return idMap.get(id);
  },
  bySlug(slug: string): KnowledgeEntry | undefined {
    const clean = decodeURIComponent(slug).replace(/^\/+|\/+$/g, "");
    return slugMap.get(clean) ?? idMap.get(clean);
  },
  listByCategory(category: string, includeDrafts = false): KnowledgeEntry[] {
    const source = includeDrafts ? allEntries : publishedEntries;
    if (!category || category === "all" || category === "全部档案") {
      return source;
    }
    return allEntries.filter(
      (e) => e.category === category || e.categoryTitle === category,
    );
  },
  portals(): PortalDefinition[] {
    return portalsList;
  },
  telemetry(): TelemetryData {
    return telemetryData as unknown as TelemetryData;
  },
};

export function statusMeta(status: EntryStatus): {
  label: string;
  en: string;
  badgeClass: string;
  hint: string;
} {
  switch (status) {
    case "proficient":
      return {
        label: "已掌握",
        en: "PROFICIENT",
        badgeClass: "status-proficient",
        hint: "已验证归档 · 实体常亮卡",
      };
    case "learning":
      return {
        label: "解析中",
        en: "LEARNING",
        badgeClass: "status-learning",
        hint: "学习实践中 · 琥珀指示灯",
      };
    case "todo":
      return {
        label: "待解密",
        en: "TODO SLOT",
        badgeClass: "status-todo",
        hint: "计划学习占位 · 半透明虚影卡槽",
      };
    case "review":
      return {
        label: "需校准",
        en: "NEEDS REVIEW",
        badgeClass: "status-review",
        hint: "建议复习或核对版本更新",
      };
    case "draft":
    default:
      return {
        label: "闪念草稿",
        en: "INBOX DRAFT",
        badgeClass: "status-draft",
        hint: "草稿收集箱待整理条目",
      };
  }
}

export function typeMeta(type: EntryType): {
  label: string;
  en: string;
  badgeClass: string;
} {
  switch (type) {
    case "concept":
      return { label: "核心概念", en: "CONCEPT", badgeClass: "type-concept" };
    case "skill":
      return { label: "技能操作", en: "SKILL SOP", badgeClass: "type-skill" };
    case "troubleshooting":
      return {
        label: "故障排错",
        en: "TROUBLESHOOT",
        badgeClass: "type-troubleshooting",
      };
    case "snippet":
    default:
      return {
        label: "速查微卡",
        en: "QUICK SNIPPET",
        badgeClass: "type-snippet",
      };
  }
}
