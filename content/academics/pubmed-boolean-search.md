---
id: academics-pubmed-boolean-search
title: "PubMed 医学文献检索式构造（MeSH 主题词与布尔逻辑）速查"
slug: academics/pubmed-boolean-search
type: skill
category: academics
subcategory: literature-review
tags: [PubMed, MeSH, 文献检索, 布尔逻辑, 科研写作]
status: proficient
summary: "结合 MeSH 规范主题词与 Title/Abstract 自由词构造高查全率、高查准率的 PubMed 布尔检索式。"
created: 2026-10-22
updated: 2026-11-02
version_scope: "PubMed / NCBI Entrez 检索语法"
source_urls:
  - https://pubmed.ncbi.nlm.nih.gov/help/
prerequisites: []
related:
  - concept-enzyme-kinetics
  - tools-ppt-master-workflow
aliases:
  - academics/pubmed
---

# PubMed 医学文献检索式构造（MeSH 主题词与布尔逻辑）速查

## 快速复习

- **标准组合范式**：同一概念内部用 `OR` 连接「MeSH 主题词 + 自由词同义词（`[Title/Abstract]`）」，不同核心概念之间用 `AND` 交集组合，布尔运算符必须**全大写（`AND` / `OR` / `NOT`）**。
- **为什么不能只搜 MeSH**：最新发表（In Process / Ahead of Print）的文献尚未完成人工 MeSH 标引，仅用 `[MeSH Terms]` 会漏掉近 3～6 个月的新文献；必须配合 `[tiab]` 自由词补齐。

~~~text
(("Autophagy"[MeSH Terms] OR "autophag*"[Title/Abstract])
  AND ("Ferroptosis"[MeSH Terms] OR "ferroptotic"[Title/Abstract] OR "ferroptosis"[Title/Abstract]))
  AND ("2021/01/01"[Date - Publication] : "3000"[Date - Publication])
~~~

## 常用字段限定符（Field Tags）对照表

| 字段标签 | 简写 | 检索范围说明 | 典型示例 |
| --- | --- | --- | --- |
| `[MeSH Terms]` | `[mh]` | NCBI 医学主题词表（自动包含下位词扩展） | `"Neoplasms"[Mesh]` |
| `[MeSH Major Topic]` | `[majr]` | 作为文章核心研究主题的 MeSH 词（提高查准率） | `"Enzyme Inhibitors"[Majr]` |
| `[Title/Abstract]` | `[tiab]` | 标题或摘要中出现的自由词（支持词尾截词符 `*`） | `"mitochondri*"[tiab]` |
| `[Publication Type]` | `[pt]` | 文献类型过滤（综述、RCT、Meta 分析） | `"Review"[pt] OR "Clinical Trial"[pt]` |
| `[Journal]` | `[ta]` | 指定目标期刊缩写或全称 | `"Nature"[ta] OR "Cell"[ta]` |

> [!IMPORTANT] 截词符与双引号规则
> 在 PubMed 中使用短语双引号 `"..."` 并附加字段标签（如 `"cell death"[tiab]`）会关闭自动词语映射（ATM），强制精确匹配该短语；若同时使用词尾截词符 `*`，至少需保留前 4 个字母（如 `"inhibit*"[tiab]`）。

## 文献筛选与汇报衔接流程

1. **初检定界**：先用核心综述（`"Review"[pt]`）快速摸清领域术语与经典指标（如酶动力学参数 $K_m, K_i$，参见 [[米氏方程与酶抑制动力学判读]]）。
2. **精化去噪**：用 `NOT ("animals"[MeSH Terms] NOT "humans"[MeSH Terms])` 排除纯动物实验（仅限临床研究场景）。
3. **整理入库**：将高价值文献的 PMID 与核心实验图表结论导入 [[PPT Master 科研组会汇报生成与核对工作流]] 或笔记库。

## 验证清单

- [x] 布尔逻辑词 `AND`、`OR`、`NOT` 已全部大写且括号层级闭合
- [x] 每个核心概念同时覆盖 `[MeSH Terms]` 与 `[Title/Abstract]`
