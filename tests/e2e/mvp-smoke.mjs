import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { renderTelemetryHomeMarkup } from "../../src/app/telemetry-view.ts";
import { renderLibraryViewMarkup } from "../../src/library/library-view.ts";
import { renderReaderViewMarkup } from "../../src/reader/reader-view.ts";
import { evaluateOpticalReaderTimeline } from "../../src/optical-reader-rig.ts";
import {
  renderStudioViewMarkup,
  createDefaultStudioDraft,
} from "../../src/studio/studio-view.ts";
import { parseHashRoute, buildStudioHash } from "../../src/app/router.ts";
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

  // 4. Verify WebUI Archive Studio (#/studio) and studio routes
  const studioRouteNew = parseHashRoute("#/studio");
  assert.equal(studioRouteNew?.view, "studio", "#/studio parses to studio view");
  const studioRouteEdit = parseHashRoute(buildStudioHash("skills/ppt-master"));
  assert.equal(studioRouteEdit?.view, "studio", "#/studio/<slug> parses to studio view");
  assert.equal(studioRouteEdit?.slug, "skills/ppt-master", "#/studio/<slug> extracts slug");

  const studioHtml = renderStudioViewMarkup(createDefaultStudioDraft("skills"));
  assert.ok(studioHtml.includes("ARCHIVE STUDIO"), "Studio header renders");
  assert.ok(studioHtml.includes("PASTE AI NOTE"), "AI Note importer button renders");
  assert.ok(studioHtml.includes("SAVE TO DISK"), "Save to disk button renders");

  // 5. Verify 3D columns and dist/ artifacts
  assert.equal(
    records.length,
    knowledgeRepository.all(false).length,
    "All published entries appear in 3D archive array",
  );
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

test("Optical Reader 6-stage timeline and 9-point reading surface subtraction", () => {
  // Stage 0 (0ms): idle
  const f0 = evaluateOpticalReaderTimeline(0, false);
  assert.equal(f0.takeover, 0);
  assert.equal(f0.verticalLift, 0);
  assert.equal(f0.lateralInsert, 0);
  assert.equal(f0.progress, 0);

  // Stage 1 & 2 (500ms): vertical extraction in progress, lateral insertion has not started yet
  const f500 = evaluateOpticalReaderTimeline(0.5, false);
  assert.equal(f500.takeover, 1, "Takeover completes by 220ms");
  assert.ok(f500.verticalLift > 0.5, "Vertical lift active at 500ms");
  assert.equal(
    f500.lateralInsert,
    0,
    "Lateral insertion strictly waits for vertical clearance (<1000ms)",
  );

  // Stage 3 & 4 (1300ms): vertical lift complete, rig docked, cassette inserting laterally
  const f1300 = evaluateOpticalReaderTimeline(1.3, false);
  assert.equal(f1300.verticalLift, 1, "Vertical clearance reached by 700ms");
  assert.equal(f1300.rigDock, 1, "Optical Reader rig docked by 1100ms");
  assert.ok(
    f1300.lateralInsert > 0.3 && f1300.lateralInsert < 1,
    "Cassette sliding into side slot between 1000ms and 1560ms",
  );

  // Stage 5 (1650ms): contact glow, amber sweep, and warm-white screen activation
  const f1650 = evaluateOpticalReaderTimeline(1.65, false);
  assert.equal(f1650.lateralInsert, 1, "Cassette seated by 1560ms");
  assert.ok(f1650.contactGlow > 0.8, "Amber contact points illuminated");
  assert.ok(f1650.amberSweep > 0.2 && f1650.amberSweep < 0.9, "Amber sweep in progress");
  assert.equal(f1650.activationReady, true, "Electronic confirmation sound triggered");

  // Stage 6 (2250ms): settled reading state
  const f2250 = evaluateOpticalReaderTimeline(2.25, false);
  assert.equal(f2250.screenActive, 1);
  assert.equal(f2250.cameraPush, 1);
  assert.equal(f2250.titleReveal, 1);
  assert.equal(f2250.bodyReveal, 1);
  assert.equal(f2250.progress, 1);

  // Reduced motion: immediate fade without 3D choreography burden
  const fReduced = evaluateOpticalReaderTimeline(0.18, true);
  assert.equal(fReduced.progress, 1);
  assert.equal(fReduced.bodyReveal, 1);

  // Verify Optical Reader DOM surface implements the 9-point subtraction spec
  const readerHtml = renderReaderViewMarkup("tools/aegisub", new Set(), true);
  assert.ok(readerHtml.includes("OPTICAL READER"), "Stage signature renders");
  assert.ok(readerHtml.includes("LINK ESTABLISHED"), "Link status footbar renders");
  assert.ok(readerHtml.includes("档案大厅"), "Return to Archive Hall action renders");
  assert.ok(readerHtml.includes('data-optical-toggle="toc"'), "Collapsible TOC toggle renders");
  assert.ok(readerHtml.includes('data-optical-toggle="more"'), "More menu toggle renders");
  assert.ok(readerHtml.includes('id="optical-archive-dossier"'), "Merged metadata dossier renders");
});
