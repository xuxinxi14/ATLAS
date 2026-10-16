---
id: skill-r-dataframe
title: R 语言数据框（tidyverse / dplyr）高频清洗速查
slug: computing/r-dataframe
type: snippet
category: computing
subcategory: data-science
tags: [R语言, tidyverse, dplyr, 数据清洗, 生信]
status: learning
summary: 使用 dplyr 管道操作符筛选样本行、挑选基因列、分组汇总均值标准差及长宽表转换。
created: 2026-10-02
updated: 2026-10-16
version_scope: "R 4.3+ / tidyverse 2.0+"
source_urls:
  - https://dplyr.tidyverse.org/
prerequisites: []
related:
  - academics-biostatistics-tests
aliases: []
---

# R 语言数据框（tidyverse / dplyr）高频清洗速查

## 快速复习

```r
library(tidyverse)

# 核心五动词流水线：筛选行 -> 新增列 -> 分组汇总 -> 排序
summary_df <- raw_df |>
  filter(!is.na(expression), padj < 0.05) |>
  mutate(log2_fc = log2(treated / control)) |>
  group_by(cell_line, treatment) |>
  summarise(
    mean_fc = mean(log2_fc, na.rm = TRUE),
    sd_fc   = sd(log2_fc, na.rm = TRUE),
    n       = n(),
    .groups = "drop"
  ) |>
  arrange(desc(abs(mean_fc)))
```

## 宽表与长表互转（画 ggplot2 必用）

```r
# 宽表转长表（把多个样本列收拢为 sample 与 value 两列）
long_df <- wide_df |>
  pivot_longer(
    cols = starts_with("Rep_"),
    names_to = "replicate",
    values_to = "intensity"
  )

# 长表转回宽表
wide_again <- long_df |>
  pivot_wider(names_from = replicate, values_from = intensity)
```

## 验证与排查小贴士

- 每次 `left_join(a, b, by = "gene_id")` 前，先用 `count(b, gene_id) |> filter(n > 1)` 检查右表是否有重复键，防止行数意外翻倍！
