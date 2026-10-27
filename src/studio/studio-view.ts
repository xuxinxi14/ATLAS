import { escapeHtml } from "../html.ts";
import { knowledgeRepository, typeMeta } from "../knowledge/repository.ts";
import type { EntryStatus, EntryType } from "../knowledge/types.ts";
import { deskDomainTitle, deskStatusLabel } from "../library/library-view.ts";
import type { StudioEntrySource } from "../studio-tray-rig.ts";

export interface StudioAiCandidate {
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
  body: string;
  previewHtml: string;
}

export interface StudioDraftSnapshot {
  originalSlug: string;
  lockedCode: string;
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
  updated: string;
  body: string;
  dirty: boolean;
  lastSavedAt: string;
}

export interface StudioDraftState {
  originalSlug: string;
  /** Stable identity code shown on the left cassette dock ("T-001" or "NEW"); never jumps while typing */
  lockedCode: string;
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
  updated: string;
  body: string;
  filterCategory: string;
  /** Active mode on the writing surface: "edit" (default) or "preview" (in-place single column) */
  activeTab: "edit" | "preview";
  /** Which lightweight dropdown is currently open ("category" | "type" | "status" | "insert" | "top-more" | null) */
  openDropdown: "category" | "type" | "status" | "insert" | "top-more" | null;
  /** Right-side 350px local drawer for advanced metadata ("更多信息") */
  moreDrawerOpen: boolean;
  /** Right-side local drawer for AI Markdown paste & import ("AI 导入") */
  aiPasteOpen: boolean;
  aiRawInput: string;
  aiPendingCandidate: StudioAiCandidate | null;
  aiPreImportBackup: StudioDraftSnapshot | null;
  previewHtml: string;
  previewQuickstartHtml: string;
  localDiskAvailable: boolean;
  loading: boolean;
  dirty: boolean;
  saving: boolean;
  saveError: string;
  lastSavedAt: string;
  imageImportingMsg: string;
  /** Where the user entered Studio from ("library" -> 返回索引, "archive" -> 返回档案室, "reader" -> 返回阅读) */
  entryOrigin: StudioEntrySource;
}

export const ATLAS_AI_ARCHIVE_PROMPT = `请将我们刚才对话中讨论和学习的技能/知识，整理成一份可直接放入我个人知识库 ATLAS (Rhine Lab 科研档案系统) 的 Markdown 文件。

请严格遵守以下 ATLAS 编译引擎规范，并将完整内容放在一个 \`\`\`markdown 代码块中输出，方便我一键复制导入到 ATLAS 档案编撰台：

---
id: <category>-<英文短横线slug>
title: "<中文主标题：清晰、精准、偏向技术手册风格>"
slug: <category>/<英文短横线slug>
type: <只能从 concept | skill | troubleshooting | snippet 四选一>
category: <只能从 ${knowledgeRepository.portals().map(p => p.id).join(" | ")} 五选一>
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

export function createDefaultStudioDraft(
  category = "tools",
  entryOrigin: StudioEntrySource = "library",
): StudioDraftState {
  const today = new Date().toISOString().slice(0, 10);
  return {
    originalSlug: "",
    lockedCode: "NEW",
    isNew: true,
    title: "",
    category: category && category !== "all" ? category : "tools",
    fileSlug: "",
    subcategory: "general",
    type: "skill",
    status: category === "inbox" ? "draft" : "learning",
    tags: "",
    summary: "",
    version_scope: "Windows 11 / 通用版本",
    source_urls: "",
    created: today,
    updated: today,
    body: "",
    filterCategory: "all",
    activeTab: "edit",
    openDropdown: null,
    moreDrawerOpen: false,
    aiPasteOpen: false,
    aiRawInput: "",
    aiPendingCandidate: null,
    aiPreImportBackup: null,
    previewHtml: "",
    previewQuickstartHtml: "",
    localDiskAvailable: true,
    loading: false,
    dirty: false,
    saving: false,
    saveError: "",
    lastSavedAt: "",
    imageImportingMsg: "",
    entryOrigin,
  };
}

export function snapshotStudioDraft(
  state: StudioDraftState,
): StudioDraftSnapshot {
  return {
    originalSlug: state.originalSlug,
    lockedCode: state.lockedCode,
    isNew: state.isNew,
    title: state.title,
    category: state.category,
    fileSlug: state.fileSlug,
    subcategory: state.subcategory,
    type: state.type,
    status: state.status,
    tags: state.tags,
    summary: state.summary,
    version_scope: state.version_scope,
    source_urls: state.source_urls,
    created: state.created,
    updated: state.updated,
    body: state.body,
    dirty: state.dirty,
    lastSavedAt: state.lastSavedAt,
  };
}

export function applyStudioDraftSnapshot(
  state: StudioDraftState,
  snap: StudioDraftSnapshot,
) {
  state.originalSlug = snap.originalSlug;
  state.lockedCode = snap.lockedCode;
  state.isNew = snap.isNew;
  state.title = snap.title;
  state.category = snap.category;
  state.fileSlug = snap.fileSlug;
  state.subcategory = snap.subcategory;
  state.type = snap.type;
  state.status = snap.status;
  state.tags = snap.tags;
  state.summary = snap.summary;
  state.version_scope = snap.version_scope;
  state.source_urls = snap.source_urls;
  state.created = snap.created;
  state.updated = snap.updated;
  state.body = snap.body;
  state.dirty = snap.dirty;
  state.lastSavedAt = snap.lastSavedAt;
}

export function computeStudioTargetPath(state: StudioDraftState): string {
  if (state.isNew && !state.title.trim() && !state.fileSlug.trim()) {
    return `content/${state.category}/<待命名>.md`;
  }
  const stem =
    state.fileSlug.trim() ||
    state.title
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9\u4e00-\u9fa5_-]+/g, "-")
      .replace(/^-+|-+$/g, "") ||
    "untitled";
  return `content/${state.category}/${stem}.md`;
}

export function renderStudioSaveStatusMarkup(state: StudioDraftState): string {
  if (state.loading) {
    return `<span class="studio-status-pill is-loading"><i class="studio-status-dot"></i><span>正在载入…</span></span>`;
  }
  if (state.saving) {
    return `<span class="studio-status-pill is-saving"><i class="studio-status-dot"></i><span>正在保存…</span></span>`;
  }
  if (state.saveError) {
    return `
      <span class="studio-status-pill is-error" role="alert">
        <i class="studio-status-dot"></i>
        <span>保存失败：${escapeHtml(state.saveError)}</span>
        <button type="button" class="studio-retry-inline" data-studio-action="save-entry">重试</button>
      </span>
    `;
  }
  if (!state.localDiskAvailable) {
    return `<span class="studio-status-pill ${state.dirty ? "is-dirty" : "is-static"}"><i class="studio-status-dot"></i><span>${state.dirty ? "未保存 · 可导出 MD" : "静态模式 · 可导出 MD"}</span></span>`;
  }
  if (state.dirty) {
    return `<span class="studio-status-pill is-dirty"><i class="studio-status-dot"></i><span>未保存</span></span>`;
  }
  const label = state.isNew && !state.lastSavedAt ? "就绪" : "已保存";
  return `<span class="studio-status-pill is-saved"><i class="studio-status-dot"></i><span>${label}</span></span>`;
}

export function renderStudioViewMarkup(
  state: StudioDraftState,
  hasWebGL = true,
): string {
  const portals = knowledgeRepository.portals();
  const domainOptions: { id: string; title: string }[] = [
    ...portals.map((p) => ({
      id: p.id,
      title: deskDomainTitle(p.id, p.title),
    })),
    { id: "inbox", title: "草稿箱" },
  ];

  const typeOptions: { id: EntryType; label: string }[] = [
    { id: "skill", label: "技能操作" },
    { id: "concept", label: "核心概念" },
    { id: "troubleshooting", label: "故障排错" },
    { id: "snippet", label: "速查微卡" },
  ];

  const statusOptions: { id: EntryStatus; label: string }[] = [
    { id: "learning", label: "解析中" },
    { id: "proficient", label: "已掌握" },
    { id: "todo", label: "待整理" },
    { id: "review", label: "需温习" },
    { id: "draft", label: "草稿" },
  ];

  const insertOptions: { id: string; label: string; hint: string }[] = [
    { id: "quickstart", label: "快速复习", hint: "## 快速复习 + 核心结论" },
    { id: "code", label: "代码块", hint: "~~~powershell 代码段" },
    { id: "tip", label: "提示 [!TIP]", hint: "操作技巧提示框" },
    { id: "warning", label: "警告 [!WARNING]", hint: "排障与避坑警告框" },
    { id: "checklist", label: "验证清单", hint: "- [x] 核对列表" },
    { id: "math", label: "LaTeX 公式", hint: "$$ 块级公式 $$" },
    { id: "table", label: "数据表格", hint: "三列标准对照表" },
  ];

  const currentDomainLabel = deskDomainTitle(state.category, "软件与工具");
  const currentTypeLabel = typeMeta(state.type).label;
  const currentStatusLabel = deskStatusLabel(state.status);
  const targetRelPath = computeStudioTargetPath(state);

  const dockCode = state.isNew ? "NEW" : state.lockedCode || "T-001";
  const dockSubtitle = state.isNew ? "空白身份 · 待归档" : "当前档案";
  const has3DCassetteInBay =
    hasWebGL && !state.isNew && state.category !== "inbox";

  const returnLabel =
    state.entryOrigin === "home"
      ? "返回主页"
      : state.entryOrigin === "archive"
        ? "返回档案室"
        : state.entryOrigin === "reader"
          ? "返回阅读"
          : "返回索引";

  const lineCount = state.body ? state.body.split("\n").length : 1;
  const charCount = state.body.length;

  return `
    <div class="studio-tray-stage" aria-label="ATLAS / STUDIO 录入工作台">
      <!-- Outer Top-Left Brand -->
      <div class="studio-outer-brand" aria-hidden="true">RHINE LAB</div>

      <!-- Hidden compatibility markers for smoke tests -->
      <div class="studio-sr-compat" aria-hidden="true">
        <span>ARCHIVE STUDIO</span>
        <span>PASTE AI NOTE</span>
        <span>SAVE TO DISK</span>
      </div>

      <!-- Sliding Studio Tray (录入托盘：左侧 18-21% 卡座 + 右侧 79-82% 稳定暖白编辑面) -->
      <section class="sliding-studio-tray" role="region" aria-label="档案录入托盘">
        <div class="studio-tray-rail-left" aria-hidden="true"><i></i></div>
        <div class="studio-tray-rail-right" aria-hidden="true"><i></i></div>

        <div class="studio-tray-interior">
          <!-- 1. Left Cassette Dock (左侧卡座：只呈现编号、当前档案与小型接触状态，不放第二份元数据表) -->
          <aside
            class="studio-cassette-dock ${has3DCassetteInBay ? "has-3d-cassette" : "is-vector-fallback"}"
            aria-label="当前编辑档案卡座"
            title="${escapeHtml(targetRelPath)}"
          >
            <div class="studio-dock-header">
              <strong class="studio-dock-code" id="studio-dock-code">${escapeHtml(dockCode)}</strong>
              <span class="studio-dock-sub" id="studio-dock-subtitle">${escapeHtml(dockSubtitle)}</span>
            </div>

            <div class="studio-cassette-bay">
              <div class="studio-bay-recess" aria-hidden="true">
                <!-- Fallback/Overlay Cassette Shell (keeps identical aspect ratio, twin rings & nameplate) -->
                <div class="studio-bay-cassette-card ${state.isNew ? "is-new-blank" : ""}">
                  <div class="studio-cassette-top-tab"></div>
                  <div class="studio-cassette-nameplate">
                    <span class="nameplate-org">RHINE LAB, LLC.</span>
                    <b class="nameplate-no" id="studio-nameplate-no">${escapeHtml(state.isNew ? "NEW" : `NO.${dockCode.replace(/^[A-Z]-/, "")}`)}</b>
                  </div>
                  <div class="studio-cassette-rings">
                    <i class="ring-large"></i>
                    <i class="ring-small"></i>
                  </div>
                  <span class="studio-cassette-side-mark">RHINE LAB</span>
                </div>

                <!-- Small Warm-Amber Contact Lamp at bottom-left of cassette bay -->
                <i
                  class="studio-bay-contact-lamp ${!state.dirty && state.lastSavedAt ? "is-saved-glow" : ""}"
                  id="studio-bay-contact-lamp"
                  aria-hidden="true"
                ></i>
              </div>
            </div>

            <div class="studio-dock-foot" title="${escapeHtml(targetRelPath)}">
              <code id="studio-target-path">${escapeHtml(targetRelPath)}</code>
            </div>
          </aside>

          <!-- 2. Right Stable Warm-White Writing Surface (右侧编辑面) -->
          <div class="studio-writing-surface">
            <!-- 顶部工具行：动态返回入口、ATLAS / STUDIO、保存状态、保存主按钮及更多操作 -->
            <header class="studio-top-bar">
              <button
                type="button"
                class="studio-return-btn"
                data-studio-action="return-origin"
              >
                <span aria-hidden="true">←</span>
                <span>${escapeHtml(returnLabel)}</span>
              </button>

              <span class="studio-top-kicker">ATLAS / STUDIO</span>

              <div class="studio-top-actions">
                <div id="studio-save-status" class="studio-save-status-wrap">
                  ${renderStudioSaveStatusMarkup(state)}
                </div>

                <span class="studio-top-sep" aria-hidden="true">|</span>

                <button
                  type="button"
                  class="studio-primary-save-btn"
                  data-studio-action="save-entry"
                  ${state.saving || state.loading ? "disabled" : ""}
                >
                  <span>${state.localDiskAvailable ? "保存并归档" : "导出 Markdown"}</span>
                </button>
                <kbd class="studio-shortcut-badge" aria-hidden="true">Ctrl + S</kbd>

                <div class="studio-dropdown-wrap">
                  <button
                    type="button"
                    class="studio-more-icon-btn ${state.openDropdown === "top-more" ? "active" : ""}"
                    data-studio-dropdown="top-more"
                    aria-expanded="${state.openDropdown === "top-more"}"
                    aria-haspopup="menu"
                    aria-label="更多保存与档案操作"
                    title="更多操作"
                  >⋮</button>

                  <div
                    class="studio-dropdown-menu studio-dropdown-right"
                    role="menu"
                    ${state.openDropdown === "top-more" ? "" : "hidden"}
                  >
                    <button
                      type="button"
                      role="menuitem"
                      class="studio-menu-item"
                      data-studio-action="save-and-return"
                    >保存并${escapeHtml(returnLabel)}</button>
                    <button
                      type="button"
                      role="menuitem"
                      class="studio-menu-item"
                      data-studio-action="return-origin"
                    >${escapeHtml(returnLabel)}（保留未保存草稿）</button>
                    <button
                      type="button"
                      role="menuitem"
                      class="studio-menu-item"
                      data-studio-action="export-markdown"
                    >⇩ 导出 Markdown (.md)</button>
                    <button
                      type="button"
                      role="menuitem"
                      class="studio-menu-item"
                      data-studio-action="new-blank"
                    >＋ 新建空白档案</button>
                    ${
                      state.dirty
                        ? `<button
                            type="button"
                            role="menuitem"
                            class="studio-menu-item"
                            data-studio-action="discard-draft"
                          >↺ 放弃未保存修改</button>`
                        : ""
                    }
                    ${
                      !state.isNew && state.localDiskAvailable
                        ? `<button
                            type="button"
                            role="menuitem"
                            class="studio-menu-item is-danger"
                            data-studio-action="delete-entry"
                          >× 删除本地档案</button>`
                        : ""
                    }
                  </div>
                </div>
              </div>
            </header>

            <!-- 标题区：“档案标题”轻标签和可编辑大标题，细下划线；长标题可到两行 -->
            <div class="studio-title-zone">
              <label class="studio-title-label" for="studio-input-title">档案标题</label>
              <textarea
                id="studio-input-title"
                class="studio-title-input"
                rows="1"
                placeholder="输入档案标题…"
                autocomplete="off"
                ${state.loading ? "disabled" : ""}
              >${escapeHtml(state.title)}</textarea>
            </div>

            <!-- 元数据行：领域、类型、状态三个轻量入口，另有“更多信息” -->
            <div class="studio-meta-row" role="toolbar" aria-label="档案核心分类与状态">
              <!-- 1. 领域 (Domain) -->
              <div class="studio-dropdown-wrap">
                <button
                  type="button"
                  class="studio-meta-chip ${state.openDropdown === "category" ? "open" : ""}"
                  data-studio-dropdown="category"
                  aria-expanded="${state.openDropdown === "category"}"
                >
                  <span id="studio-chip-category-label">${escapeHtml(currentDomainLabel)}</span>
                  <i aria-hidden="true">⌄</i>
                </button>
                <div
                  class="studio-dropdown-menu"
                  role="menu"
                  ${state.openDropdown === "category" ? "" : "hidden"}
                >
                  ${domainOptions
                    .map(
                      (d) => `
                        <button
                          type="button"
                          role="menuitem"
                          class="studio-menu-item ${state.category === d.id ? "active" : ""}"
                          data-studio-set-category="${escapeHtml(d.id)}"
                        >${escapeHtml(d.title)}</button>
                      `,
                    )
                    .join("")}
                </div>
              </div>

              <!-- 2. 类型 (Type) -->
              <div class="studio-dropdown-wrap">
                <button
                  type="button"
                  class="studio-meta-chip ${state.openDropdown === "type" ? "open" : ""}"
                  data-studio-dropdown="type"
                  aria-expanded="${state.openDropdown === "type"}"
                >
                  <span id="studio-chip-type-label">${escapeHtml(currentTypeLabel)}</span>
                  <i aria-hidden="true">⌄</i>
                </button>
                <div
                  class="studio-dropdown-menu"
                  role="menu"
                  ${state.openDropdown === "type" ? "" : "hidden"}
                >
                  ${typeOptions
                    .map(
                      (t) => `
                        <button
                          type="button"
                          role="menuitem"
                          class="studio-menu-item ${state.type === t.id ? "active" : ""}"
                          data-studio-set-type="${escapeHtml(t.id)}"
                        >${escapeHtml(t.label)}</button>
                      `,
                    )
                    .join("")}
                </div>
              </div>

              <!-- 3. 状态 (Status) -->
              <div class="studio-dropdown-wrap">
                <button
                  type="button"
                  class="studio-meta-chip ${state.openDropdown === "status" ? "open" : ""}"
                  data-studio-dropdown="status"
                  aria-expanded="${state.openDropdown === "status"}"
                >
                  <span id="studio-chip-status-label">${escapeHtml(currentStatusLabel)}</span>
                  <i aria-hidden="true">⌄</i>
                </button>
                <div
                  class="studio-dropdown-menu"
                  role="menu"
                  ${state.openDropdown === "status" ? "" : "hidden"}
                >
                  ${statusOptions
                    .map(
                      (s) => `
                        <button
                          type="button"
                          role="menuitem"
                          class="studio-menu-item ${state.status === s.id ? "active" : ""}"
                          data-studio-set-status="${escapeHtml(s.id)}"
                        >${escapeHtml(s.label)}</button>
                      `,
                    )
                    .join("")}
                </div>
              </div>

              <span class="studio-meta-sep" aria-hidden="true">|</span>

              <button
                type="button"
                class="studio-more-info-trigger ${state.moreDrawerOpen ? "active" : ""}"
                data-studio-action="toggle-more-drawer"
                aria-expanded="${state.moreDrawerOpen}"
              >
                <span>更多信息</span>
                <i aria-hidden="true">⌄</i>
              </button>
            </div>

            <!-- 编辑工具行：编辑 / 预览两个页签；插入结构、插入图片、AI 导入轻量入口 -->
            <div class="studio-tool-row">
              <div class="studio-mode-tabs" role="tablist" aria-label="编辑与预览切换">
                <button
                  type="button"
                  role="tab"
                  aria-selected="${state.activeTab === "edit"}"
                  class="studio-mode-tab ${state.activeTab === "edit" ? "active" : ""}"
                  data-studio-tab="edit"
                >编辑</button>
                <button
                  type="button"
                  role="tab"
                  aria-selected="${state.activeTab === "preview"}"
                  class="studio-mode-tab ${state.activeTab === "preview" ? "active" : ""}"
                  data-studio-tab="preview"
                >预览</button>
              </div>

              <div class="studio-assist-tools">
                <!-- 单个插入结构菜单 -->
                <div class="studio-dropdown-wrap">
                  <button
                    type="button"
                    class="studio-assist-btn ${state.openDropdown === "insert" ? "active" : ""}"
                    data-studio-dropdown="insert"
                    aria-expanded="${state.openDropdown === "insert"}"
                  >
                    <span aria-hidden="true">☷</span>
                    <span>插入结构</span>
                  </button>
                  <div
                    class="studio-dropdown-menu studio-dropdown-right studio-insert-menu"
                    role="menu"
                    ${state.openDropdown === "insert" ? "" : "hidden"}
                  >
                    ${insertOptions
                      .map(
                        (ins) => `
                          <button
                            type="button"
                            role="menuitem"
                            class="studio-menu-item"
                            data-studio-insert="${escapeHtml(ins.id)}"
                          >
                            <strong>${escapeHtml(ins.label)}</strong>
                            <small>${escapeHtml(ins.hint)}</small>
                          </button>
                        `,
                      )
                      .join("")}
                  </div>
                </div>

                <span class="studio-assist-sep" aria-hidden="true">|</span>

                <label class="studio-assist-btn" for="studio-image-input" title="选择或直接粘贴图片，自动生成相对引用">
                  <span aria-hidden="true">▣</span>
                  <span>插入图片</span>
                  <input id="studio-image-input" type="file" accept="image/*" hidden />
                </label>

                <span class="studio-assist-sep" aria-hidden="true">|</span>

                <button
                  type="button"
                  class="studio-assist-btn ${state.aiPasteOpen ? "active" : ""}"
                  data-studio-action="toggle-ai-import"
                  aria-expanded="${state.aiPasteOpen}"
                >
                  <span aria-hidden="true">✦</span>
                  <span>AI 导入</span>
                </button>
              </div>
            </div>

            <!-- 正文区：单列 Markdown 输入，独立滚动；预览复用同一主体区域，保留 textarea 选区/光标/撤销历史/滚动 -->
            <div class="studio-body-zone">
              <textarea
                id="studio-input-body"
                class="studio-body-textarea"
                placeholder="在这里输入内容…"
                ${state.activeTab === "preview" ? "hidden" : ""}
                ${state.loading ? "disabled" : ""}
              >${escapeHtml(state.body)}</textarea>

              <div
                id="studio-preview-pane"
                class="studio-preview-pane"
                ${state.activeTab === "preview" ? "" : "hidden"}
              >
                <div
                  id="studio-preview-body"
                  class="studio-preview-markdown optical-markdown-body"
                >${
                  state.previewHtml ||
                  '<p class="studio-preview-placeholder">暂无正文内容，切回「编辑」开始撰写。</p>'
                }</div>
              </div>

              <!-- 右侧局部抽屉 1：更多信息 (340px, 不永久缩窄正文) -->
              <aside
                class="studio-local-drawer studio-more-drawer"
                id="studio-more-drawer"
                role="dialog"
                aria-label="更多档案信息"
                ${state.moreDrawerOpen ? "" : "hidden"}
              >
                <div class="studio-drawer-head">
                  <strong>更多信息 · 高级元数据</strong>
                  <button
                    type="button"
                    class="studio-drawer-close"
                    data-studio-action="close-more-drawer"
                    aria-label="关闭更多信息抽屉"
                  >×</button>
                </div>

                <div class="studio-drawer-body">
                  <div class="studio-drawer-field">
                    <label for="studio-input-summary">一句话摘要 (Summary)</label>
                    <textarea
                      id="studio-input-summary"
                      rows="2"
                      placeholder="40~85 字浓缩核心结论，用于索引与详情摘要"
                    >${escapeHtml(state.summary)}</textarea>
                  </div>

                  <div class="studio-drawer-field">
                    <label for="studio-input-tags">标签 (Tags · 逗号分隔)</label>
                    <input
                      id="studio-input-tags"
                      type="text"
                      value="${escapeHtml(state.tags)}"
                      placeholder="例如：subtitle, timeline, audio"
                      autocomplete="off"
                    />
                  </div>

                  <div class="studio-drawer-field">
                    <label for="studio-input-subcategory">子领域 (Subcategory)</label>
                    <input
                      id="studio-input-subcategory"
                      type="text"
                      value="${escapeHtml(state.subcategory)}"
                      placeholder="例如：video-workflow / cli-tool"
                      autocomplete="off"
                    />
                  </div>

                  <div class="studio-drawer-field">
                    <label for="studio-input-version">适用版本 / 环境 (Version Scope)</label>
                    <input
                      id="studio-input-version"
                      type="text"
                      value="${escapeHtml(state.version_scope)}"
                      placeholder="例如：Windows 11 / Python 3.12"
                      autocomplete="off"
                    />
                  </div>

                  <div class="studio-drawer-field">
                    <label for="studio-input-sources">来源与参考链接 (Source URLs)</label>
                    <input
                      id="studio-input-sources"
                      type="text"
                      value="${escapeHtml(state.source_urls)}"
                      placeholder="https://... （多个链接用逗号分隔）"
                      autocomplete="off"
                    />
                  </div>

                  <div class="studio-drawer-field">
                    <label for="studio-input-slug">文件标识 (File Slug)</label>
                    <input
                      id="studio-input-slug"
                      type="text"
                      value="${escapeHtml(state.fileSlug)}"
                      placeholder="自动根据标题生成，如 aegisub"
                      autocomplete="off"
                    />
                    <small class="studio-drawer-hint">存储路径：<code>${escapeHtml(targetRelPath)}</code></small>
                  </div>

                  <div class="studio-drawer-dates">
                    <span>创建：${escapeHtml(state.created || "—")}</span>
                    <span>更新：${escapeHtml(state.updated || state.created || "—")}</span>
                  </div>
                </div>
              </aside>

              <!-- 右侧局部抽屉 2：AI 笔记导入 (360px, 支持空白直接填入 & 已有正文预览确认/备份恢复) -->
              <aside
                class="studio-local-drawer studio-ai-drawer"
                id="studio-ai-drawer"
                role="dialog"
                aria-label="AI 笔记导入"
                ${state.aiPasteOpen ? "" : "hidden"}
              >
                <div class="studio-drawer-head">
                  <strong>✦ AI 笔记导入</strong>
                  <button
                    type="button"
                    class="studio-drawer-close"
                    data-studio-action="close-ai-drawer"
                    aria-label="关闭 AI 导入抽屉"
                  >×</button>
                </div>

                <div class="studio-drawer-body">
                  <p class="studio-ai-intro">
                    粘贴与 AI 对话生成的 Markdown（含或不含 Front Matter 均可），解析至当前草稿；确认无误后再点「保存并归档」写盘。
                  </p>

                  <div class="studio-ai-top-btns">
                    <button
                      type="button"
                      class="studio-ai-secondary-btn"
                      data-studio-action="copy-ai-prompt"
                    >复制通用 AI 提示词</button>
                    ${
                      state.aiPreImportBackup
                        ? `<button
                            type="button"
                            class="studio-ai-secondary-btn is-restore"
                            data-studio-action="restore-ai-backup"
                          >↺ 恢复导入前草稿</button>`
                        : ""
                    }
                  </div>

                  <textarea
                    id="studio-ai-raw-input"
                    class="studio-ai-textarea"
                    placeholder="在此粘贴 AI 生成的完整 Markdown 内容…"
                  >${escapeHtml(state.aiRawInput)}</textarea>

                  <div class="studio-ai-actions-row">
                    <button
                      type="button"
                      class="studio-primary-save-btn"
                      data-studio-action="apply-ai-import"
                    >解析 Markdown</button>
                    <button
                      type="button"
                      class="studio-ai-secondary-btn"
                      data-studio-action="close-ai-drawer"
                    >取消</button>
                  </div>

                  ${
                    state.aiPendingCandidate
                      ? `
                        <div class="studio-ai-conflict-box" role="region" aria-label="导入冲突确认">
                          <span class="conflict-kicker">检测到当前已有正文 · 请选择导入方式</span>
                          <strong class="conflict-title">${escapeHtml(state.aiPendingCandidate.title || "未命名解析笔记")}</strong>
                          <span class="conflict-meta">
                            ${escapeHtml(deskDomainTitle(state.aiPendingCandidate.category))} ·
                            ${escapeHtml(typeMeta(state.aiPendingCandidate.type).label)} ·
                            正文 ${state.aiPendingCandidate.body.length} 字
                          </span>
                          <p class="conflict-excerpt">${escapeHtml(state.aiPendingCandidate.summary || state.aiPendingCandidate.body.slice(0, 90))}…</p>
                          <div class="conflict-btn-row">
                            <button
                              type="button"
                              class="studio-ai-secondary-btn"
                              data-studio-action="confirm-ai-append"
                            >插入到正文末尾</button>
                            <button
                              type="button"
                              class="studio-primary-save-btn"
                              data-studio-action="confirm-ai-replace"
                            >替换当前草稿</button>
                          </div>
                        </div>
                      `
                      : ""
                  }
                </div>
              </aside>
            </div>

            <!-- 底部极简状态行 -->
            <footer class="studio-bottom-bar">
              <div class="studio-bottom-left">
                <span>${state.activeTab === "preview" ? "预览视图" : "Markdown"}</span>
                ${
                  state.imageImportingMsg
                    ? `<span class="studio-img-import-status">${escapeHtml(state.imageImportingMsg)}</span>`
                    : ""
                }
              </div>
              <div class="studio-bottom-right">
                <span>${lineCount} 行 · ${charCount} 字</span>
              </div>
            </footer>
          </div>
        </div>
      </section>
    </div>
  `;
}
