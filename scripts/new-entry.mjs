import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const VALID_PORTALS = new Set([
  "inbox",
  "tools",
  "computing",
  "research",
  "academics",
  "life",
]);

function toSlugPart(text) {
  return (
    text
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
      .replace(/^-+|-+$/g, "") || `note-${Date.now().toString(36)}`
  );
}

const args = process.argv.slice(2).filter((a) => a !== "--");
if (args.length === 0) {
  console.log(`用法：
  1. 极简闪念（自动放入 content/inbox/）：
     npm run new "笔记标题"
  2. 指定分类新建（tools | computing | research | academics | life）：
     npm run new tools "Aegisub 快捷键技巧"
  3. 指定分类与完整模板（加 --full）：
     npm run new research "Western Blot 转膜步骤" --full`);
  process.exit(0);
}

const isFull = args.includes("--full");
const cleanArgs = args.filter((a) => a !== "--full");

let category = "inbox";
let title = cleanArgs[0];
if (cleanArgs.length >= 2 && VALID_PORTALS.has(cleanArgs[0])) {
  category = cleanArgs[0];
  title = cleanArgs.slice(1).join(" ");
}

const today = new Date().toISOString().slice(0, 10);
const fileSlug = toSlugPart(title);
const targetDir = path.resolve("content", category);
const targetFile = path.join(targetDir, `${fileSlug}.md`);

if (existsSync(targetFile)) {
  console.error(`文件已存在：${targetFile}`);
  process.exit(1);
}

await fs.mkdir(targetDir, { recursive: true });
await fs.mkdir(path.join(targetDir, "assets"), { recursive: true });

const content = isFull
  ? `---
id: ${category}-${fileSlug}
title: ${title}
slug: ${category}/${fileSlug}
type: skill
category: ${category}
tags: []
status: ${category === "inbox" ? "draft" : "learning"}
summary: 在此填写一句话摘要。
created: ${today}
updated: ${today}
---

# ${title}

## 快速复习

- 在此记录 1～3 条最关键的操作或结论。

## 操作步骤

1. 第一步

## 验证结果

- 如何确认操作成功
`
  : `# ${title}

## 快速复习

- 在此随手记录关键命令、步骤或截图（可直接粘贴至 \`./assets/\`）。
`;

await fs.writeFile(targetFile, content, "utf8");
console.log(`[ATLAS] 已创建新笔记：content/${category}/${fileSlug}.md`);
