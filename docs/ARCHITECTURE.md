# ATLAS 技术架构与基线核查报告（M0）

本文档记录 **ATLAS · Personal Knowledge Terminal** 在 M0 阶段对上游 `LBEILC/RhineLabUI`（基线提交 `12cc5e4`）的代码审查结果、现状与规划差异、模块迁移边界及开发约定。

---

## 1. 上游仓库现状与规划差异核查

| 维度 | 上游 `RhineLabUI` 现状 | `ATLAS` 规划目标 | 改造关键点（M1–M4） |
| --- | --- | --- | --- |
| **数据源与格式** | 单一 `content/archives.json`，纯文本字段（`abstract`、`findings[]`），不支持 Markdown、代码块、公式或内嵌图片 | `content/**/*.md`（支持极简 Front Matter 自动推导 + GFM Markdown + LaTeX 公式 + 同级 `./assets/` 图片） | M1 新增 `scripts/build-content.mjs` 与 `scripts/validate-content.mjs`，派生 `entries-manifest.json`、`search-index.json` 与 `telemetry.json` |
| **条目容量与分类约束** | `scripts/archive-content.mjs` 强校验固定 5 类、每类恰好 8 份、总计 40 份，ID 强制为 `X-001`～`X-040` | 初始 5 个一级门户（`tools`、`computing`、`research`、`academics`、`life`）+ `inbox` 草稿箱；每类支持 `0 / 1 / N` 篇无限增长；稳定语义化 `id` 与 `slug` | M1 解除 40 篇硬编码校验；M3 重构 `src/data.ts` 与 `src/archive-loop.ts`，将固定 3D 槽位池（virtual slots）与动态条目列表解耦 |
| **浏览与阅读体验** | 仅含 3D 阵列与右侧窄栏纯文本详情抽屉，无独立二维目录页或长文阅读器 | **双模式**：3D 档案大厅（支持 `status` 状态点亮与 `snippet` 微卡片直览） + 2D 知识索引（Library）与三栏式 Markdown 阅读器（Reader，含 30 秒快速复习区、TOC、代码复制、`[EDIT]` 快捷编辑按钮） | M2 实现独立二维目录、三栏阅读器、全文搜索面板与首页终端遥测 HUD |
| **路由与分享链接** | 仅支持调试查询参数（`?scene=archive`），无文章级永久路由，刷新回退到开场 | Hash 路由（如 `/#/entry/tools/ppt-master`、`/#/library`、`/#/archive`），支持刷新保持与别名重定向 | M2 引入轻量 Hash 路由器，与 3D 选中状态及 2D 阅读器双向同步 |
| **静态资源与部署基址** | `vite.config.ts` 默认 `base: "/"`，部分路径面向根域名部署 | 初期部署至 GitHub Pages（如 `/Personal-Atlas/` 子路径），同时兼容 Cloudflare Pages 根路径 | M4 统一通过环境变量/配置与 `assetUrl()` 解析所有模型、字体、音频、媒体及 PWA 缓存路径 |

---

## 2. M0 基线验证结果

- **运行环境**：
  - OS: Windows
  - Node.js: `v24.14.1`（满足 `>=22.12` 要求）
  - npm: `11.11.0`
- **远端安全隔离**：
  - `upstream` 指向 `https://github.com/LBEILC/RhineLabUI.git`
  - `upstream` 的 push URL 已显式设置为 `DISABLED`，确保不会误向原作者仓库推送任何更改。
- **基线命令验证**：
  - `npm ci`：成功（含 `postinstall` 自动修补 `@kitlangton/rolling-number`）
  - `npm run export:archives`：成功生成 40 份基线 TXT 档案
  - `npm run check:content`：18 项内容与转义测试全部通过
  - `npm run check:viewport`：视口布局检查通过
  - `node scripts/check-loop.mjs` & `node scripts/check-motion.mjs`：循环阵列与动效曲线检查全部通过
  - `npm run build`：`tsc`、`vite build` 与 `scripts/build-pwa.mjs` 全部通过

---

## 3. 开发约定与安全边界

1. **渐进式里程碑改造**：严格按照 `M0 → M1 → M2 → M3 → M4` 推进，在 M1（内容引擎）和 M2（二维阅读与路由）稳定前，不破坏 `src/scene.ts` 的既有三维渲染与动效。
2. **数据与渲染层隔离**：Three.js 场景组件禁止直接解析 Markdown 或访问文件系统，仅消费标准化元数据与 `EntryId`。
3. **无 WebGL 降级保障**：任何时候禁用 WebGL 或在移动端/低配设备上，用户均可通过二维界面（Home / Library / Reader / Search）完整访问所有知识条目。
4. **公开仓库隐私红线**：禁止提交任何 API Key、账号凭据、私人未脱敏数据或未获授权的商业受限资源。
