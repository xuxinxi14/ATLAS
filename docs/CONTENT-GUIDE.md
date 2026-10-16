# ATLAS 内容编写与维护指南（CONTENT GUIDE）

本指南说明如何在 **ATLAS · Personal Knowledge Terminal** 中以最低阻力记录、整理和维护个人知识档案。

---

## 1. 核心理念：先记下来，再谈完美

在 ATLAS 中，`content/` 目录是唯一需要人工维护的知识源：

- **日常随手记（< 1 分钟）**：直接在 `content/<分类>/` 或 `content/inbox/` 下新建 `.md` 文件，只写一个 `# 标题` 和几行正文/命令即可，无需手填繁琐的 Front Matter。
- **截图直接粘贴**：使用 Obsidian 或 VS Code 粘贴截图到同级 `./assets/` 目录，构建脚本会自动拷贝、压缩并修正线上路径。
- **微型速查卡（`snippet`）**：哪怕只有 5 行常用命令或快捷键，也是完整的一等公民档案，在 3D 档案抽出时的摘要面板就能直接看完。

---

## 2. 目录与五大初始领域

```text
content/
├── inbox/          # 闪念收集箱（随手记、报错片段、待 AI 整理草稿）
├── tools/          # 软件与工具（PPT-Master、Aegisub、Obsidian、Excel 等）
├── computing/      # 编程与 AI（Markdown、Git、Python、R、Codex、排错等）
├── research/       # 科研与实验（细胞培养、分子对接、生信、论文工作流等）
├── academics/      # 学科知识（生物学、化学、数学、课程总结等）
└── life/           # 创作与生活（视频制作、教学技巧、运动、生活技能等）
```

---

## 3. 两种编写模式

### 模式 A：极简模式（推荐日常高频记录）

只需新建文件（例如 `content/computing/git-undo.md`），直接写正文：

```markdown
# Git 撤销上次提交的常用命令

## 快速复习
- 保留工作区改动仅撤销 commit：`git reset --soft HEAD~1`
- 彻底丢弃上次提交及改动：`git reset --hard HEAD~1`
- 已推送到远程需安全回滚：`git revert HEAD`
```

构建脚本（M1 实现）会自动为你推导：
- `title` → `Git 撤销上次提交的常用命令`
- `category` → `computing`（来自父目录）
- `slug` → `computing/git-undo`
- `id` → `computing-git-undo`
- `type` → `snippet`（短篇无复杂章节自动识别为速查卡）
- `status` → `proficient`（若在 `inbox/` 下则为 `draft`）
- `created` / `updated` → 自动读取 Git 提交时间
- `summary` → 自动截取 `## 快速复习` 或首段文字

### 模式 B：完整显式结构（推荐系统教程与长期维护文档）

当你需要指定标签、关联前置知识、学习状态（用于 3D 槽位点亮）或重命名文件但保留旧链接时，可使用 Front Matter：

```yaml
---
id: tool-aegisub-timing
title: Aegisub 字幕时间轴快速校准
slug: tools/aegisub-timing
type: skill                  # concept | skill | troubleshooting | snippet
category: tools
subcategory: subtitle
tags: [Aegisub, 字幕, 视频制作]
status: proficient           # draft | todo | learning | proficient | review
summary: 使用音频频谱模式与快捷键在 Aegisub 中高效打轴与平移时间。
created: 2026-10-16
updated: 2026-10-16
version_scope: "Aegisub 3.2+"
source_urls: []
prerequisites: []
related: []
aliases: []
---
```

---

## 4. 3D 档案状态点亮规则（`status`）

| 状态值 | 含义 | 3D 档案大厅视觉表现 |
| --- | --- | --- |
| `draft` | 闪念草稿（`inbox/` 默认） | 默认仅在本地或草稿筛选中显示 |
| `todo` | 待学习 / 待整理占位 | **半透明虚影 / 待解密卡槽** |
| `learning` | 正在学习与验证中 | **琥珀色解析中指示灯** |
| `proficient` | 已掌握并完成归档 | **常亮高光实体档案卡（点亮状态）** |
| `review` | 需要复习或跨版本校准 | **脉冲校准提醒标识 + 首页待复习队列** |
