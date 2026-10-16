import {
  knowledgeRepository,
  statusMeta,
  typeMeta,
} from "./knowledge/repository.ts";
import type {
  EntryStatus,
  EntryType,
  KnowledgeEntry,
  TocItem,
} from "./knowledge/types.ts";

export interface ArchiveRecord {
  id: string;
  entryId: string;
  slug: string;
  visualCode: string;
  title: string;
  en: string;
  department: string;
  category: string;
  portalId: string;
  date: string;
  lead: string;
  clearance: string;
  abstract: string;
  findings: string[];
  source: string;
  type: EntryType;
  status: EntryStatus;
  tags: string[];
  html: string;
  quickstartHtml: string;
  toc: TocItem[];
  relPath: string;
  prerequisites: string[];
  related: string[];
  readingMinutes: number;
}

function toArchiveRecord(entry: KnowledgeEntry): ArchiveRecord {
  const sMeta = statusMeta(entry.status);
  const tMeta = typeMeta(entry.type);
  return {
    id: entry.globalCode,
    entryId: entry.id,
    slug: entry.slug,
    visualCode: entry.visualCode,
    title: entry.title,
    en: entry.en,
    department: entry.department,
    category: entry.categoryTitle,
    portalId: entry.category,
    date: entry.updated,
    lead: entry.version_scope,
    clearance: `${sMeta.label} · ${tMeta.label}`,
    abstract: entry.summary,
    findings: entry.findings,
    source: entry.source_urls[0] ?? "https://github.com/LBEILC/RhineLabUI",
    type: entry.type,
    status: entry.status,
    tags: entry.tags,
    html: entry.html,
    quickstartHtml: entry.quickstartHtml,
    toc: entry.toc,
    relPath: entry.relPath,
    prerequisites: entry.prerequisites,
    related: entry.related,
    readingMinutes: Math.max(1, Math.ceil((entry.plainText?.length ?? 300) / 360)),
  };
}

export const portals = knowledgeRepository.portals();
const portalTitles = portals.map((p) => p.title);

export const records: ArchiveRecord[] = knowledgeRepository
  .all(false)
  .map(toArchiveRecord);
export const categories = ["全部档案", ...portalTitles];
export const archiveColumns = portalTitles;

export function columnFiles(lane: number, customRecords = records, customColumns = archiveColumns) {
  if (customColumns.length === 0) return [];
  const normLane = ((lane % customColumns.length) + customColumns.length) % customColumns.length;
  const colName = customColumns[normLane];
  return customRecords
    .map((record, index) => ({ record, index }))
    .filter(({ record }) => record.category === colName)
    .map(({ index }) => index);
}

export function fileLocation(index: number, customRecords = records, customColumns = archiveColumns) {
  if (customRecords.length === 0 || index < 0 || index >= customRecords.length) {
    return { lane: 0, row: 12, slot: 12 };
  }
  const lane = Math.max(0, customColumns.indexOf(customRecords[index].category));
  const files = columnFiles(lane, customRecords, customColumns);
  const pos = Math.max(0, files.indexOf(index));
  const row = 12 + pos;
  return { lane, row, slot: lane * 32 + (((row % 32) + 32) % 32) };
}

export function fileAtSlot(slot: number, customRecords = records, customColumns = archiveColumns) {
  if (customRecords.length === 0 || customColumns.length === 0) return 0;
  const lane = Math.max(
    0,
    Math.min(customColumns.length - 1, Math.floor(slot / 32)),
  );
  const files = columnFiles(lane, customRecords, customColumns);
  if (files.length === 0) return 0;
  return files[Math.max(0, Math.min(files.length - 1, (slot % 32) - 12))];
}

export function findRecordIndexBySlugOrId(slugOrId: string): number {
  const clean = decodeURIComponent(slugOrId).replace(/^\/+|\/+$/g, "");
  const entry = knowledgeRepository.bySlug(clean) ?? knowledgeRepository.byId(clean);
  if (!entry) return -1;
  return records.findIndex((r) => r.entryId === entry.id);
}
