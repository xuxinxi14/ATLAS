---
id: concept-markdown-basics
title: Markdown 核心语法与技术写作规范
slug: computing/markdown-basics
type: concept
category: computing
subcategory: documentation
tags: [Markdown, GFM, 数学公式, 技术写作]
status: proficient
summary: 掌握 GitHub Flavored Markdown（GFM）标题层级、代码块、表格、任务列表与 LaTeX 公式语法。
created: 2026-09-10
updated: 2026-10-16
version_scope: "CommonMark / GFM + KaTeX"
source_urls:
  - https://docs.github.com/zh/get-started/writing-on-github/getting-started-with-writing-and-formatting-on-github/basic-writing-and-formatting-syntax
prerequisites: []
related:
  - tool-obsidian
  - tool-ppt-master
aliases: []
---

# Markdown 核心语法与技术写作规范

## 快速复习

- **标题**：`# H1`（每篇仅一个主标题）、`## H2`（大章节，自动进入右侧 TOC 目录）、`### H3`（子步骤）。
- **代码块**：使用三个反引号加语言标识（如 ` ```bash `、` ```python `、` ```r `），避免使用缩进式代码块。
- **数学公式**：行内公式使用单美元符号 `$E = mc^2$`，独立公式块使用双美元符号 `$$...$$`。
- **表格与清单**：使用 `| 列1 | 列2 |` 绘制表格，使用 `- [x]` 与 `- [ ]` 记录可勾选的实验/部署核查项。

## 核心定义

**Markdown** 是一种轻量级纯文本标记语言。它允许作者使用易读易写的纯文本格式编写文档，随后在构建期确定性地转换为结构化 HTML 页面。在 ATLAS 中，Markdown 是所有知识条目的**唯一权威信源（Single Source of Truth）**。

## 常用语法示例

### 1. 围栏代码块与终端命令

```bash
# 校验内容完整性并构建静态索引
npm run check:content
npm run build:content
```

### 2. 结构化对比表格

| 语法元素 | 写法示例 | 典型用途 |
| --- | --- | --- |
| 行内代码 | `` `import.meta.env.BASE_URL` `` | 变量名、文件路径、快捷键、命令参数 |
| 引用提示 | `> **注意**：操作前先备份` | 关键前提、安全警告与重点结论 |
| 任务清单 | `- [x] 已验证步骤` | 实验 SOP 核对单、发布前检查表 |

### 3. LaTeX 数学与生化公式

行内公式示例：米氏常数 $K_m$ 表示酶促反应速率达到最大反应速率 $V_{\max}$ 一半时的底物浓度。

独立公式块示例：

$$\text{pH} = \text{p}K_a + \log_{10}\left(\frac{[\text{A}^-]}{[\text{HA}]}\right)$$

## 易错点与规范约束

1. **禁止依赖未闭合的原始 HTML 标签**：为保障公开站点安全并支持多端迁移，正文内不写 `<script>` 或裸 `<iframe>`。
2. **中英文混排留白**：建议在中文与英文单词、数字之间保持清晰可读性；代码块必须标注语言名称以启用语法高亮与一键复制。
