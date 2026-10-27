import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { renderTelemetryHomeMarkup } from "../../src/app/telemetry-view.ts";
import { renderLibraryViewMarkup } from "../../src/library/library-view.ts";
import { renderReaderViewMarkup } from "../../src/reader/reader-view.ts";
import { evaluateOpticalReaderTimeline } from "../../src/optical-reader-rig.ts";
import { evaluateIndexDeskTimeline } from "../../src/index-desk-rig.ts";
import { evaluateStudioTrayTimeline } from "../../src/studio-tray-rig.ts";
import {
  renderStudioViewMarkup,
  createDefaultStudioDraft,
  snapshotStudioDraft,
  applyStudioDraftSnapshot,
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

test("Glass Index Desk (检索桥) layout & 1.25s bidirectional transition timeline", () => {
  // 01 检索 (0.00s): settled in 2D Glass Index Desk
  const d0 = evaluateIndexDeskTimeline(0, false);
  assert.equal(d0.deskPresence, 1);
  assert.equal(d0.directoryOpacity, 1);
  assert.equal(d0.deskRetreat, 0);
  assert.equal(d0.cameraBridgeMix, 1);

  // 02 台面退让 (0.35s): directory text faded out, selected anchor remains on retreating glass
  const d350 = evaluateIndexDeskTimeline(0.35, false);
  assert.equal(d350.responseAck, 1, "Response ack completed by 160ms");
  assert.equal(d350.directoryOpacity, 0, "Directory text faded out by 340ms");
  assert.equal(
    d350.selectedAnchorOpacity,
    1,
    "Selected code & title anchor stays visible at 350ms",
  );
  assert.ok(
    d350.deskRetreat > 0.15 && d350.deskRetreat < 0.85,
    "Desk is lifting & retreating along side guide rails at 350ms",
  );

  // 03 镜头入轨 (0.80s): desk retreated, camera diving through clearance beneath front lip
  const d800 = evaluateIndexDeskTimeline(0.8, false);
  assert.equal(d800.deskRetreat, 1, "Desk retreat completed by 650ms");
  assert.equal(d800.selectedAnchorOpacity, 0, "Anchor faded by 640ms");
  assert.ok(
    d800.cameraDive > 0.4 && d800.cameraDive < 0.9,
    "Camera gliding into 3D lane at 800ms",
  );

  // 04 档案室接管 (1.25s): settled in 3D Archive Hall
  const d1250 = evaluateIndexDeskTimeline(1.25, false);
  assert.equal(d1250.deskPresence, 0);
  assert.equal(d1250.cameraDive, 1);
  assert.equal(d1250.hudHandover, 1);

  // Verify Glass Index Desk DOM structure
  const deskHtml = renderLibraryViewMarkup(
    {
      category: "tools",
      type: "all",
      status: "all",
      query: "",
      sortBy: "updated",
      layout: "list",
      selectedId: "tool-aegisub",
      unfiltered3DNoticeId: "code-python-AsyncIO",
    },
    new Set(["tool-aegisub"]),
    true,
  );
  assert.ok(deskHtml.includes("ATLAS / LIBRARY"), "Desk top kicker renders");
  assert.ok(deskHtml.includes("知识索引"), "Desk main title renders");
  assert.ok(deskHtml.includes("软件与工具"), "Left domain column renders");
  assert.ok(deskHtml.includes("草稿箱"), "Draft box separated in left column");
  assert.ok(deskHtml.includes("直接阅读"), "Secondary action renders in context bar");
  assert.ok(deskHtml.includes("进入三维档案室 ↗"), "Primary 3D bridge action renders");
  assert.ok(deskHtml.includes("ARCHIVE ARRAY"), "Under-desk 3D array window label renders");
});

test("Sliding Studio Tray (录入工作台) layout & dual-source transition timelines (1.30s 2D / 1.80s 3D)", () => {
  // 1. 1.30s Transition from 2D Glass Index Desk (source = "library")
  const s0 = evaluateStudioTrayTimeline(0, "library", false);
  assert.equal(s0.duration, 1.3);
  assert.equal(s0.traySlide, 0);
  assert.equal(s0.cassetteDock, 0);

  // 02 托盘展开 (0.35s): index bridge retreating, studio tray sliding forward, vertical clearance active
  const s350 = evaluateStudioTrayTimeline(0.35, "library", false);
  assert.equal(s350.responseAck, 1, "Response ack completed by 160ms");
  assert.ok(
    s350.indexBridgeRetreat > 0.8,
    "Glass Index Bridge retreating at 350ms",
  );
  assert.ok(
    s350.traySlide > 0.03 && s350.traySlide < 0.5,
    "Sliding Studio Tray extending along side rails at 350ms",
  );
  assert.ok(
    s350.verticalClearance > 0.3,
    "Cassette rising vertically for clearance at 350ms",
  );

  // 03 档案停靠 (0.85s): cassette docking into left bay, tray fully extended
  const s850 = evaluateStudioTrayTimeline(0.85, "library", false);
  assert.equal(s850.traySlide, 1, "Tray fully extended by 800ms");
  assert.equal(s850.verticalClearance, 1, "Cassette vertical clearance complete");
  assert.ok(
    s850.cassetteTransfer > 0.6 && s850.cassetteDock > 0.25,
    "Cassette transferring and docking into left bay at 850ms",
  );

  // 04 编辑接管 (1.30s): near-orthographic camera settled, writing surface ready
  const s1300 = evaluateStudioTrayTimeline(1.3, "library", false);
  assert.equal(s1300.cassetteDock, 1);
  assert.equal(s1300.contactGlow, 1);
  assert.equal(s1300.editorReveal, 1);
  assert.equal(s1300.cameraFrame, 1);
  assert.equal(s1300.progress, 1);
  assert.equal(s1300.settled, true);

  // 2. 1.80s Transition from 3D Archive Hall (source = "archive")
  const a500 = evaluateStudioTrayTimeline(0.5, "archive", false);
  assert.equal(a500.duration, 1.8);
  assert.ok(
    a500.verticalClearance > 0.8,
    "Cassette rising vertically for clearance at 500ms",
  );
  assert.equal(
    a500.cassetteTransfer,
    0,
    "Cassette strictly waits for vertical clearance before lateral transfer (<540ms)",
  );

  const a1150 = evaluateStudioTrayTimeline(1.15, "archive", false);
  assert.equal(a1150.verticalClearance, 1, "Vertical clearance reached by 600ms");
  assert.ok(
    a1150.cassetteTransfer > 0.7 && a1150.cassetteDock > 0.25,
    "Cassette turning and docking into left bay at 1150ms",
  );

  const a1800 = evaluateStudioTrayTimeline(1.8, "archive", false);
  assert.equal(a1800.cassetteDock, 1);
  assert.equal(a1800.editorReveal, 1);
  assert.equal(a1800.cameraFrame, 1);
  assert.equal(a1800.settled, true);

  // 3. Verify Sliding Studio Tray DOM structure & state snapshot isolation
  const newDraft = createDefaultStudioDraft("tools", "library");
  const newHtml = renderStudioViewMarkup(newDraft, true);
  assert.ok(newHtml.includes("ATLAS / STUDIO"), "Top bar studio kicker renders");
  assert.ok(newHtml.includes("返回索引"), "Dynamic return label reflects library origin");
  assert.ok(newHtml.includes("保存并归档"), "Primary save button renders");
  assert.ok(newHtml.includes('id="studio-dock-code">NEW<'), "New draft displays NEW on dock without pre-allocating fake number");
  assert.ok(newHtml.includes("更多信息"), "More info drawer trigger renders");
  assert.ok(newHtml.includes("插入结构"), "Single insert structure menu trigger renders");
  assert.ok(newHtml.includes("AI 导入"), "AI import drawer trigger renders");

  // Existing archive from 3D hall with dirty state & AI conflict candidate
  const editDraft = createDefaultStudioDraft("tools", "archive");
  editDraft.isNew = false;
  editDraft.originalSlug = "tools/aegisub";
  editDraft.lockedCode = "T-001";
  editDraft.title = "Aegisub 字幕时间轴与样式基础";
  editDraft.dirty = true;
  editDraft.aiPasteOpen = true;
  editDraft.aiPendingCandidate = {
    title: "FFmpeg 常用转码与抽帧速查",
    category: "tools",
    fileSlug: "ffmpeg-cli",
    subcategory: "video",
    type: "skill",
    status: "learning",
    tags: "ffmpeg, video",
    summary: "FFmpeg 无损重封装与字幕烧录命令。",
    version_scope: "FFmpeg 7.0",
    source_urls: "",
    body: "## 快速复习\n- 核心命令",
    previewHtml: "<h2>快速复习</h2>",
  };
  const editHtml = renderStudioViewMarkup(editDraft, true);
  assert.ok(editHtml.includes("返回档案室"), "Dynamic return label reflects archive hall origin");
  assert.ok(editHtml.includes('id="studio-dock-code">T-001<'), "Locked code T-001 renders on left cassette dock");
  assert.ok(editHtml.includes("未保存"), "Dirty state pill renders");
  assert.ok(editHtml.includes("插入到正文末尾"), "AI conflict append button renders");
  assert.ok(editHtml.includes("替换当前草稿"), "AI conflict replace button renders");

  // Verify snapshot & restore helper
  const snap = snapshotStudioDraft(editDraft);
  const restored = createDefaultStudioDraft("coding", "reader");
  applyStudioDraftSnapshot(restored, snap);
  assert.equal(restored.lockedCode, "T-001");
  assert.equal(restored.title, "Aegisub 字幕时间轴与样式基础");
  assert.equal(restored.dirty, true);
});
