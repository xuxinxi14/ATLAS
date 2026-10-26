import { escapeHtml } from "../html.ts";
import {
  knowledgeRepository,
  statusMeta,
  typeMeta,
} from "../knowledge/repository.ts";
import type { EntryStatus, EntryType } from "../knowledge/types.ts";
import { buildEntryHash, buildStudioHash } from "../app/router.ts";

export interface StudioDraftState {
  originalSlug: string;
  isNew: boolean;
  title: string;
  category: string;
  fileSlug: string;
  subcategory: string;
  type: EntryType;
  status: EntryStatus;
  tags: string;
  summary: string;
  version_scope: string;
  source_urls: string;
  created: string;
  body: string;
  filterCategory: string;
  aiPasteOpen: boolean;
  previewHtml: string;
  previewQuickstartHtml: string;
  localDiskAvailable: boolean;
  saving: boolean;
  lastSavedAt: string;
}

export const ATLAS_AI_ARCHIVE_PROMPT = `请将我们刚才对话中讨论和学习的技能/知识，整理成一份可直接放入我个人知识库 ATLAS (Rhine Lab 科研档案系统) 的 Markdown 文件。

请严格遵守以下 ATLAS 编译引擎规范，并将完整内容放在一个 \`\`\`markdown 代码块中输出，方便我一键复制导入到 ATLAS 档案编撰台：

---
id: <category>-<英文短横线slug>
title: "<中文主标题：清晰、精准、偏向技术手册风格>"
slug: <category>/<英文短横线slug>
type: <只能从 concept | skill | troubleshooting | snippet 四选一>
category: <只能从 tools | computing | research | academics | life 五选一>
subcategory: <英文短横线子分类，如 cli-workflow / video-editing / bio-protocol>
status: learning
tags: [标签1, 标签2, 标签3]
summary: "<40~85字的一句话高信息密度摘要：包含核心工具/原理、解决什么问题、产出什么结果>"
created: ${new Date().toISOString().slice(0, 10)}
updated: ${new Date().toISOString().slice(0, 10)}
version_scope: "<适用环境或软件版本，如 Windows 11 / Python 3.12 / 通用版本>"
source_urls: []
prerequisites: []
related: []
---

# <与 title 一致的标题>

## 快速复习
- **核心结论**：浓缩最关键的命令、快捷键或判断准则（20~60字）
- **核心结论**：第二条关键要点

~~~powershell
# 最常用、可直接复制执行的最小命令或代码
~~~

## 核心原理与适用场景
简明解释这项技能底层是如何工作的，适用与不适用场景。

## 标准操作流程
1. **步骤一**：明确输入、命令和预期反馈。
2. **步骤二**：关键注意事项使用 > [!TIP] 或 > [!IMPORTANT] 高亮。

## 常见排障与避坑指南
- **现象** → **原因** → **解决命令**

## 验证清单
- [x] 检查项一
- [x] 检查项二`;

export function createDefaultStudioDraft(category = "tools"): StudioDraftState {
  const today = new Date().toISOString().slice(0, 10);
  const defaultBody = `## 快速复习

- **核心结论**：在此输入最关键的 1～2 条命令或核心判断准则（将自动提取至 3D 档案速查区）。

~~~powershell
# 在此粘贴最常用的一行命令或代码片段
~~~

## 核心原理与适用场景

简要记录这项技能解决什么问题、在什么环境下使用。

## 标准操作流程

1. **第一步**
   记录具体操作步骤与参数说明。

> [!TIP]
> 在此补充容易忽略的细节或快捷键提示（支持直接 Ctrl+V 粘贴截图）。

## 常见排障与避坑指南

- **常见报错或现象** → 原因说明 → 解决步骤。

## 验证清单

- [x] 已在本地环境验证通过`;

  return {
    originalSlug: "",
    isNew: true,
    title: "",
    category: category || "tools",
    fileSlug: "",
    subcategory: "general",
    type: "skill",
    status: category === "inbox" ? "draft" : "learning",
    tags: "",
    summary: "",
    version_scope: "Windows 11 / 通用版本",
    source_urls: "",
    created: today,
    body: defaultBody,
    filterCategory: "all",
    aiPasteOpen: false,
    previewHtml: "",
    previewQuickstartHtml: "",
    localDiskAvailable: true,
    saving: false,
    lastSavedAt: "",
  };
}

export function renderStudioViewMarkup(state: StudioDraftState): string {
  const portals = knowledgeRepository.portals();
  const allEntries = knowledgeRepository.all(true);
  const filteredEntries =
    state.filterCategory === "all"
      ? allEntries
      : allEntries.filter((e) => e.category === state.filterCategory);

  const portalOptions: { id: string; title: string; code: string }[] = [
    ...portals.map((p) => ({
      id: p.id,
      title: p.title,
      code: p.codePrefix,
    })),
    { id: "inbox", title: "闪念草稿箱", code: "I" },
  ];

  const typeOptions: { id: EntryType; label: string; en: string }[] = [
    { id: "skill", label: "技能操作", en: "SKILL SOP" },
    { id: "concept", label: "核心概念", en: "CONCEPT" },
    { id: "troubleshooting", label: "故障排错", en: "TROUBLESHOOT" },
    { id: "snippet", label: "速查微卡", en: "SNIPPET" },
  ];

  const statusOptions: { id: EntryStatus; label: string }[] = [
    { id: "learning", label: "解析中" },
    { id: "proficient", label: "已掌握" },
    { id: "todo", label: "待解密" },
    { id: "review", label: "需校准" },
    { id: "draft", label: "草稿" },
  ];

  const directoryHtml = filteredEntries
    .map((entry) => {
      const isCurrent =
        !state.isNew &&
        (entry.slug === state.originalSlug || entry.id === state.originalSlug);
      const sMeta = statusMeta(entry.status);
      return `
        <a
          href="${buildStudioHash(entry.slug)}"
          class="studio-dir-item ${isCurrent ? "active" : ""}"
          data-studio-load="${escapeHtml(entry.slug)}"
        >
          <div class="studio-dir-top">
            <span class="studio-dir-code">${escapeHtml(entry.visualCode)}</span>
            <span class="studio-dir-status"><i data-status="${escapeHtml(entry.status)}"></i>${escapeHtml(sMeta.label)}</span>
          </div>
          <strong class="studio-dir-title">${escapeHtml(entry.title)}</strong>
          <small class="studio-dir-path">content/${escapeHtml(entry.slug)}.md</small>
        </a>
      `;
    })
    .join("");

  const currentPortalMeta =
    portalOptions.find((p) => p.id === state.category) ?? portalOptions[0];
  const currentTypeMeta = typeMeta(state.type);
  const currentStatusMeta = statusMeta(state.status);
  const computedSlugStem =
    state.fileSlug.trim() ||
    state.title
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9\u4e00-\u9fa5_-]+/g, "-")
      .replace(/^-+|-+$/g, "") ||
    "new-specimen";
  const targetRelPath = `content/${state.category}/${computedSlugStem}.md`;

  const tagsList = state.tags
    .split(/[,，]/)
    .map((t) => t.trim())
    .filter(Boolean);

  return `
    <div class="atlas-surface-scroll studio-surface-scroll">
      <div class="rhine-studio-shell">
        <!-- Top Studio Command Header -->
        <header class="rhine-studio-header" data-stagger="0">
          <div class="studio-header-left">
            <div class="rhine-section-kicker">
              <span>05 // ARCHIVE STUDIO · 本地知识编撰工作台</span>
              <span>${
                state.localDiskAvailable
                  ? "LOCAL DISK WRITE ENABLED // 本地磁盘直写已连接"
                  : "STATIC MODE // 静态导出模式"
              }</span>
            </div>
            <div class="studio-headline-row">
              <h2>${state.isNew ? "NEW SPECIMEN // 新建知识档案" : `EDIT SPECIMEN // 编辑档案`}</h2>
              <code class="studio-target-path" id="studio-target-path">${escapeHtml(targetRelPath)}</code>
              ${
                state.lastSavedAt
                  ? `<span class="studio-saved-badge">✓ 已同步 ${escapeHtml(state.lastSavedAt)}</span>`
                  : ""
              }
            </div>
          </div>

          <div class="studio-header-actions">
            <button type="button" class="studio-cmd-btn" data-studio-action="copy-ai-prompt" title="复制通用 AI 归档提示词，发给任意聊天 AI 即可生成标准笔记">
              📋 COPY AI PROMPT<span>复制 AI 提示词</span>
            </button>
            <button type="button" class="studio-cmd-btn ${state.aiPasteOpen ? "active" : ""}" data-studio-action="toggle-ai-import" title="直接粘贴 AI 输出的整段 Markdown，自动识别分类、标题、摘要与正文">
              ⚡ PASTE AI NOTE<span>一键导入 AI 笔记</span>
            </button>
            ${
              !state.isNew && state.originalSlug
                ? `<a href="${buildEntryHash(state.originalSlug)}" class="studio-cmd-btn">READER ↗<span>阅读视图</span></a>
                   <button type="button" class="studio-cmd-btn danger" data-studio-action="delete-entry">DELETE ×<span>删除档案</span></button>`
                : ""
            }
            <button type="button" class="solid-button studio-save-btn" data-studio-action="save-entry" ${state.saving ? "disabled" : ""}>
              ${state.saving ? "SAVING…" : "SAVE TO DISK [Ctrl+S]"}<span>${state.isNew ? "创建并写入 content/" : "保存修改并热更新"}</span>
            </button>
          </div>
        </header>

        <div class="rhine-anchor-rule" data-rule><i></i></div>

        <!-- Collapsible AI Paste Drawer -->
        <section class="studio-ai-drawer" id="studio-ai-drawer" ${state.aiPasteOpen ? "" : "hidden"}>
          <div class="studio-ai-drawer-head">
            <div>
              <strong>⚡ AI MARKDOWN IMPORTER // 智能解析与填入</strong>
              <span>把 ChatGPT / Claude / DeepSeek 生成的整段 Markdown（含或不含 Front Matter 均可）粘贴在下方，点击“解析并填入”即可自动拆解标题、分类、标签、摘要与正文。</span>
            </div>
            <div class="studio-ai-drawer-btns">
              <button type="button" class="solid-button" data-studio-action="apply-ai-import">PARSE &amp; FILL →<span>解析并填入编辑器</span></button>
              <button type="button" class="studio-cmd-btn" data-studio-action="toggle-ai-import">CLOSE ×<span>收起</span></button>
            </div>
          </div>
          <textarea
            id="studio-ai-raw-input"
            class="studio-ai-textarea"
            placeholder="在此粘贴 AI 生成的完整 Markdown 内容（支持 --- Front Matter --- 及 ~~~ 代码块）…"
          ></textarea>
        </section>

        <!-- Main 3-Column Studio Workbench -->
        <div class="rhine-studio-grid">
          <!-- Column 1: Specimen Directory -->
          <aside class="studio-col-directory" data-stagger="1" aria-label="现有档案目录">
            <div class="studio-col-head">
              <span>SPECIMEN DIRECTORY // 档案列表 (${allEntries.length})</span>
              <button type="button" class="studio-new-btn" data-studio-action="new-blank">+ NEW 新建</button>
            </div>

            <div class="studio-dir-filters">
              <button type="button" class="studio-dir-chip ${state.filterCategory === "all" ? "active" : ""}" data-studio-filter="all">ALL</button>
              ${portalOptions
                .map(
                  (p) =>
                    `<button type="button" class="studio-dir-chip ${state.filterCategory === p.id ? "active" : ""}" data-studio-filter="${escapeHtml(p.id)}">${escapeHtml(p.title)}</button>`,
                )
                .join("")}
            </div>

            <div class="studio-dir-list">
              ${directoryHtml}
            </div>
          </aside>

          <!-- Column 2: Visual Metadata + Markdown Editor -->
          <section class="studio-col-editor" data-stagger="1" aria-label="笔记元数据与正文编辑器">
            <div class="studio-meta-grid">
              <!-- Title & Slug Row -->
              <div class="studio-field studio-field-title">
                <label for="studio-input-title">SPECIMEN TITLE // 档案中文标题 <em>*</em></label>
                <input
                  id="studio-input-title"
                  type="text"
                  value="${escapeHtml(state.title)}"
                  placeholder="例如：FFmpeg 无损切片与音轨提取速查手册"
                   autocomplete="off"
                />
              </div>

              <div class="studio-field studio-field-slug">
                <label for="studio-input-slug">FILE SLUG // 英文文件名标识</label>
                <input
                  id="studio-input-slug"
                  type="text"
                  value="${escapeHtml(state.fileSlug)}"
                  placeholder="自动由标题生成，建议英文如 ffmpeg-cut"
                  autocomplete="off"
                />
              </div>

              <!-- Portal Selector -->
              <div class="studio-field studio-field-wide">
                <label>PORTAL // 所属知识领域（对应 3D 大厅五列与草稿箱）</label>
                <div class="studio-pill-group">
                  ${portalOptions
                    .map(
                      (p) => `
                    <button
                      type="button"
                      class="studio-pill ${state.category === p.id ? "active" : ""}"
                      data-studio-set-category="${escapeHtml(p.id)}"
                    >
                      <i></i><span>${escapeHtml(p.code)}</span> ${escapeHtml(p.title)}
                    </button>
                  `,
                    )
                    .join("")}
                </div>
              </div>

              <!-- Type & Status Row -->
              <div class="studio-field">
                <label>KNOWLEDGE TYPE // 知识形态</label>
                <div class="studio-pill-group">
                  ${typeOptions
                    .map(
                      (t) => `
                    <button
                      type="button"
                      class="studio-pill ${state.type === t.id ? "active" : ""}"
                      data-studio-set-type="${escapeHtml(t.id)}"
                    >
                      <i></i>${escapeHtml(t.label)}
                    </button>
                  `,
                    )
                    .join("")}
                </div>
              </div>

              <div class="studio-field">
                <label>CALIBRATION STATUS // 掌握度状态</label>
                <div class="studio-pill-group">
                  ${statusOptions
                    .map(
                      (s) => `
                    <button
                      type="button"
                      class="studio-pill ${state.status === s.id ? "active" : ""}"
                      data-studio-set-status="${escapeHtml(s.id)}"
                    >
                      <b class="status-dot" data-status="${escapeHtml(s.id)}"></b>${escapeHtml(s.label)}
                    </button>
                  `,
                    )
                    .join("")}
                </div>
              </div>

              <!-- Summary (3D Abstract) -->
              <div class="studio-field studio-field-wide">
                <label for="studio-input-summary">3D CARD ABSTRACT // 一句话高密度摘要（直接展示于 3D 详情页 01//摘要）</label>
                <input
                  id="studio-input-summary"
                  type="text"
                  value="${escapeHtml(state.summary)}"
                  placeholder="用 40～85 字概括核心工具、解决什么问题、产出什么结果（留空将自动提取正文首段）"
                  autocomplete="off"
                />
              </div>

              <!-- Tags & Version Scope -->
              <div class="studio-field">
                <label for="studio-input-tags">TAGS // 检索标签（逗号分隔）</label>
                <input
                  id="studio-input-tags"
                  type="text"
                  value="${escapeHtml(state.tags)}"
                  placeholder="例如：FFmpeg, 视频剪辑, 命令行"
                  autocomplete="off"
                />
              </div>

              <div class="studio-field">
                <label for="studio-input-version">VERSION &amp; ENV // 适用版本与环境</label>
                <input
                  id="studio-input-version"
                  type="text"
                  value="${escapeHtml(state.version_scope)}"
                  placeholder="例如：Windows 11 / Python 3.12"
                  autocomplete="off"
                />
              </div>
            </div>

            <!-- Formatting & Snippet Toolbar -->
            <div class="studio-editor-toolbar" role="toolbar" aria-label="Markdown 快捷插入工具栏">
              <span class="toolbar-label">INSERT // 快捷结构：</span>
              <button type="button" data-studio-insert="quickstart" title="插入 ## 快速复习 模块">⚡ 快速复习模块</button>
              <button type="button" data-studio-insert="code" title="插入代码块">⌘ 代码块</button>
              <button type="button" data-studio-insert="tip" title="插入 [!TIP] 提示框">◈ TIP 提示</button>
              <button type="button" data-studio-insert="warning" title="插入 [!WARNING] 避坑框">⚠ WARNING 避坑</button>
              <button type="button" data-studio-insert="checklist" title="插入验证任务清单">☑ 验证清单</button>
              <button type="button" data-studio-insert="math" title="插入 LaTeX 公式块">∑ 公式块</button>
              <button type="button" data-studio-insert="table" title="插入 Markdown 表格">⊞ 表格</button>
              <label class="studio-upload-label" title="选择图片或直接在正文中按 Ctrl+V 粘贴截图">
                🖼 插入图片/截图
                <input type="file" id="studio-image-input" accept="image/*" hidden />
              </label>
            </div>

            <!-- Markdown Body Textarea -->
            <textarea
              id="studio-input-body"
              class="studio-body-textarea"
              placeholder="在此编写 Markdown 正文（支持直接 Ctrl+V 粘贴剪贴板截图，自动存入 ./assets/ 并生成引用；按 Ctrl+S 立即保存）…"
              spellcheck="false"
            >${escapeHtml(state.body)}</textarea>
          </section>

          <!-- Column 3: Live 3D Card + 2D Reader Preview -->
          <aside class="studio-col-preview" data-stagger="2" aria-label="实时三维卡片与二维阅读器双模预览">
            <div class="studio-preview-card-box">
              <div class="studio-col-head">
                <span>3D ARCHIVE CARD PREVIEW // 三维卡片效果</span>
                <span>${escapeHtml(currentPortalMeta.code)}-SERIES</span>
              </div>
              <div class="studio-3d-mock">
                <div class="mock-kicker">
                  <span>FILE ${escapeHtml(currentPortalMeta.code)}-00X</span>
                  <span>${escapeHtml(currentStatusMeta.label)} · ${escapeHtml(currentTypeMeta.label)}</span>
                </div>
                <h4 id="studio-preview-title">${escapeHtml(state.title || "未命名知识档案")}</h4>
                <div class="mock-rule"></div>
                <p id="studio-preview-summary">${escapeHtml(state.summary || "在左侧填写一句话摘要后，将在此处及 3D 详情面板『01 // 概述与摘要』中同步展示。")}</p>
                <div class="detail-inline-tags" id="studio-preview-tags">
                  ${
                    tagsList.length > 0
                      ? tagsList.map((t) => `<span>#${escapeHtml(t)}</span>`).join("")
                      : `<span>#${escapeHtml(currentPortalMeta.title)}</span>`
                  }
                </div>
              </div>
            </div>

            <div class="studio-preview-reader-box">
              <div class="studio-col-head">
                <span>2D READER LIVE RENDER // 二维正文实时渲染</span>
                <span>GFM + KaTeX</span>
              </div>
              <div id="studio-preview-quickstart" class="studio-preview-quickstart" ${state.previewQuickstartHtml ? "" : "hidden"}>
                <div class="quickstart-header">
                  <span>⚡ QUICKSTART / 3D 速查区提取预览</span>
                  <span>## 快速复习</span>
                </div>
                <div class="quickstart-body" id="studio-preview-quickstart-body">
                  ${state.previewQuickstartHtml}
                </div>
              </div>
              <div id="studio-preview-body" class="atlas-markdown-body studio-preview-markdown">
                ${state.previewHtml || '<p class="studio-preview-placeholder">正在准备实时预览…</p>'}
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  `;
}
