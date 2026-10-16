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
