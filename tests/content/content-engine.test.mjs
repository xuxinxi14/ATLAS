import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import {
  buildKnowledgeBase,
  parseFrontMatter,
  renderMarkdownDocument,
} from "../../scripts/content-engine.mjs";

const categoriesPath = path.resolve("content/categories.json");

test("Markdown parsing always advances past tags, deep headings, and malformed fences", () => {
  const result = renderMarkdownDocument("#tag\n\n##### 五级标题\n\n###### 六级标题\n\n```invalid language with spaces\n接下来的正文\n");
  assert.match(result.html, /#tag/);
  assert.match(result.html, /<h5[^>]*>.*五级标题<\/h5>/);
  assert.match(result.html, /<h6[^>]*>.*六级标题<\/h6>/);
  assert.match(result.html, /invalid language with spaces/);
  assert.match(result.html, /接下来的正文/);
});

test("Obsidian links and inline emphasis remain readable after publishing", () => {
  const rendered = renderMarkdownDocument("[[Reference#Section|显示名称]]、[[missing]]、~~删除~~、==重点==", {
    resolveWiki: (target) => target === "Reference#Section"
      ? { href: "#/entry/tools/reference#section", entrySlug: "tools/reference" }
      : undefined,
  });
  assert.match(rendered.html, /href="#\/entry\/tools\/reference#section"[^>]*>显示名称<\/a>/);
  assert.match(rendered.html, /class="atlas-unresolved-link">missing<\/span>/);
  assert.match(rendered.html, /<del>删除<\/del>/);
  assert.match(rendered.html, /<mark>重点<\/mark>/);
});

test("nested ordered, unordered, and task lists keep their hierarchy", () => {
  const rendered = renderMarkdownDocument("- parent\n  - child\n    2. numbered\n- [ ] task\n+ sibling");
  assert.match(rendered.html, /<li>parent<ul class="atlas-list"><li>child<ol class="atlas-list" start="2"><li>numbered<\/li><\/ol><\/li><\/ul><\/li>/);
  assert.match(rendered.html, /class="atlas-task-item"/);
  assert.match(rendered.html, /<li>sibling<\/li><\/ul>/);
});

test("front matter round-trips quoted commas, quotes, and backslashes", () => {
  const parsed = parseFrontMatter('---\ntitle: "带 \\\"引号\\\" 的笔记"\ntags: ["one,two", "simple"]\nversion_scope: "C:\\\\Work"\n---\n正文');
  assert.equal(parsed.data.title, '带 "引号" 的笔记');
  assert.deepEqual(parsed.data.tags, ["one,two", "simple"]);
  assert.equal(parsed.data.version_scope, "C:\\Work");
});

async function makeTempContent(filesMap) {
  const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "atlas-test-"));
  const contentDir = path.join(tmpRoot, "content");
  const publicDir = path.join(tmpRoot, "public");
  await fs.mkdir(contentDir, { recursive: true });
  await fs.mkdir(publicDir, { recursive: true });
  await fs.copyFile(categoriesPath, path.join(contentDir, "categories.json"));

  for (const [relPath, fileContent] of Object.entries(filesMap)) {
    const fullPath = path.join(contentDir, relPath);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, fileContent, "utf8");
  }
  return {
    tmpRoot,
    contentDir,
    publicDir,
    cleanup: () => fs.rm(tmpRoot, { recursive: true, force: true }),
  };
}

test("published wiki links resolve titles, headings and unresolved notes without failing the build", async () => {
  const env = await makeTempContent({
    "tools/reference.md": "---\ntitle: 参考笔记\nslug: tools/reference\n---\n# 参考笔记\n\n## 更多内容\n正文。",
    "tools/links.md": "---\ntitle: 链接测试\nslug: tools/links\n---\n# 链接测试\n\n[[参考笔记#更多内容|跳转]]、[[暂不存在]]。",
  });
  try {
    const result = await buildKnowledgeBase({ repoRoot: env.tmpRoot, contentDir: env.contentDir, publicDir: env.publicDir, copyAssets: false });
    const html = result.entries.find((entry) => entry.slug === "tools/links").html;
    assert.match(html, /href="#\/entry\/tools\/reference#%E6%9B%B4%E5%A4%9A%E5%86%85%E5%AE%B9"/);
    assert.match(html, /class="atlas-unresolved-link">暂不存在<\/span>/);
    assert.match(result.entries.find((entry) => entry.slug === "tools/links").markdown, /\[\[参考笔记#更多内容\|跳转\]\]/);
  } finally {
    await env.cleanup();
  }
});

test("real repository content validates, resolves co-located assets, and infers zero-front-matter notes", async () => {
  const result = await buildKnowledgeBase({
    repoRoot: path.resolve("."),
    copyAssets: false,
  });
  assert.ok(result.entries.length >= 12);
  assert.equal(result.portals.length, 5);

  // Verify zero-front-matter note in life/video-export-presets.md
  const zeroFm = result.entries.find(
    (e) => e.slug === "life/video-export-presets",
  );
  assert.ok(zeroFm, "should infer life/video-export-presets.md");
  assert.equal(zeroFm.id, "life-video-export-presets");
  assert.equal(zeroFm.category, "life");
  assert.equal(zeroFm.title, "视频导出与压制常用 H.264 / AAC 参数速查");
  assert.equal(zeroFm.autoInferred, true);
  assert.ok(zeroFm.quickstartHtml.includes("ffmpeg"));

  // Verify co-located image in tools/aegisub.md
  const aegisub = result.entries.find((e) => e.id === "tool-aegisub");
  assert.ok(aegisub);
  assert.deepEqual(aegisub.images, [
    "media/entries/tool-aegisub/aegisub-timeline.svg",
  ]);

  // Verify inbox draft status auto-inference
  const draft = result.entries.find((e) => e.category === "inbox");
  assert.ok(draft);
  assert.equal(draft.status, "draft");

  // Verify review queue detection
  assert.ok(
    result.telemetry.reviewQueue.some(
      (r) => r.id === "skill-molecular-docking",
    ),
  );
});

test("rejects empty content directory", async () => {
  const env = await makeTempContent({});
  try {
    await assert.rejects(
      () =>
        buildKnowledgeBase({
          repoRoot: env.tmpRoot,
          contentDir: env.contentDir,
          publicDir: env.publicDir,
        }),
      /content 目录为空/,
    );
  } finally {
    await env.cleanup();
  }
});

test("rejects duplicate id and duplicate slug across files", async () => {
  const env = await makeTempContent({
    "tools/a.md": `---\nid: same-id\ntitle: A\nslug: tools/same\n---\n# A\nText`,
    "computing/b.md": `---\nid: same-id\ntitle: B\nslug: tools/same\n---\n# B\nText`,
  });
  try {
    await assert.rejects(
      () =>
        buildKnowledgeBase({
          repoRoot: env.tmpRoot,
          contentDir: env.contentDir,
          publicDir: env.publicDir,
        }),
      /重复的 id "same-id"[\s\S]*重复的 slug "tools\/same"/,
    );
  } finally {
    await env.cleanup();
  }
});

test("rejects invalid calendar dates, unknown types, and unknown categories", async () => {
  const env = await makeTempContent({
    "tools/bad.md": `---
id: bad-entry
title: Bad Entry
category: unknown-cat
type: magic
created: 2026-02-30
updated: not-a-date
---
# Bad Entry
Body text`,
  });
  try {
    await assert.rejects(
      () =>
        buildKnowledgeBase({
          repoRoot: env.tmpRoot,
          contentDir: env.contentDir,
          publicDir: env.publicDir,
        }),
      /未知分类[\s\S]*未知知识类型[\s\S]*日期 "2026-02-30" 无效/,
    );
  } finally {
    await env.cleanup();
  }
});

test("rejects missing co-located image and non-existent related/prerequisite IDs", async () => {
  const env = await makeTempContent({
    "tools/broken.md": `---
id: tool-broken
title: Broken Links
prerequisites: [missing-prereq-id]
related: [missing-related-id]
---
# Broken Links

![Missing Image](./assets/does-not-exist.png)
`,
  });
  try {
    await assert.rejects(
      () =>
        buildKnowledgeBase({
          repoRoot: env.tmpRoot,
          contentDir: env.contentDir,
          publicDir: env.publicDir,
        }),
      /missing-prereq-id[\s\S]*missing-related-id[\s\S]*引用的图片文件不存在/,
    );
  } finally {
    await env.cleanup();
  }
});

test("supports Chinese filenames and sanitizes raw HTML script injection", async () => {
  const env = await makeTempContent({
    "research/细胞冻存操作速查.md": `# 细胞冻存标准配比

<script>window.pwned = true;</script>
<img src="x" onerror="alert(1)" />

冻存液配比：90% FBS + 10% DMSO，现配现用。
`,
  });
  try {
    const res = await buildKnowledgeBase({
      repoRoot: env.tmpRoot,
      contentDir: env.contentDir,
      publicDir: env.publicDir,
    });
    assert.equal(res.entries.length, 1);
    const entry = res.entries[0];
    assert.equal(entry.slug, "research/细胞冻存操作速查");
    assert.equal(entry.title, "细胞冻存标准配比");
    assert.ok(!entry.html.includes("<script>"));
    assert.ok(entry.html.includes("&lt;script&gt;"));
  } finally {
    await env.cleanup();
  }
});

test("scales cleanly to 200 simulated Markdown entries across all portals", async () => {
  const files = {};
  const portalIds = ["tools", "computing", "research", "academics", "life"];
  for (let i = 1; i <= 200; i++) {
    const cat = portalIds[(i - 1) % portalIds.length];
    files[`${cat}/sim-entry-${i}.md`] = `---
id: sim-${i}
title: 模拟知识档案 ${i}
tags: [测试, 批量-${cat}]
status: ${i % 4 === 0 ? "todo" : i % 3 === 0 ? "learning" : "proficient"}
---
# 模拟知识档案 ${i}

## 快速复习
这是第 ${i} 篇模拟文档的快速复习要点。
`;
  }
  const env = await makeTempContent(files);
  try {
    const res = await buildKnowledgeBase({
      repoRoot: env.tmpRoot,
      contentDir: env.contentDir,
      publicDir: env.publicDir,
    });
    assert.equal(res.entries.length, 200);
    assert.equal(res.searchIndex.length, 200);
    for (const stat of res.telemetry.portalStats) {
      assert.equal(stat.total, 40);
    }
  } finally {
    await env.cleanup();
  }
});
