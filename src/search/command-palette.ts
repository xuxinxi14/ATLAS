import { escapeHtml } from "../html.ts";
import { knowledgeRepository } from "../knowledge/repository.ts";

export interface AtlasCommandItem {
  id: string;
  title: string;
  subtitle: string;
  category: "导航" | "编撰与草稿" | "视图与主题" | "备份与巡检" | "三维阵列";
  shortcut?: string;
  keywords: string[];
  action: string;
  payload?: string;
}

export function isCommandPaletteQuery(rawQuery: string): boolean {
  const trimmed = String(rawQuery ?? "").trimStart();
  return /^(?:>|＞|cmd:|command:)/i.test(trimmed);
}

export function getAtlasCommands(options?: {
  readOnly?: boolean;
  isDark?: boolean;
}): AtlasCommandItem[] {
  const readOnly = Boolean(options?.readOnly);
  const isDark = Boolean(options?.isDark);
  const inboxEntries = knowledgeRepository.listByCategory("inbox", true);

  const commands: AtlasCommandItem[] = [
    {
      id: "cmd-nav-home",
      title: "前往遥测中枢 (#/home)",
      subtitle: "TELEMETRY MATRIX · 全局知识星图、待校准队列与健康巡检",
      category: "导航",
      shortcut: "H",
      keywords: ["home", "telemetry", "遥测", "主页", "星图"],
      action: "nav-home",
    },
    {
      id: "cmd-nav-library",
      title: "打开二维知识索引台 (#/library)",
      subtitle: "GLASS INDEX DESK · 按领域、标签、状态筛选与检索全部档案",
      category: "导航",
      shortcut: "L",
      keywords: ["library", "index", "索引", "目录", "列表"],
      action: "nav-library",
    },
    {
      id: "cmd-nav-archive",
      title: "进入三维档案大厅 (#/archive)",
      subtitle: "3D ARCHIVE HALL · 莱茵生命五列玻璃磁带盒空间阵列",
      category: "导航",
      keywords: ["3d", "archive", "三维", "大厅", "阵列"],
      action: "nav-archive",
    },
    ...(readOnly
      ? []
      : [
          {
            id: "cmd-nav-studio",
            title: "新建空白知识档案 (#/studio)",
            subtitle: "ARCHIVE STUDIO · 打开内置实时预览编撰台创建新笔记",
            category: "编撰与草稿" as const,
            shortcut: "N",
            keywords: ["studio", "new", "create", "新建", "编辑", "写作", "录入"],
            action: "nav-studio",
          },
          ...(inboxEntries.length > 0
            ? [
                {
                  id: "cmd-promote-inbox",
                  title: `将草稿「${inboxEntries[0].title.slice(0, 18)}」转正归档`,
                  subtitle: `INBOX PROMOTE · 将 ${inboxEntries[0].slug} 一键转正至编程与 AI 领域`,
                  category: "编撰与草稿" as const,
                  keywords: ["promote", "inbox", "draft", "转正", "草稿", "归档"],
                  action: "promote-first-inbox",
                  payload: inboxEntries[0].slug,
                },
              ]
            : []),
        ]),
    {
      id: "cmd-audit-health",
      title: "运行知识库健康度巡检 (Knowledge Health Audit)",
      subtitle: "KNOWLEDGE AUDIT · 检查悬空双链、孤立节点与缺失速览区块",
      category: "备份与巡检",
      keywords: ["audit", "health", "check", "broken", "巡检", "健康", "死链", "孤立"],
      action: "run-knowledge-audit",
    },
    {
      id: "cmd-export-json",
      title: "导出全库 JSON 快照备份 (.json)",
      subtitle: "SNAPSHOT EXPORT · 打包全部笔记、双链、收藏、校准与个人批注",
      category: "备份与巡检",
      keywords: ["export", "json", "backup", "snapshot", "导出", "备份", "快照"],
      action: "export-snapshot-json",
    },
    {
      id: "cmd-export-md",
      title: "导出全库 Markdown 归档合集 (.md)",
      subtitle: "MARKDOWN BUNDLE · 将所有档案与页边批注合并导出为单文件合集",
      category: "备份与巡检",
      keywords: ["export", "markdown", "md", "bundle", "导出", "合集", "归档"],
      action: "export-snapshot-md",
    },
    {
      id: "cmd-import-json",
      title: "从 JSON 快照文件导入恢复数据",
      subtitle: "SNAPSHOT RESTORE · 恢复收藏档案、温习校准记录与阅读器批注",
      category: "备份与巡检",
      keywords: ["import", "restore", "json", "导入", "恢复", "快照"],
      action: "import-snapshot-json",
    },
    {
      id: "cmd-toggle-theme",
      title: isDark ? "切换为亮色主题 (Light Mode)" : "切换为暗色主题 (Dark Mode)",
      subtitle: "COLOR THEME · 沿行列依次切换磁带盒与界面明暗配色",
      category: "视图与主题",
      keywords: ["theme", "dark", "light", "主题", "暗色", "亮色", "夜间"],
      action: "toggle-theme-quick",
    },
    {
      id: "cmd-spotlight-review",
      title: "在三维阵列中定位「需校准 (Review)」档案",
      subtitle: "3D SPOTLIGHT · 切入三维大厅并高亮所有需温习校准的磁带盒",
      category: "三维阵列",
      keywords: ["3d", "spotlight", "review", "校准", "温习", "筛选", "定位"],
      action: "spotlight-3d",
      payload: "status:review",
    },
    {
      id: "cmd-spotlight-related",
      title: "在三维阵列中定位「当前星图关联」节点",
      subtitle: "3D SPOTLIGHT · 高亮当前选中磁带盒的前后置与双链关联档案",
      category: "三维阵列",
      keywords: ["3d", "spotlight", "related", "graph", "星图", "关联", "双链"],
      action: "spotlight-3d",
      payload: "related",
    },
    {
      id: "cmd-open-settings",
      title: "打开终端系统设置 (System Preferences)",
      subtitle: "SETTINGS · 调节渲染画质、音效配乐、动态效果与离线缓存",
      category: "视图与主题",
      keywords: ["settings", "preferences", "quality", "audio", "设置", "画质", "声音"],
      action: "open-settings",
    },
    {
      id: "cmd-replay-boot",
      title: "重播莱茵生命开机启动流程 (Reinitialize System)",
      subtitle: "BOOT SEQUENCE · 重新播放 ACCESS 2D/3D 启动时间轴",
      category: "视图与主题",
      keywords: ["replay", "boot", "restart", "重播", "开机", "启动"],
      action: "replay-boot",
    },
  ];

  return commands;
}

export function searchAtlasCommands(
  rawQuery: string,
  options?: { readOnly?: boolean; isDark?: boolean },
): AtlasCommandItem[] {
  const all = getAtlasCommands(options);
  const clean = String(rawQuery ?? "")
    .trimStart()
    .replace(/^(?:>|＞|cmd:|command:)\s*/i, "")
    .trim()
    .toLowerCase();
  if (!clean) return all;

  const tokens = clean.split(/\s+/).filter(Boolean);
  const scored: { cmd: AtlasCommandItem; score: number }[] = [];

  for (const cmd of all) {
    const titleLower = cmd.title.toLowerCase();
    const subLower = cmd.subtitle.toLowerCase();
    const catLower = cmd.category.toLowerCase();
    const kwJoined = cmd.keywords.join(" ").toLowerCase();

    let total = 0;
    let matchedAll = true;
    for (const tok of tokens) {
      let s = 0;
      if (titleLower.includes(tok)) s += 80;
      if (kwJoined.includes(tok)) s += 60;
      if (catLower.includes(tok)) s += 40;
      if (subLower.includes(tok)) s += 25;
      if (s === 0) {
        matchedAll = false;
        break;
      }
      total += s;
    }
    if (matchedAll && total > 0) {
      scored.push({ cmd, score: total });
    }
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.map((s) => s.cmd);
}

export function renderCommandPaletteResultsMarkup(
  commands: AtlasCommandItem[],
): string {
  if (commands.length === 0) {
    return `<div class="empty-results"><span>∅</span><strong>没有匹配的终端指令</strong><p>尝试输入 > 主题、> 巡检、> 导出、> 新建 或删除 > 切换回全文档案检索。</p><button data-action="reset-search">退回档案检索 →</button></div>`;
  }

  return commands
    .map(
      (cmd, idx) => `
      <button
        type="button"
        class="result-row is-command-row ${idx === 0 ? "is-first-cmd" : ""}"
        data-command-action="${escapeHtml(cmd.action)}"
        ${cmd.payload ? `data-command-payload="${escapeHtml(cmd.payload)}"` : ""}
      >
        <span class="result-name">
          <b class="cmd-badge">⌘ CMD</b>
          <span>
            ${escapeHtml(cmd.title)}
            <small>${escapeHtml(cmd.subtitle)}</small>
          </span>
        </span>
        <span>${escapeHtml(cmd.category)}</span>
        <span>${cmd.shortcut ? `<kbd>${escapeHtml(cmd.shortcut)}</kbd>` : "RUN"} <i>↵</i></span>
      </button>
    `,
    )
    .join("");
}
