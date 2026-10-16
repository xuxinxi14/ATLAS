---
title: ATLAS 个人知识库开发规划书
author: 项目规划文档
version: 1.0
status: Proposal
updated: 2026-10-16
---

# ATLAS 个人知识库开发规划书

**副标题：基于 RhineLabUI 的个人知识档案终端**  
**英文名：ATLAS · Personal Knowledge Terminal**  
**文档版本：V1.0 ｜ 日期：2026-10-16 ｜ 状态：供开发实施**

> **项目目标**：以 Markdown 文件为知识内容的唯一权威来源，保留 RhineLabUI 的特色三维档案交互，并新增适合长期阅读与检索的二维知识界面。通过 GitHub 管理版本、GitHub Actions 构建、GitHub Pages 托管，建立可持续积累个人技能、学科知识及项目经验的网站。

## 0. 核心决策速览

| 决策项 | 本版方案 | 原因 |
| --- | --- | --- |
| 开发起点 | 从 `LBEILC/RhineLabUI` 建立**独立派生项目**，保留 Git 历史与许可 | 复用交互资产及现有 Three.js 动画，不污染上游 |
| 产品双模式 | 三维档案大厅 + 二维知识阅读器 | 兼顾视觉体验和高频查阅效率 |
| 本地存在形式 | 本地 Git/Obsidian 纯文本库 + 浏览器 WebUI（支持安装为桌面 PWA 独立窗口） | 写作零门槛（本地编辑器/AI直写），查阅兼具原生桌面终端感与热更新预览 |
| 主内容源 | 一个知识条目对应一个 Markdown 文件（支持 `inbox/` 闪念草稿箱） | 易编辑、可迁移、适配 Obsidian、VS Code 和 AI Agent |
| 内容编排 | **极简 Front Matter（支持自动推导）** + Markdown 正文 | 降低随手记录阻力，未填字段由构建脚本从目录、标题与 Git 历史自动补全 |
| 图片管理 | 支持**同级 `assets/` 就近粘贴**与 `public/media/` 集中管理，构建期自动压缩转存 | 适配 Obsidian/VS Code 直接粘贴截图并实时预览，同时保证线上加载速度 |
| 站点架构 | Vite + TypeScript + Three.js；构建期索引 | 继承现有技术栈，不必新设数据库或后端 |
| 第一版路由 | Hash 路由，如 `/#/entry/tools/ppt-master` | GitHub Pages 无需额外配置 SPA 回退 |
| 搜索 | 构建时生成索引，浏览器端本地搜索 | 无服务器、可以处理中英文、控制运行成本 |
| 一级领域 | 初始五个门户；文档数不设上限 | 保留五列视觉语言，不再要求每类八篇 |
| 发布方式 | 初期使用 GitHub Actions → GitHub Pages（架构兼容 Cloudflare Pages 根路径加速） | 推送 `main` 后自动部署，后续可零代码改动切入 CDN |
| 隐私边界 | 仅入库可公开内容；私密资料不提交至公开仓库 | 前端隐藏不等于源文件保密 |
| 首版非目标 | 登录、云同步、复杂后台数据库、网页端重型富文本编辑器 | 避免超出静态站点架构的开发负担 |

### 0.1 开发顺序与首要原则

先完成 **内容可增删、文档可读、搜索可用、网站可发布**，再扩展 3D 动效和进阶功能。三维界面不得成为访问知识的唯一入口：在 WebGL 不可用、移动端或低性能设备上，用户必须仍可访问全部知识。

### 0.2 验收终局（一句话）

在 `content/` 中新增一份合规（含极简模式）Markdown → 执行校验和构建 → 新文档自动出现在分类、搜索及阅读器中，既有内容不受影响 → 推送 GitHub 后线上可访问；文档总数大于 40 仍可正常工作。

## 1. 产品需求文档（PRD）

### 1.1 项目背景

日常学习产生的知识碎片分布于聊天记录、课堂资料、软件使用过程和项目开发历史。很多技能并非没有学会，而是过段时间不再记得步骤。ATLAS 希望解决「学过—记录—检索—复习—重用」链路的不连续问题。

知识内容覆盖但不限于：PPT-Master、Aegisub、Obsidian、Markdown、GitHub、Codex、Python/R、细胞培养、实验方法、分子对接、课程总结、技术故障处理、教学技巧及生活技能。

### 1.2 主要用户与使用情境

**用户定位**：主要由知识库所有者维护，公开网站访客仅浏览。写作在本地文件与 Git 中完成（配合网页端快捷跳转 GitHub Web 编辑小修小补），网站默认不设立独立数据库后台。

1. **快速回忆**：半年后忘记 Aegisub 调整字幕时间轴的方法，进入网站搜索关键词，30 秒内定位到操作摘要或微型速查卡。
2. **系统复习**：准备实验前从「科研与实验」查找前置知识、术语、注意事项和相关文档；根据首页「待校准档案」提醒定期温习。
3. **问题复用**：处理 Vite/GitHub Pages 的静态资源 404 问题后，留下故障条目，以后遇到同类问题可复现解决过程。
4. **持续积累（低阻力）**：学习一项技能后随手记几行到 `inbox/`，或由 AI Agent 直接从聊天记录生成草稿，人工验证后提交 Markdown；无需手填繁琐元数据或修改 UI 代码。
5. **对外分享**：向同学分享某条文档链接，对方能直接打开文章并理解其适用版本与来源。

### 1.3 产品设计原则

- **先找得到，再看得酷**：三维场景是特色入口，不妨碍直接搜索和阅读。
- **零阻力记录，高仪式感呈现**：写笔记时允许极简元数据、同级粘贴截图与几行速查卡；展示时通过 3D 档案槽位点亮与终端遥测面板给予即时正反馈。
- **内容与界面分离**：Markdown 存储知识；Three.js 只负责展示；同一知识条目在任何视图数据一致。
- **离线可维护**：即使不用专用编辑器，也能在文本编辑器或 Obsidian 中正常维护所有文章。
- **轻量而可扩展**：首期不引入后端；保留未来增加图谱、PWA 桌面独立窗口和 CDN 双部署的扩展边界。
- **可验证且可移植**：编译失败能反馈到具体文章、具体字段和具体链接；文件可迁移到其他静态站点工具。
- **公开安全**：尊重来源许可证，不上传账号凭据、患者信息、未获授权文档或私密研究数据。

### 1.4 范围分级

| 优先级 | 能力 | 首版要求 |
| --- | --- | --- |
| P0 | Markdown 内容引擎 | 必须：解析、极简字段自动推导、就近图片处理、索引、校验、导出 |
| P0 | 目录与分类 | 必须：五个初始领域、子分类/标签、条目无限增长、`inbox` 草稿箱隔离 |
| P0 | 阅读器与快捷编辑入口 | 必须：中文排版、目录、代码、图片、表格、GFM、数学公式、一键跳 GitHub/本地编辑器 |
| P0 | 搜索 | 必须：标题、标签、摘要、正文的中文英文搜索 |
| P0 | 三维档案入口 | 必须：原有关键交互可用；有限可见窗口映射任意多文档；支持速查卡摘要直览 |
| P0 | GitHub Pages 自动部署 | 必须：子路径兼容、动作构建、失败阻断发布 |
| P0 | 无 WebGL 回退 | 必须：二维目录可访问所有文章 |
| P1 | 收集激励与正反馈系统 | 3D 档案状态点亮（虚影待解密/解析中/已掌握）、首页终端遥测 HUD、待复习队列提醒 |
| P1 | CLI 脚手架与 Agent 归档 | `npm run new` 一键生成文章模板；内置 AI 归档规范 |
| P1 | 收藏/最近阅读 | 浏览器本地存储；不承诺跨设备同步 |
| P1 | 学习状态/关联知识 | 从元数据展示、筛选与导航 |
| P1 | 多维筛选和快捷命令 | 分类、标签、状态、类型；键盘可达 |
| P2 | 关系图谱、深度统计看板 | 只在文档和链接关系充分后实现 |
| P2 | PWA 桌面窗口与完整离线 | 支持浏览器一键安装为独立桌面终端窗口；内容版本与模型资源分级缓存 |

## 2. 信息架构与导航

### 2.1 五个一级门户

| 门户 ID | 中文标题 | English | 典型内容 |
| --- | --- | --- | --- |
| `tools` | 软件与工具 | TOOLS | PPT-Master、Aegisub、Obsidian、Excel |
| `computing` | 编程与 AI | COMPUTING | Markdown、Git、Python、R、Codex |
| `research` | 科研与实验 | RESEARCH | 实验技能、对接、生信、论文工作流 |
| `academics` | 学科知识 | ACADEMICS | 生物学、化学、数学、课程笔记 |
| `life` | 创作与生活 | LIFE | 视频、教学、运动、生活问题 |

**重要约束**：以上五个是初始导航与三维视觉列，而不是数据库允许的分类总数。V1 使用配置文件定义五个门户；后续允许新增一级门户，其内容始终能被二维索引和搜索发现。若 3D 还未适配新增列，要将新增领域通过「全部条目 / 更多」入口呈现，不得静默丢失。此外设立特殊的 `content/inbox/` 闪念收集箱，用于存放尚未分类或尚在整理中的随手笔记。

### 2.2 四种核心知识类型

- **概念 `concept`**：讲清是什么、为什么、何时适用。如「Markdown 是什么」。
- **技能 `skill`**：面向具体操作流程，含前置条件、步骤、结果校验。如「使用 Aegisub 制作字幕」。
- **排错 `troubleshooting`**：问题症状、环境、原因、修复步骤、复现与验证。如「Vite GitHub Pages 资源路径 404」。
- **速查卡 `snippet`（微型档案）**：一等公民，面向高频命令、快捷键、参数表或几句话经验（如「Git 撤销上次提交的 3 条命令」）。无需凑齐长文结构，在 3D 卡片抽出时的摘要面板即可直接看完核心内容，2 分钟即可写完一篇。

可预留 `reference`（长篇参考手册）和 `experience`（项目复盘），不在 V1 增加冗余 UI。

### 2.3 导航关系

**启动 → 档案大厅 / 二维索引 → 分类或搜索 → 档案详情 → 文章阅读器 → 关联文章**。搜索结果允许绕开三维动画直接打开阅读器；从 3D 进入时才触发抽取及解密动画。

推荐导航地址示例：`https://xuxinxi14.github.io/Personal-Atlas/#/entry/tools/ppt-master`。条目链接采用稳定的 `slug`；若路径更名，需通过别名映射保留旧链接。不要让页面依赖随机索引或 `X-001` 这样的连续编号。

## 3. 交互与视觉设计规范

### 3.1 整体视觉方向

沿用 RhineLabUI 的克制科技终端风格：浅色或深色底、细分隔线、精确留白、电子档案、适量玻璃质感、局部高亮。新增自有品牌「ATLAS」，不得把受版权保护的游戏标志当作原创品牌使用。视觉为阅读服务，避免过度闪烁、长时间入场动画、过亮文字光晕。

基本建议：正文以高可读无衬线中文字体为主；等宽字体用于代码与编号。正文桌面端默认 15–17px、行高 1.65–1.8；主文章宽 720–860px，目录层级不超过三层的常见视图；小屏遵循内容优先原则。具体值以实机测试调整。

### 3.2 关键页面详规

#### A. 启动入口 / Home（含终端遥测面板 Telemetry HUD）

**作用**：树立系统识别度；提供「进入 3D 档案」「打开知识索引」「搜索」三个独立路径，并提供持续积累的正反馈。

- 首次可以播放短启动序列，但需明显可见「跳过」；再次访问默认记住选择。
- **终端遥测面板（Telemetry HUD）**：以克制的科技终端风格展示：
  - 总归档数、五个门户完备度进度条、最近更新热力格（类似 Contributions 记录）；
  - **待校准档案队列（Review Queue）**：自动筛选 `status: review` 或距离 `updated` 超过 180 天的操作类档案，提示「X 份档案建议复习校准」，点击可直达 30 秒速览。
  - 所有计数与状态均来自构建索引，不能写死。
- 页脚有来源/许可证入口。无 WebGL 时自动隐藏 3D 入口或给出明确说明。

#### B. 三维档案大厅 / Archive（含状态点亮与微卡片直览）

**保留**：五列三维阵列、前后翻阅、抽取、回位、适度解密、鼠标/键盘操作。

**重构**：档案位置与真实知识条目解耦。数据层提供 `entryId`，显示层维护固定可见槽位池（virtual slots），滚动时按当前分类的条目顺序映射。五列初始门户每列可以是任意数量的文章，0 篇时显示空状态，1 篇时不会无限循环出错，100 篇时不生成 100 份独立模型。

- **档案槽位「解锁与点亮」视觉反馈**：利用条目 `status` 在三维阵列中呈现差异化视觉状态，强化收集与学习的成就感：
  - `todo`（待整理/想学占位）：呈现为**半透明虚影/待解密卡槽**；
  - `learning`（学习验证中）：呈现为**琥珀色解析中指示灯**；
  - `proficient`（已掌握归档）：点亮为**完整常亮高光实体档案卡**；
  - `review`（需复习校准）：附加轻量脉冲校准标识。
- 选中卡片显示标题、编号（视觉编号，非数据库主键）、概述、标签与掌握状态。
- 打开卡片时三维动效过渡到档案摘要；若为 `snippet`（微型速查卡），直接在摘要面板完整渲染命令与要点，无需二次跳转；长文则提供「阅读完整文档」按钮。
- 首次 / 低配设备默认不过度加载重型音频与模型；动画播放中允许取消和快速操作。
- 支持鼠标、方向键及触摸；`Esc` 回退；`/` 聚焦搜索；导航时有可访问焦点。

#### C. 二维知识索引 / Library

支持列表/卡片切换、分类树、标签、类型（含 `snippet` 速查卡过滤）、状态、最近更新时间筛选；视图可按标题、最近更新、字母或自定义顺序排序。每条显示标题、摘要、标签及适用范围/更新日期。支持按分类折叠并直达文章，不依赖 3D。

#### D. 知识阅读器 / Reader

桌面三栏：左侧知识树（可折叠）、中部 Markdown 正文、右侧本页大纲/相关知识。平板折叠为两栏，手机仅保留正文，其余内容由抽屉承载。

阅读器须支持：

- Markdown 标题、列表、任务清单、引用、表格、图片、代码块、脚注或有价值的扩展语法；
- GFM 与 LaTeX 数学公式（KaTeX 或兼容方案）；代码高亮与一键复制；图片适应宽度及放大；
- 自动标题锚点、目录随滚动高亮、上一篇/下一篇、相关文章；
- **快捷编辑入口 `[EDIT]`**：文章顶部/右上角提供终端风格编辑按钮，线上环境一键跳转至对应 Markdown 文件的 GitHub Web 编辑页（或 `github.dev` 在线编辑器），本地开发环境支持通过 `vscode://file/...` 或 Obsidian URI 直接唤起本地编辑器修改；
- 顶部 **30 秒快速复习** 区：当文档含 `quickstart` 或 `## 快速复习` 时突出显示；
- 外部链接标识；失效相对链接在构建期被发现；深色/浅色主题；减少动画选项；
- 不执行 Markdown 内原始 HTML/任意脚本；必要的 HTML 必须走白名单过滤。

#### E. 搜索 / Search

支持 `Ctrl+K` / `⌘K` 打开命令搜索，`/` 在无输入焦点时聚焦搜索。标题优先、标签和摘要其次、正文最后；结果展示命中摘要及所属分类。中英文、大小写、全半角做基本归一化，中文支持合理的子串/双字片段匹配。空关键词展示最近访问或热门类别。无结果显示可操作建议。

#### F. 设置 / Settings

提供主题、声音、动态效果、画质、默认启动模式、缩放、缓存状态、关于/署名说明。收藏与最近访问在本机浏览器本地保存；加清除按钮。重要偏好应在更新后保持，但使用浏览器无痕模式或清理存储可能丢失。

### 3.3 可访问性与性能

- `prefers-reduced-motion` 可自动触发简化动效，并允许用户明确覆盖；对闪烁和快速移动设置上限。
- 键盘可访问所有内容；弹窗有焦点管理；使用语义按钮和适当 `aria-label`。
- 降级模式不需要 WebGL；手机不强制加载整个三维场景；离开 3D 时可释放 GPU 资源。
- 对搜索、目录和正文内容采用按需加载；模型、音乐与完整字库不要阻塞首次阅读。

## 4. 内容标准与数据模型

### 4.1 存储原则

`content/` 是唯一需要人工维护的知识内容。构建脚本派生 manifest、全文索引、相关文章索引及所需静态媒体 URL；`dist/` 和索引产物不手动编辑。条目唯一 `id` 在改标题时保持不变，避免收藏、链接和统计指向其他文章。

### 4.2 标准条目结构与极简自动推导

#### 4.2.1 完整显式结构（推荐用于正式长文）

```yaml
---
id: tool-ppt-master
title: PPT-Master 使用指南
slug: tools/ppt-master
type: skill
category: tools
subcategory: presentation
tags: [PPT, AI, 自动化]
status: proficient
summary: 使用 PPT-Master 辅助制作、修改和验收演示文稿。
created: 2026-10-16
updated: 2026-10-16
version_scope: "按实际软件版本记录"
source_urls: []
prerequisites: [concept-markdown-basics]
related: [tool-powerpoint]
aliases: []
---

# PPT-Master 使用指南

## 快速复习
在这里写 3～5 条关键操作，不写未经验证的命令。

## 适用场景

## 前置准备

## 操作步骤

## 验证结果

## 常见问题与修复

## 来源与版本记录
```

#### 4.2.2 极简模式与构建期自动推导（零阻力随手记）

为避免繁琐的元数据填写打断记录心流，内容引擎支持**极简 Front Matter（甚至零 Front Matter）**，未显式声明的字段由 `build:content` 按以下规则自动推导补全：

- `title`：若未填，自动提取 Markdown 正文第一个 `# 一级标题`；若仍无则取文件名。
- `category`：若未填，自动取 `content/<category>/...` 的一级目录名（若位于 `content/inbox/` 则归为 `inbox`）。
- `slug`：若未填，自动由 `<category>/<文件名去后缀>` 生成（如 `tools/ppt-master`）。
- `id`：若未填，默认由规范化后的 `slug` 将 `/` 替换为 `-` 生成（如 `tools-ppt-master`）。**建议**：当后续需要移动或重命名文件但希望保持永久链接不变时，再将该 `id` 和旧 `aliases` 显式固化到 Front Matter 中。
- `type`：若未填，正文少于 300 字且无多级标题时默认推导为 `snippet`（速查卡），其余默认为 `skill`。
- `status`：位于 `content/inbox/` 下默认为 `draft`（草稿），其余默认为 `proficient`（或按配置默认 `learning`）；支持 `draft | todo | learning | proficient | review`。
- `created` / `updated`：若未填，优先读取 `git log` 中该文件的首次提交日期与最后修改日期（统一格式化为 `YYYY-MM-DD`）；未纳入 Git 时回退至文件系统时间。
- `summary`：若未填，自动提取 `## 快速复习` 下的首段纯文本，或正文第一段前 80 个字符。

**声明**：显式填写的 `related` 和 `prerequisites` 保存稳定 `id`，不使用显示标题；构建时校验目标 `id` 是否存在并给出明确提示。

### 4.3 内容质量、速查卡与闪念草稿箱

正式教程建议按需回答：这是做什么的？在什么环境能用？开始前准备什么？具体怎么做？怎样确认成功？常见失败如何处理？依据或原始资料是什么？

- `skill`：建议包含步骤和结果验证；
- `concept`：建议说明定义、前置概念、例子和易错点；
- `troubleshooting`：建议记录症状、环境/版本、原因假设、修复步骤与修复验证；
- `snippet`（微型速查卡）：**一等公民**，专用于记录几行常用命令、快捷键表、配置片段或实验小窍门，不强制要求包含完整章节，不应为了形式强制填充空段落；
- **`content/inbox/`（闪念收集箱）**：遇到刚解决的 Bug 或零散灵感，可直接丢入 `content/inbox/`（或标记 `status: draft`）。构建脚本对草稿放宽结构校验，默认仅在本地开发模式或二维「草稿箱」筛选器中可见，待周末人工或交给 AI Agent 整理后再移入正式分类。

### 4.4 图片、链接与公式（支持就近存放与自动压缩）

- **图片双模式支持（就近粘贴优先）**：
  1. **就近存放（Co-location，推荐日常写作）**：允许直接在文档所在目录的 `assets/` 子目录存放图片（如 `content/tools/assets/timeline.png`），Markdown 内直接使用标准相对路径 `![](./assets/timeline.png)`。这样在 Obsidian 或 VS Code 中可通过粘贴截图插件直接 `Ctrl+V` 并实时预览。
  2. **公共媒体目录（兼容集中管理）**：也支持存放于 `public/media/<entry-id>/`，使用 `media/<entry-id>/xxx.png`。
  - **构建期处理**：`build:content` 统一校验图片文件存在性，将 `content/**/assets/` 下的引用图片自动拷贝（可配置自动转换为高压缩比 WebP）至构建输出目录，并由统一 URL 解析器补齐 `import.meta.env.BASE_URL`，**禁止在 Markdown 中直接写死域名或仓库子路径**。
- 内部知识关联使用稳定 `id`、规范 `slug` 或双链语法，统一解析为 Hash 路由；重命名不使旧链接失效。
- 外部 `source_urls` 仅允许 `https:` / `http:`；默认在新标签页打开时使用 `rel="noopener noreferrer"`。
- 不对不可信 Markdown 启用 raw HTML 和任意 iframe；数学渲染、代码高亮与链接过滤均使用明确的安全配置。

### 4.5 内容构建流水线

1. 遍历 `content/**/*.md`，读取 Front Matter 和 Markdown，执行缺失字段自动推导（标题、分类、Git 时间、摘要等）；
2. 用 schema 校验字段类型、唯一 `id`、唯一 `slug`、分类、日期、图片文件及内部引用；
3. 处理就近图片拷贝与 WebP 优化，安全渲染或打包 Markdown；生成目录 TOC、文字摘要、标签、待复习队列和遥测统计数据；
4. 建立轻量中文/英文混合全文检索索引，按需加载到浏览器；
5. 输出 `entries-manifest.json`、`search-index.json`、`telemetry.json` 与文章 HTML/数据；
6. 运行内容、路由、响应式与构建测试；通过后再部署。

**搜索实现建议**：先以基础归一化+中文子串/双字切分取得可验收版本，再视内容量引入 MiniSearch/FlexSearch 等本地库；不得假设英文空格分词能够覆盖中文。建立标题权重 > 标签 > 摘要 > 正文的可解释评分；索引压缩大小纳入性能检查。

## 5. 技术架构与代码改造

### 5.1 现有仓库核查结果（2026-10-16）

核查仓库：`https://github.com/LBEILC/RhineLabUI`，默认分支 `main`。仓库 README 与代码展示为 Vite + TypeScript + Three.js，`package.json` 要求 Node.js 22.12+，Vite 构建输出静态 `dist/`。内容来自 `content/archives.json`，原设计是五类共 40 份档案，每类八份；校验脚本会拒绝档案数与类别容量不符。`src/data.ts` 在类别与行号之间直接换算；`src/main.ts` 包含大量 UI/状态逻辑；`vite.config.ts` 的网页模式 `base` 默认为 `/`，与 GitHub Pages 仓库子目录地址冲突。

已有的开场、GLB 模型、音效、PWA 和质量设置可以复用，但不能假设原有资源路径、缓存策略或档案索引能够直接支持任意数量 Markdown 文档。

### 5.2 建议模块边界与本地运行形态

#### 5.2.1 电脑本地存在与使用形式

本项目在个人电脑本地以 **「纯文本文件库（底层资产） + 浏览器/PWA 终端界面（交互 WebUI）」** 的双层形态存在，无需安装臃肿的数据库或专有后台：

1. **底层文件形态（写作与管理）**：本地就是一个普通 Git 文件夹（如 `e:\ATLAS`），`content/` 下全是标准 Markdown 与图片。可直接把 `content/` 作为 **Obsidian 仓库（Vault）** 打开，或用 **VS Code / AI Agent（Antigravity、Codex）** 直接读写文件。
2. **本地 WebUI 实时预览形态（边写边看）**：在本地运行 `npm run dev`，通过浏览器打开本地 WebUI（如 `http://localhost:5173`）。支持文件热更新（Watch 模式）——在 Obsidian 或 VS Code 中按 `Ctrl+S` 保存笔记，浏览器内的 3D 档案大厅与 2D 阅读器即刻自动刷新。
3. **桌面独立终端应用形态（PWA 一键安装，日常查阅）**：通过 Chrome / Edge 打开本地或线上网址，点击地址栏「安装 ATLAS 应用」，即可在 Windows 桌面和任务栏生成独立的 **ATLAS 终端图标**。点开即为无浏览器边框的独立窗口，配合 Service Worker 离线缓存，日常查资料无需敲命令行启动服务，体验与原生桌面软件一致。

#### 5.2.2 模块数据流

```text
content/**/*.md (+ assets/)  事实内容（Obsidian / VS Code / AI 编辑入口）
    ↓
scripts/build-content.ts     字段推导、Schema 校验、图片转存、派生索引与遥测
    ↓
src/knowledge/               Entry / Catalog / Relationships / Search / Telemetry
    ├── src/archive/          Three.js 演示适配器（含状态点亮与微卡片摘要）
    ├── src/library/          二维分类目录与多维筛选
    ├── src/reader/           Markdown 阅读、TOC、相关文章、快捷编辑跳转
    ├── src/search/           搜索面板、排名与高亮
    └── src/app/              路由、设置、主题、导航、遥测 HUD
    ↓
Vite build → dist/ → GitHub Actions → GitHub Pages（兼容 Cloudflare Pages）
```

适配接口建议：

```ts
type EntryId = string;
type EntryType = 'concept' | 'skill' | 'troubleshooting' | 'snippet';
type EntryStatus = 'draft' | 'todo' | 'learning' | 'proficient' | 'review';

interface KnowledgeEntry {
  id: EntryId;
  slug: string;
  title: string;
  category: string;
  type: EntryType;
  status: EntryStatus;
  tags: string[];
  summary: string;
  updated: string;
}
interface KnowledgeRepository {
  all(): KnowledgeEntry[];
  byId(id: EntryId): KnowledgeEntry | undefined;
  bySlug(slug: string): KnowledgeEntry | undefined;
  listByCategory(category: string): KnowledgeEntry[];
}
```

**禁止**让 Three.js 场景组件直接解析 Markdown 文件或读取文件系统。场景只消费经过验证的条目 metadata 与 `EntryId`。

### 5.3 RhineLabUI 模块迁移清单

| 上游路径 | 建议动作 | 开发要点 |
| --- | --- | --- |
| `src/scene.ts` | 保留并逐步适配 | 只改数据绑定、状态材质表现与生命周期，避免整体重写渲染器 |
| `src/archive-loop.ts` | 重构 | 固定槽位循环 → 动态数据窗口，处理 0/1/N 项 |
| `src/data.ts` | 替换 | JSON 直接映射 → manifest 读取；稳定 id 为索引主键 |
| `src/main.ts` | 渐进拆分 | 把路由、3D 管理、弹窗、知识详情逐步移出 |
| `src/model-viewer.ts` | 视需要复用 | 若仍用于档案模型预览保留；不得挡住文章阅读 |
| `src/boot.ts` 等 | 保留/简化 | 支持跳过、偏好持久化与无障碍降级 |
| `content/archives.json` | 冻结示例后迁出 | 不再承担正式知识内容的唯一存储 |
| `scripts/archive-content.mjs` | 修改或替代 | 新 schema（含自动推导）+ 就近图片/链接/slug 校验 |
| `scripts/check-content.mjs` | 测试迁移 | 删除固定 40 份/五类八份假设，增加任意数量与极简模式测试 |
| `vite.config.ts` | 修改 | GitHub Pages `base` 可配置、媒体和 GLB 使用正确基址 |
| `src/pwa.ts` | 延后整合 | 避免旧缓存持有错误地址；支持桌面独立窗口与按需下载重资源 |
| `public/assets/*.glb` | 有条件保留 | 资产加载单独动态导入，确认来源与许可证 |

### 5.4 技术实现取舍

- **继续使用**：Vite、TypeScript、Three.js、已有 UI 动画与质量控制系统。
- **新增**：Markdown AST/HTML 渲染管线、字段自动推导与 schema 校验、就近图片打包、搜索索引、轻量路由、阅读器组件、CLI 新建文章脚手架、内容测试。
- **暂不引入**：Next.js 服务端渲染、数据库、鉴权、通用 API、重型独立后台编辑器。
- **关于框架**：现有项目并非 React 工程。MVP 优先沿用现有架构并小规模模块化，不以「全面迁移 React/Vue」作为前置条件；若后期阅读器组件复杂到需要框架，单独立项评估。
- **三维超量数据**：按当前门户仅维持可见的卡片实例/对象池，展示任意数量条目的逻辑窗口，禁止每多一篇都复制昂贵 GLB 资源。

### 5.5 建议目标目录（可渐进迁移）

```text
Personal-Atlas/
├── content/
│   ├── inbox/                  # 闪念草稿箱（随手记、AI 待整理碎片）
│   ├── tools/
│   │   └── assets/             # 就近存放截图（支持 Obsidian/VS Code 直接粘贴）
│   ├── computing/
│   ├── research/
│   ├── academics/
│   └── life/
├── public/
│   ├── media/                  # 公共/集中式媒体资源
│   └── assets/                 # 3D 模型、字体与音效
├── src/
│   ├── app/
│   ├── knowledge/
│   ├── archive/
│   ├── library/
│   ├── reader/
│   ├── search/
│   └── styles/
├── scripts/
│   ├── new-entry.ts            # npm run new 交互式/快捷生成笔记脚手架
│   ├── build-content.ts
│   └── validate-content.ts
├── tests/
│   ├── content/
│   ├── routing/
│   ├── reader/
│   └── archive/
├── .github/workflows/deploy.yml
├── docs/
│   ├── ARCHITECTURE.md
│   ├── CONTENT-GUIDE.md
│   └── ATTRIBUTION.md
├── README.md
├── package.json
└── vite.config.ts
```

## 6. 工程交付与 GitHub Pages

### 6.1 仓库与分支

建议使用 GitHub 账号 `xuxinxi14` 下新仓库 `Personal-Atlas`。从 RhineLabUI 以 fork 或带历史 clone 的方式建立独立仓库（不建议直接删除原上游许可/历史）。基于 `main` 主分支、功能分支和小粒度提交进行开发：例如 `feat/content-engine`、`feat/reader`、`feat/archive-dynamic`。

首次提交先完成版权说明与品牌配置，不直接发布未清理的原有角色设定或演示档案内容。待来源资源审查完成，再决定哪些模型、字体和音效可合法继续使用。

### 6.2 Vite 与路由

假设发布地址：`https://xuxinxi14.github.io/Personal-Atlas/`。应以配置项设置 `base: '/Personal-Atlas/'`（或使用环境变量），替换代码里硬编码的 `/assets/...`、`/audio/...`、`/manifest...` 为统一的基址拼装器。场景和 PWA 均需检查。为了不依赖 Pages 的服务端回退，V1 使用 `/#/entry/<slug>` Hash 路由。将来如要 SEO 可评估预渲染和生成实体 HTML 页面，但不作为首版障碍。

### 6.3 自动化发布流程

`pull_request`：依赖安装 → 类型检查 → 内容校验 → 单元测试 → 构建（可额外做浏览器回归）。`push main`：上述检查全部通过后，上传 `dist/` 为 GitHub Pages artifact 并发布。GitHub 仓库 Settings → Pages → Source 选择 **GitHub Actions**。`actions/deploy-pages` 所在作业只给予 `pages: write` 与 `id-token: write` 等必要权限；生产发布需依赖成功的构建作业。

建议脚本接口：

```json
{
  "scripts": {
    "new": "node scripts/new-entry.mjs",
    "check:content": "node scripts/validate-content.mjs",
    "build:content": "node scripts/build-content.mjs",
    "typecheck": "tsc --noEmit",
    "test": "node --test tests/**/*.test.mjs",
    "build": "npm run build:content && tsc && vite build"
  }
}
```

**说明**：这是目标接口草案，不代表原仓库已有这些脚本。最终命令以实现后的脚本文件及 Windows/CI 兼容性为准。

### 6.4 性能预算与建议指标

以下是项目目标而非已测得的事实。需要在 Chrome/Edge 的桌面中端设备和典型手机上测试：

| 场景 | 初版目标与方法 |
| --- | --- |
| 无 WebGL | 能打开首页、索引、搜索和全部文章；不出现空白页 |
| 首次读文 | 无须等待 GLB 与背景音乐下载，尽量 3 秒内达到可交互（按测试网络记录） |
| 200 篇示例文档 | 搜索结果正确、滚动响应流畅；测索引体积和首次响应 |
| 三维阵列 | 帧率目标不低于原仓库同设备的可接受体验，新增文章不导致线性实例增长 |
| 移动端 | 360px 宽无横向溢出，正文代码块可独立横向滚动 |
| 构建过程 | 内容错误显示文件、行号/字段或可定位的诊断信息，并使 CI 失败 |

## 7. 开发里程碑与任务拆分

每个里程碑使用 **单独可回退的 PR**。建议先建立基线记录，运行原仓库的现有构建与测试；所有真实改造必须遵守「测试—实现—验收」闭环。

### M0｜基线建立与分离（首个 PR）

**任务**：复制/派生上游，记录依赖与许可证，安装依赖，复现 `npm run build` 和原有检查；添加项目名、README、开发约定；保存原三维模式截图/关键行为基线。

**验收**：项目本地可启动；原阵列、选择、返回、搜索不回归；许可证与第三方素材风险清单已记录；无对上游仓库的写操作。

### M1｜内容引擎与零阻力创作流（架构关键路径）

**任务**：实现 Markdown 扫描、极简 Front Matter 自动推导（从标题/目录/Git历史自动补全）、类型校验、slug / id 去重、内部引用检查、就近 `assets/` 图片拷贝与路径解析、`inbox/` 草稿箱宽容模式、`npm run new` 脚手架及构建产物；添加五个各具代表性的真实示例条目（含 `snippet` 微型速查卡）。

**测试**：空目录、零 Front Matter 极简文章、重复 ID、重复 slug、无效日期、未知类型、坏图片链接、就近 `assets/` 图片解析、不存在的相关条目、中文路径、200 篇模拟数据；错误时 CI 失败。

**验收**：增加、删除、改名（保留 id）均不用改 TypeScript；极简笔记与完整笔记均可正常派生 manifest。

### M2｜二维阅读、搜索、遥测 HUD 与路由（首版可用）

**任务**：实现首页终端遥测面板（Telemetry HUD 归档计数/待校准复习提醒）、独立目录页、Markdown Reader（含 `[EDIT]` 快捷跳转 GitHub/本地编辑器按钮）、TOC、公式/代码/图片、相关知识、搜索命令面板与 Hash 路由；加入移动布局和无障碍测试。

**验收**：即使完全关闭 Three.js，10 篇真实文章仍能浏览、检索和分享；链接刷新后仍能返回对应文章；空搜索、无结果、特殊字符均可正确处理。

### M3｜三维数据适配与状态点亮（保留原特色并强化正反馈）

**任务**：建立展示槽位与 EntryId 适配器，更新五列动态档案数组；对接新元数据与 `status` 状态视觉表现（`todo` 待解密虚影、`learning` 解析中琥珀色、`proficient` 实体点亮、`review` 需校准标识）；支持 `snippet` 微型速查卡在 3D 摘要面板直接完整预览；保留抽取/归位和返回；支持类别数量 0、1、8、40、200 以及快速连续操作。

**验收**：3D / 2D 选中同一条目得到完全一致的内容；不同 `status` 条目具有清晰视觉区分；新增第 41 条不报错；快速滚动不产生丢选、重复选中或内存持续增长。

### M4｜发布、视觉回归、交付（可公开版本）

**任务**：GitHub Actions、Pages 基址、Logo 与文案替换、版权与来源页、PWA 桌面独立窗口配置与缓存处理、性能优化与响应式打磨。

**验收**：Pages 地址可打开；支持浏览器一键安装为桌面 PWA 独立终端窗口；图片/模型/字体无 404；浏览器刷新、Hash 分享链接、PR 检查、发布失败回滚说明正常；README 含新增笔记步骤。

### M5｜后续可选增强（不阻塞发布）

收藏、最近阅读、深度知识图谱、离线缓存进阶优化、Cloudflare Pages 根路径加速镜像。每项都单独定义用户价值与验收标准，不一次性全部进入开发范围。

### 7.1 任务依赖

`M0 → M1 → M2 → M3 → M4` 是推荐顺序。M3 完成前可暂用二维索引作为正式入口；内容引擎与部署构建可在不同分支探索，但必须在 M4 合并之前统一基址和 PWA 资源方案。

## 8. 测试矩阵与验收门槛

| 编号 | 测试用例 | 预期结果 | 阶段 |
| --- | --- | --- | --- |
| T01 | 新增合法 `skill.md` 或极简无 Front Matter 笔记 | 无需改 UI 代码即可自动推导元数据并被索引、搜索、阅读 | M1/M2 |
| T02 | 重复 `id` 或 `slug` | 构建明确失败并显示冲突文件 | M1 |
| T03 | 内容中链接或就近 `./assets/` 图片失效 | CI 提示具体目标及源文件 | M1 |
| T04 | 中文、英文、大小写混合检索 | 返回合理排序结果，标题优先 | M2 |
| T05 | 文章含表格、代码、公式、图片 | 正确渲染，无法注入脚本 | M2 |
| T06 | 直接打开分享链接后刷新 | 同一文章正常呈现 | M2/M4 |
| T07 | 禁用 WebGL | 可经二维入口阅读全部文章 | M2 |
| T08 | 类别含 0、1、41、200 条及不同 `status` | 三维浏览不崩溃、不丢内容，状态点亮正确 | M3 |
| T09 | 快速翻档案与退出 | 不出现动画互锁/空指针/资源泄露 | M3 |
| T10 | 部署仓库子路径 | 图片、字体、GLB、脚本、PWA 无 404 | M4 |
| T11 | 360px 手机宽 + 键盘操作 | 无关键控件遮挡；焦点顺序合理 | M2/M4 |
| T12 | 公共仓库内容检查 | 无密钥、私人数据、侵权素材误传 | M4 |

**发布门槛**：P0 功能全部验收、构建与测试通过、真实手机检查、版权说明完备、GitHub Pages 真实 URL 逐项验证。不能仅凭 `tsc` / `vite build` 成功声明项目完成。

## 9. 主要风险与应对

| 风险 | 影响 | 对策 |
| --- | --- | --- |
| RhineLabUI 40 条、五列八条强耦合 | 一加文章就破坏阵列 | 先分离 EntryId 和可见槽位；增量测试 |
| 原项目单体 `main.ts` 复杂 | 大改容易回归 | 小 PR 渐进抽模块，保留现有动效测试 |
| Pages `base=/` 硬编码 | 发布后静态资源 404 | 使用统一 URL resolver，发布真机测试 |
| 内容 HTML/链接注入 | 公开站点安全问题 | 禁 raw HTML、解析安全白名单、测试非法 URL |
| GLB / 音频 / 大字体拖慢加载 | 快速查询体验差 | 动态加载、降级、资源预算、性能测试 |
| 浏览器本地状态不同步 | 收藏在不同设备不一致 | 明示限制；后续导入导出或同步方案 |
| 公开仓库误存私密/第三方资源 | 隐私与版权风险 | 入库前筛查，独立私有草稿空间，核对许可 |
| Agent 一次重写大项目 | 动画退化与不可回滚 | 里程碑式执行，每阶段有测试与人工验收 |

## 10. 项目维护规范

### 10.1 新增知识的三种轻量流程

1. **随手闪念 / 快速记（最常用，耗时 < 1 分钟）**：
   - 直接在 Obsidian / VS Code 中于 `content/<category>/`（或 `content/inbox/`）新建 `.md` 文件，或运行 `npm run new "标题"`；
   - 无需手填完整 Front Matter，直接写 `# 标题` 与几行命令/步骤，截图直接 `Ctrl+V` 粘贴到同级 `./assets/`；
   - 保存后提交 Git（或使用 Obsidian Git 插件一键自动同步）。
2. **AI Agent 辅助归档（对话即笔记）**：
   - 在与 AI Agent（Antigravity / Codex）排错或学习结束后，直接发送指令「将本次排错/技能归档至 ATLAS」，由 Agent 自动按模板生成文件、补充校验步骤并运行 `npm run check:content`。
3. **网页端微调修复（跨设备无环境时）**：
   - 浏览线上或本地阅读器时点击右上角 `[EDIT]`，直接跳转至 GitHub Web / `github.dev` 修改错别字或命令参数并 Commit，由 GitHub Actions 自动完成校验与重部署。

### 10.2 内容审核要求

- 未验证的操作标记为「待验证」，不得伪装成亲自测试结果。
- 有版本依赖的软件教程记录应用版本与文档更新日期。
- 引用外部资料保留原始 URL、作者/许可证（如适用）。
- 不公开患者或其他人的个人信息、私有实验数据、商业材料、API 密钥。
- 不把「已掌握」等学习状态当成客观能力证明；它仅为个人自评。

### 10.3 工程维护要求

- 保留原开源许可、署名、贡献说明，单独列出继续使用的第三方素材及其许可。
- 每个功能改动应更新相应测试、README 或开发文档。
- 自动生成文件和缓存目录进入 `.gitignore`，除非确有部署需要。
- 避免在项目启动时强制外部 API 访问；离线/慢网络要有降级。
- 新添复杂依赖需要在 PR 中说明收益、体积、维护成本及替代方案。

## 11. 推荐首批知识种子

首批建议建立 10 篇**确实有内容的知识文章**（可包含长教程与 `snippet` 微型速查卡），不要为填满视觉阵列生成空壳文本：

| ID / 题目 | 领域 | 类型 |
| --- | --- | --- |
| `tool-ppt-master` / PPT-Master 工作流 | tools | skill |
| `tool-aegisub` / Aegisub 字幕基础 | tools | skill |
| `tool-obsidian` / Obsidian 组织笔记 | tools | skill |
| `concept-markdown-basics` / Markdown 基本语法 | computing | concept |
| `skill-github-pages` / GitHub Pages 部署 | computing | skill |
| `skill-git-workflow` / 常用 Git 流程 | computing | snippet / skill |
| `skill-r-dataframe` / R 数据框操作 | computing | snippet / skill |
| `skill-molecular-docking` / 分子对接流程概览 | research | skill |
| `skill-cell-observation` / 细胞形态观察入门 | research | skill |
| `troubleshooting-vite-assets` / Vite 静态资源 404 排查 | computing | troubleshooting |

真实内容可在项目开发中逐篇填充；不要仅凭标题生成看似完整但未经验证的操作细节。

## 12. 交给 Codex 的执行协议

**角色**：在原 RhineLabUI 代码库基础上渐进实现 ATLAS，优先保证构建、内容可维护性与动画不回归。

**执行准则**：

1. 先读取本规划、上游 README/许可、`package.json`、`content/README.md`、`src/data.ts`、`src/main.ts`、`src/archive-loop.ts`、`src/scene.ts`、`vite.config.ts` 和内容校验测试；报告现状与对原文档的偏差。
2. 优先完成 M0，创建 baseline 检查，保存可复现结果；不得直接在未经授权的原作者仓库写入。
3. 每轮只实现当前里程碑，先提交任务拆分及待改文件清单；保持可编译和可回退。
4. 优先处理数据层与 Markdown，避免在内容管道完成前重写 3D 引擎。
5. 每个里程碑结束运行相关命令，回报运行环境、通过/失败项、已知问题与下一步；不得把未运行测试说成已通过。
6. 所有设计冲突以「可检索、可维护、跨设备阅读、版权与安全」优先，不以炫酷动画牺牲阅读体验。

### 12.1 可直接复制到 Codex 的首轮提示词

> 我正在开发 **ATLAS / Personal-Atlas**，一个基于 https://github.com/LBEILC/RhineLabUI 的个人知识档案网站，使用 GitHub Pages 托管。请首先完整阅读仓库中的 `ATLAS 个人知识库开发规划书.md`（若位于仓库根目录）以及原项目 README、LICENSE、package.json、content/README.md、src/data.ts、src/archive-loop.ts、src/scene.ts、src/main.ts、vite.config.ts、内容校验与 PWA 模块。先做仓库审查，不直接大规模修改。请输出：①当前功能与规划差异；②M0/M1 的细分任务和依赖；③风险和保留原有动画的措施；④需要新增/修改的文件清单与测试计划。随后从 M0 启动实施，保持每一阶段可运行、可回退、可验收。M0 验收后再进入 M1，严禁在内容模型未稳定时直接重写整个 3D 场景。不要伪称运行了未执行的测试，也不要加入未经确认的外部依赖或受限素材。

## 13. 后续决策清单（保留默认，不阻塞启动）

| 待决定事项 | 推荐默认 |
| --- | --- |
| 网站是否公开 | 是，但仓库仅含经确认可公开的知识 |
| 初期部署平台 | GitHub Pages（通过统一 `BASE_URL` 保持后续一键接入 Cloudflare Pages 的能力） |
| 本地使用形态 | 底层为 Git/Obsidian 文本库；交互层为 WebUI + 浏览器一键安装桌面 PWA 独立终端窗口 |
| 品牌 | ATLAS；不继续使用莱茵生命的官方标志 |
| 动态效果 | 首次轻量开场，可跳过；用户偏好持久化 |
| 首页形式 | 二维快速入口 + 终端遥测 HUD 为兜底，3D 为特色模式 |
| 主题 | 默认深色、可切浅色；阅读区不过暗 |
| 编辑入口 | Obsidian / VS Code / AI Agent 直接写 Markdown + 阅读器 `[EDIT]` 跳转 GitHub Web |
| 路由 | V1 Hash，后期按需要做 SSG |
| 图片管理 | 支持同级 `./assets/` 就近粘贴与 `public/media/<entry-id>/`，构建期统一转存与解析 base 路径 |
| 知识关联 | 明确的 `related` / `prerequisites` 引用，V2 扩大为关系图谱 |
| 本地状态 | `localStorage` 仅适用于浏览器，不承诺多端同步 |

## 14. 参考与核查来源

1. RhineLabUI 主仓库：<https://github.com/LBEILC/RhineLabUI>
2. README（技术栈、40 份档案、PWA、交互）：<https://github.com/LBEILC/RhineLabUI/blob/main/README.md>
3. 档案内容说明（五类各八份、纯文本与数据校验）：<https://github.com/LBEILC/RhineLabUI/blob/main/content/README.md>
4. 档案映射逻辑：<https://github.com/LBEILC/RhineLabUI/blob/main/src/data.ts>
5. 三维场景：<https://github.com/LBEILC/RhineLabUI/blob/main/src/scene.ts>
6. 构建配置：<https://github.com/LBEILC/RhineLabUI/blob/main/vite.config.ts>
7. MIT 许可证及第三方资产排除说明：<https://github.com/LBEILC/RhineLabUI/blob/main/LICENSE>
8. Vite 官方 GitHub Pages 部署说明：<https://vite.dev/guide/static-deploy.html>
9. GitHub Pages 自定义工作流说明：<https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages>

---

**结语**：ATLAS 第一阶段的成功标准不是复制一套华丽的莱茵生命界面，而是形成一个「新增一篇笔记就自动成为一份可检索、可阅读、可持续维护的知识档案」的稳定系统。视觉表现可逐步深化，知识资产的可靠性与可迁移性必须从第一天建立。
