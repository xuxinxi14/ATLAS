---
id: troubleshooting-vite-assets
title: Vite 部署 GitHub Pages 静态资源與模型 404 排查
slug: computing/vite-assets-404
type: troubleshooting
category: computing
subcategory: frontend-build
tags: [Vite, GitHub Pages, 404, 静态资源, Three.js]
status: proficient
summary: 定位并修复 GitHub Pages 仓库子路径（/RepoName/）下硬编码根路径导致的 GLB 模型、图片与 Service Worker 404 错误。
created: 2026-10-05
updated: 2026-10-16
version_scope: "Vite 5 / 6 / 7"
source_urls:
  - https://vite.dev/guide/build.html#public-base-path
prerequisites:
  - skill-github-pages
related:
  - skill-git-workflow
aliases: []
---

# Vite 部署 GitHub Pages 静态资源与模型 404 排查

## 快速复习

1. **症状**：本地 `npm run dev` 一切正常，部署到 `https://<user>.github.io/<repo>/` 后页面空白，或 Three.js 的 `.glb` 模型、音频、图片报 `404 Not Found`。
2. **根因**：GitHub Pages 项目站点部署在子路径 `/<repo>/` 下，而代码中使用了以 `/` 开头的绝对根路径（如 `fetch('/assets/model.glb')`），浏览器会错误请求 `https://<user>.github.io/assets/model.glb`。
3. **三步根治**：
   - `vite.config.ts` 配置正确的 `base`（如 `/Personal-Atlas/`）；
   - 所有运行期动态资源统一经过 `assetUrl(path)` 拼接 `import.meta.env.BASE_URL`；
   - `index.html` 中的静态引用使用相对路径 `./favicon.svg` 或由 Vite 自动转换。

## 问题症状与环境

- **环境**：Vite + TypeScript + Three.js 静态站点，托管于 GitHub Pages 非根域名目录。
- **报错信息**：
  ```text
  GET https://xuxinxi14.github.io/assets/archive-cassette.glb 404 (Not Found)
  Failed to register a ServiceWorker: A bad HTTP response code (404) was received when fetching the script.
  ```

## 原因分析

1. `vite.config.ts` 中 `base` 默认是 `'/'`，构建产物 `dist/index.html` 引用的 JS/CSS 全部从域名根目录 `/assets/...` 查找。
2. 即使修改了 `vite.config.ts` 的 `base`，TypeScript 代码中传给 `GLTFLoader.load('/assets/xxx.glb')` 或 `new Audio('/audio/xxx.ogg')` 的字符串字面量不会被 Vite 自动重写。

## 修复步骤

### 1. 让 `vite.config.ts` 支持可配置基址

```ts
// vite.config.ts
const rawBase = process.env.ATLAS_BASE || "/";
const normalizedBase = rawBase.endsWith("/") ? rawBase : `${rawBase}/`;

export default defineConfig({
  base: normalizedBase,
});
```

### 2. 统一使用 `assetUrl` 解析器

```ts
// src/asset-url.ts
export const assetUrl = (path: string) => {
  const clean = path.replace(/^\.?\//, "");
  return `${import.meta.env.BASE_URL}${clean}`;
};
```

### 3. 本地模拟子路径回归验证

无需每次推上 GitHub 才能发现问题，直接在本地使用环境变量构建并预览：

```bash
# Windows PowerShell 本地模拟子路径构建
$env:ATLAS_BASE="/Personal-Atlas/"; npm run build; npx vite preview --base /Personal-Atlas/
```

## 修复验证

- 打开浏览器开发者工具 **Network** 面板，勾选 `Disable cache` 并刷新页面；
- 确认所有 `.js`、`.css`、`.woff2`、`.glb`、`entries-manifest` 请求的状态码均为 `200`，且 URL 均带有正确的基址前缀。
