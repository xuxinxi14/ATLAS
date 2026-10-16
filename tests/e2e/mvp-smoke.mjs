import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { renderTelemetryHomeMarkup } from "../../src/app/telemetry-view.ts";
import { renderLibraryViewMarkup } from "../../src/library/library-view.ts";
import { renderReaderViewMarkup } from "../../src/reader/reader-view.ts";
import { knowledgeRepository } from "../../src/knowledge/repository.ts";
import { records, columnFiles } from "../../src/data.ts";

test("MVP E2E: telemetry home, 2D library, and 3-column reader render valid HTML for all 15 entries", () => {
  // 1. Telemetry Home
  const homeHtml = renderTelemetryHomeMarkup(true);
  assert.ok(homeHtml.includes("SYSTEM TELEMETRY"), "Telemetry HUD header renders");
  assert.ok(homeHtml.includes("待校准与温习提醒"), "Review queue renders");
  assert.ok(homeHtml.includes("AutoDock Vina"), "Review entry appears in review queue");
  assert.ok(homeHtml.includes("五大知识领域门户"), "5 knowledge portals render");

  const fallbackHomeHtml = renderTelemetryHomeMarkup(false);
  assert.ok(
    fallbackHomeHtml.includes("当前环境未启用 WebGL"),
    "WebGL fallback message renders when hasWebGL=false",
  );

  // 2. 2D Library View (All + Inbox + Filters)
  const libAllHtml = renderLibraryViewMarkup(
    {
      category: "all",
      type: "all",
      status: "all",
      query: "",
      sortBy: "updated",
      layout: "grid",
    },
    new Set(["X-001"]),
    true,
  );
  assert.ok(libAllHtml.includes("二维知识索引目录"), "Library header renders");
  assert.ok(libAllHtml.includes("Aegisub 字幕时间轴与样式基础"), "Aegisub card renders");
  assert.ok(libAllHtml.includes("★ 已收藏"), "Saved state reflects on card");

  const libInboxHtml = renderLibraryViewMarkup(
    {
      category: "inbox",
      type: "all",
      status: "all",
      query: "",
      sortBy: "updated",
      layout: "list",
    },
    new Set(),
    true,
  );
  assert.ok(
    libInboxHtml.includes("Windows 端口被占用（EADDRINUSE）快速定位与释放"),
    "Inbox draft entry renders in inbox tab",
  );

  // 3. 3-Column Markdown Reader for every single entry (including co-located image, math, zero-front-matter)
  for (const entry of knowledgeRepository.all(true)) {
    const readerHtml = renderReaderViewMarkup(entry.slug, new Set(), true);
    assert.ok(
      readerHtml.includes(`<h1>${entry.title}</h1>`),
      `Reader renders H1 for ${entry.slug}`,
    );
    assert.ok(
      readerHtml.includes("atlas-reader-sidebar-left"),
      `Left tree renders for ${entry.slug}`,
    );
    assert.ok(
      readerHtml.includes("atlas-reader-sidebar-right"),
      `Right TOC/relations sidebar renders for ${entry.slug}`,
    );
  }

  // Verify co-located SVG image in tools/aegisub
  const aegisubHtml = renderReaderViewMarkup("tools/aegisub", new Set(), true);
  assert.ok(
    aegisubHtml.includes("media/entries/tool-aegisub/aegisub-timeline.svg"),
    "Co-located image path is rewritten and hydrated in reader view",
  );

  // Verify LaTeX math in academics/enzyme-kinetics
  const enzymeHtml = renderReaderViewMarkup("academics/enzyme-kinetics", new Set(), true);
  assert.ok(
    enzymeHtml.includes("atlas-math-block"),
    "LaTeX display math block renders in reader view",
  );

  // Verify zero-Front-Matter inferred entry in life/video-export-presets
  const zeroFmHtml = renderReaderViewMarkup("life/video-export-presets", new Set(), true);
  assert.ok(
    zeroFmHtml.includes("AUTO-INFERRED"),
    "Zero-Front-Matter entry displays AUTO-INFERRED badge",
  );

  // 4. Verify 3D columns and dist/ artifacts
  assert.equal(records.length, 14, "14 published entries in 3D archive array");
  for (let lane = 0; lane < 5; lane++) {
    assert.ok(columnFiles(lane).length >= 2, `Column ${lane} has entries`);
  }

  const distIndex = resolve("dist/index.html");
  if (existsSync(distIndex)) {
    const html = readFileSync(distIndex, "utf8");
    assert.ok(html.includes("ATLAS · PERSONAL KNOWLEDGE TERMINAL"));
    assert.ok(
      existsSync(resolve("dist/media/entries/tool-aegisub/aegisub-timeline.svg")),
      "Co-located asset is copied into dist/media/entries/tool-aegisub/",
    );
    assert.ok(
      existsSync(resolve("dist/search-index.json")),
      "search-index.json is bundled in dist/",
    );
  }
});
