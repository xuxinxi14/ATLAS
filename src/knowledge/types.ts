export type EntryId = string;
export type EntryType = "concept" | "skill" | "troubleshooting" | "snippet";
export type EntryStatus = "draft" | "todo" | "learning" | "proficient" | "review";

export interface TocItem {
  id: string;
  text: string;
  level: number;
}

export interface PortalDefinition {
  id: string;
  title: string;
  en: string;
  codePrefix: string;
  department: string;
  description: string;
}

export interface KnowledgeEntry {
  id: EntryId;
  slug: string;
  visualCode: string;
  globalCode: string;
  title: string;
  category: string;
  categoryTitle: string;
  en: string;
  department: string;
  subcategory: string;
  type: EntryType;
  status: EntryStatus;
  tags: string[];
  summary: string;
  created: string;
  updated: string;
  version_scope: string;
  source_urls: string[];
  prerequisites: EntryId[];
  related: EntryId[];
  aliases: string[];
  relPath: string;
  autoInferred: boolean;
  images: string[];
  toc: TocItem[];
  quickstartHtml: string;
  html: string;
  findings: string[];
  plainText: string;
}

export interface PortalTelemetryStat {
  id: string;
  title: string;
  en: string;
  codePrefix: string;
  description: string;
  total: number;
  proficient: number;
  learning: number;
  todo: number;
  review: number;
}

export interface ReviewQueueItem {
  id: EntryId;
  slug: string;
  title: string;
  category: string;
  categoryTitle: string;
  updated: string;
  daysSinceUpdate: number;
  reason: string;
}

export interface TelemetryData {
  generatedAt: string;
  totalEntries: number;
  inboxCount: number;
  statusCounts: Record<EntryStatus, number>;
  typeCounts: Record<EntryType, number>;
  portalStats: PortalTelemetryStat[];
  reviewQueue: ReviewQueueItem[];
  recentEntries: {
    id: EntryId;
    slug: string;
    title: string;
    category: string;
    categoryTitle: string;
    type: EntryType;
    status: EntryStatus;
    updated: string;
    visualCode: string;
  }[];
  activityByDate: Record<string, number>;
}
