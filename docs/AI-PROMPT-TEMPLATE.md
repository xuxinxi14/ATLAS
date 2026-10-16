# ATLAS 知识归档通用 AI 提示词（Prompt Template）

在与任何聊天式 AI（ChatGPT、Claude、Gemini、DeepSeek、Kimi 等）对话学习完一项新技能、排障过程或学科概念后，直接将下方提示词发给它，即可生成**零报错、100% 适配 ATLAS 编译引擎与 3D/2D 双视图**的 `.md` 档案文件。

---

## 版本一：完整标准版（推荐日常主力使用）

> **用法**：在对话结束时直接复制整段发送给 AI；如需指定某个细分话题，可在末尾补充一句“重点整理刚才关于 XXX 的部分”。

```markdown
请将我们刚才对话中讨论和学习的技能/知识，整理成一份可直接放入我个人知识库 **ATLAS (Rhine Lab 科研档案系统)** 的 Markdown 文件。

请严格遵守以下 **ATLAS 编译引擎规范**（否则构建校验会报错），并将完整内容放在一个 ```markdown 代码块中输出，方便我一键复制保存：

### 一、文件头 YAML Front Matter 规范（严禁使用多行 `|` 语法，全部使用单行值或行内数组）
请在文件最开头输出以下格式的 Front Matter：
---
id: <分类前缀>-<英文短横线slug>
title: "<中文主标题：清晰、精准、偏向技术手册风格>"
slug: <category>/<英文短横线slug>
type: <只能从 concept | skill | troubleshooting | snippet 四选一>
category: <只能从 tools | computing | research | academics | life 五选一>
subcategory: <英文短横线子分类，如 cli-workflow / video-editing / bio-protocol>
status: learning
tags: [标签1, 标签2, 标签3]
summary: "<40~85字的一句话高信息密度摘要：必须包含核心工具/原理、解决什么问题、产出什么结果，这会直接显示在 3D 档案大厅的 01//摘要 页签>"
created: YYYY-MM-DD
updated: YYYY-MM-DD
version_scope: "<适用环境或软件版本，如 Windows 11 / Python 3.12 / 通用版本>"
source_urls: []
prerequisites: []
related: []
---

**字段约束说明：**
1. `category` 映射规则：
   - `tools`：常用工具软件（音视频、效率软件、文献与科研绘图工具等）
   - `computing`：计算机与编程（命令行、Git、Python/JS、环境配置、系统网络等）
   - `research`：科研实验（湿实验 SOP、生信分析、分子模拟、数据处理等）
   - `academics`：大学学科知识（核心概念、定理公式推导、课程重点等）
   - `life`：日常生活技能（硬件维护、影音压制、摄影、个人工作流等）
2. `id` 必须与 `slug` 对应（把 `slug` 中的 `/` 换成 `-`），且全小写英文加连字符（例如 `slug: computing/git-worktree`，则 `id: computing-git-worktree`）。
3. `created` 和 `updated` 请填写今天真实的 `YYYY-MM-DD` 日期。
4. `prerequisites` 和 `related` **必须保持为空数组 `[]`**（因为 ATLAS 编译器会强校验关联 ID 是否存在，填未知 ID 会导致构建报错）。
5. `source_urls` 如无真实可访问的完整 `https://` 官方文档链接，请保持为 `[]`。

### 二、正文结构规范（驱动 3D 档案卡四页签与 2D 阅读器）
正文请严格按以下章节组织（章节名不要改，ATLAS 会自动抓取对应区块渲染到 3D 界面）：

1. `# <与 title 一致的标题>`
2. `## 快速复习`（**极其重要：标题必须包含“快速复习”四个字**）
   - ATLAS 会将本节内容自动提取到 **3D 档案大厅的 `02 // 速查卡片` 页签**及 **2D 阅读器顶部高亮速查框**。
   - 请先用 2~3 条无序列表（`- **核心结论**：...`）浓缩最关键的命令、快捷键或判断准则（每条 20~60 字，ATLAS 会自动提取列表项进入 `03 // 要点与结论` 页签）。
   - 紧接着放一个最常用、可直接复制执行的最小代码块（带语言标识，如 `bash`、`python`、`powershell`）。
3. `## 核心原理与适用场景`（或 `## 故障成因分析`）
   - 简明解释这项技能底层是如何工作的，什么情况下该用它，什么情况下不该用。
   - 如涉及数学/物理/化学公式，请使用行内 `$...$` 或独立行 `$$...$$` LaTeX 语法。
4. `## 标准操作流程`
   - 使用有序列表 `1. 2. 3.` 拆解可复现的操作步骤，每一步给出明确输入、命令和预期反馈。
   - 关键注意事项请使用 GitHub 风格高亮块（仅限 `> [!TIP]`、`> [!NOTE]`、`> [!IMPORTANT]`、`> [!WARNING]`、`> [!CAUTION]`，首行写标识，下一行写内容）。
5. `## 常见排障与避坑指南`
   - 汇总刚才对话中我踩过的坑、易错参数或报错信息，采用“现象 → 原因 → 解决命令”的格式。
6. `## 验证清单`
   - 使用 Markdown 任务列表（`- [x] 检查项...`）列出 2~4 条验证这项技能已正确掌握或配置成功的标准。

最后，请在代码块外部用一句话告诉我：**建议保存的文件路径**（格式：`content/<category>/<英文slug>.md`）。
```

---

## 版本二：极简随手复制版（适合短对话 / 速查技巧）

> **用法**：如果你只是向 AI 问了一个小命令、报错解法或快捷键，想在 10 秒内生成可丢进 `content/` 的笔记，复制下面这段即可：

```markdown
请把我们刚才聊的技巧整理成一份 ATLAS 知识库 Markdown 笔记，放在一个 ```markdown 代码块里输出，并在最后告诉我建议保存的文件名（`content/<category>/<slug>.md`）。格式严格如下：

---
id: <category>-<英文短横线文件名>
title: "<中文标题>"
slug: <category>/<英文短横线文件名>
type: <skill | troubleshooting | snippet | concept 四选一>
category: <tools | computing | research | academics | life 五选一>
status: learning
tags: [标签1, 标签2]
summary: "<一句话概括核心作用与结论，50字左右>"
created: 2026-10-16
updated: 2026-10-16
version_scope: "通用版本"
source_urls: []
prerequisites: []
related: []
---

# <中文标题>

## 快速复习
- **核心用法**：一句话要点（会同步显示在 3D 档案要点页签）
- **关键参数/避坑**：一句话要点

```bash
# 最核心的一段可复制命令或代码
```

## 操作步骤与原理
1. 步骤一...
2. 步骤二...

> [!TIP]
> 补充提示或常见报错解决方式...

## 验证清单
- [x] 验证成功的标志
```
