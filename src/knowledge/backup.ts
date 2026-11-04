import { knowledgeRepository } from "./repository.ts";
import {
  loadAllReaderAnnotations,
  formatAnnotationsAsMarkdownSection,
  type ReaderAnnotation,
} from "../reader/reader-notes.ts";

export interface AtlasBackupEntryItem {
  id: string;
  slug: string;
  title: string;
  category: string;
  subcategory: string;
  type: string;
  status: string;
  tags: string[];
  summary: string;
  created: string;
  updated: string;
  version_scope: string;
  source_urls: string[];
  prerequisites: string[];
  related: string[];
  aliases: string[];
  relPath: string;
  body: string;
}

export interface AtlasBackupBundle {
  schema: "atlas-knowledge-snapshot/v1";
  exportedAt: string;
  totalEntries: number;
  userState: {
    savedIds: string[];
    calibratedIds: string[];
    annotations: Record<string, ReaderAnnotation[]>;
  };
  entries: AtlasBackupEntryItem[];
}

export function createAtlasSnapshotBundle(options?: {
  savedIds?: Iterable<string>;
  calibratedIds?: Iterable<string>;
  annotations?: Record<string, ReaderAnnotation[]>;
}): AtlasBackupBundle {
  const allEntries = knowledgeRepository.all(true);
  const annotations = options?.annotations ?? loadAllReaderAnnotations();
  const savedIds = options?.savedIds ? [...options.savedIds] : [];
  const calibratedIds = options?.calibratedIds
    ? [...options.calibratedIds]
    : [];

  const entries: AtlasBackupEntryItem[] = allEntries.map((e) => ({
    id: e.id,
    slug: e.slug,
    title: e.title,
    category: e.category,
    subcategory: e.subcategory,
    type: e.type,
    status: e.status,
    tags: [...e.tags],
    summary: e.summary,
    created: e.created,
    updated: e.updated,
    version_scope: e.version_scope,
    source_urls: [...e.source_urls],
    prerequisites: [...e.prerequisites],
    related: [...e.related],
    aliases: [...(e.aliases ?? [])],
    relPath: e.relPath,
    body: e.markdown ?? e.plainText,
  }));

  return {
    schema: "atlas-knowledge-snapshot/v1",
    exportedAt: new Date().toISOString(),
    totalEntries: entries.length,
    userState: {
      savedIds,
      calibratedIds,
      annotations,
    },
    entries,
  };
}

export function serializeAtlasSnapshotJson(options?: {
  savedIds?: Iterable<string>;
  calibratedIds?: Iterable<string>;
  annotations?: Record<string, ReaderAnnotation[]>;
}): string {
  const bundle = createAtlasSnapshotBundle(options);
  return JSON.stringify(bundle, null, 2) + "\n";
}

export function createAtlasFullMarkdownBundleText(options?: {
  savedIds?: Iterable<string>;
  calibratedIds?: Iterable<string>;
  annotations?: Record<string, ReaderAnnotation[]>;
}): string {
  const bundle = createAtlasSnapshotBundle(options);
  const today = bundle.exportedAt.slice(0, 10);
  const sections: string[] = [
    `# ATLAS // PERSONAL KNOWLEDGE TERMINAL — 全库归档合集`,
    ``,
    `- **导出日期**：${today}`,
    `- **档案总数**：${bundle.totalEntries} 份`,
    `- **已收藏数**：${bundle.userState.savedIds.length} 份`,
    ``,
    `---`,
    ``,
  ];

  for (const item of bundle.entries) {
    const entryNotes = bundle.userState.annotations[item.id] ?? [];
    const notesMd = formatAnnotationsAsMarkdownSection(entryNotes);
    sections.push(
      `<!-- === ATLAS FILE: ${item.relPath} (ID: ${item.id} | SLUG: ${item.slug}) === -->`,
      "```yaml",
      `id: ${item.id}`,
      `title: ${JSON.stringify(item.title)}`,
      `slug: ${item.slug}`,
      `type: ${item.type}`,
      `category: ${item.category}`,
      `subcategory: ${item.subcategory}`,
      `status: ${item.status}`,
      `tags: [${item.tags.join(", ")}]`,
      `summary: ${JSON.stringify(item.summary)}`,
      `created: ${item.created}`,
      `updated: ${item.updated}`,
      `version_scope: ${JSON.stringify(item.version_scope)}`,
      "```",
      "",
      item.body.trim(),
      ...(notesMd ? ["", notesMd] : []),
      "",
      "---",
      "",
    );
  }

  return sections.join("\n");
}

export function parseAndValidateAtlasSnapshot(
  rawJson: string,
): { ok: true; bundle: AtlasBackupBundle } | { ok: false; error: string } {
  try {
    const parsed = JSON.parse(String(rawJson ?? "").trim());
    if (!parsed || typeof parsed !== "object") {
      return { ok: false, error: "快照文件格式无效（非 JSON 对象）" };
    }
    if (parsed.schema !== "atlas-knowledge-snapshot/v1") {
      return {
        ok: false,
        error: `不支持的快照版本：${String(parsed.schema ?? "unknown")}`,
      };
    }
    if (!Array.isArray(parsed.entries)) {
      return { ok: false, error: "快照缺少 entries 数组" };
    }
    const userState = parsed.userState && typeof parsed.userState === "object"
      ? parsed.userState
      : {};
    const bundle: AtlasBackupBundle = {
      schema: "atlas-knowledge-snapshot/v1",
      exportedAt: String(parsed.exportedAt ?? new Date().toISOString()),
      totalEntries: parsed.entries.length,
      userState: {
        savedIds: Array.isArray(userState.savedIds)
          ? userState.savedIds.map(String)
          : [],
        calibratedIds: Array.isArray(userState.calibratedIds)
          ? userState.calibratedIds.map(String)
          : [],
        annotations:
          userState.annotations && typeof userState.annotations === "object"
            ? userState.annotations
            : {},
      },
      entries: parsed.entries,
    };
    return { ok: true, bundle };
  } catch (err) {
    return {
      ok: false,
      error: `JSON 解析失败：${err instanceof Error ? err.message : String(err)}`,
    };
  }
}
