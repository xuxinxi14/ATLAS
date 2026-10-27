import assert from "node:assert/strict";
import test from "node:test";
import {
  HomeTransitClock,
  evaluateHomeTransit,
} from "../../src/home-transit.ts";
import { evaluateStudioTrayTimeline } from "../../src/studio-tray-rig.ts";
import {
  createDefaultStudioDraft,
  renderStudioViewMarkup,
  renderStudioSaveStatusMarkup,
  ATLAS_AI_ARCHIVE_PROMPT,
} from "../../src/studio/studio-view.ts";
import { knowledgeRepository } from "../../src/knowledge/repository.ts";
import { renderReaderViewMarkup } from "../../src/reader/reader-view.ts";
import { buildLibraryHash, parseHashRoute } from "../../src/app/router.ts";

test("home transfer keeps the glass clear before the camera enters the archive", () => {
  for (let i = 0; i <= 200; i++) {
    const f = evaluateHomeTransit(i / 200, "archive");
    if (f.cameraMix < 1) assert.equal(f.retreat, 1);
    for (const value of Object.values(f)) assert.ok(value >= 0 && value <= 1);
  }
});

test("reversing or retargeting an unfinished transfer preserves the sampled pose", () => {
  const clock = new HomeTransitClock();
  clock.navigate("archive", "home", 1000, false, false);
  clock.navigate("home", "archive", 1000, true, false);
  const before = clock.update(1450);
  assert.ok(clock.active);
  clock.navigate("archive", "home", 1450, true, false);
  assert.deepEqual(clock.update(1450), before);
  const reversed = clock.update(1550);
  assert.ok(reversed.progress < before.progress);
  clock.navigate("home", "library", 1550, true, false);
  assert.deepEqual(clock.update(1550), reversed);
  clock.update(5000);
  assert.equal(clock.progress, 1);
  assert.equal(clock.active, false);
});

test("reduced motion fades without a camera dive, and settles in 160ms", () => {
  const clock = new HomeTransitClock();
  clock.navigate("archive", "home", 1000, false, true);
  clock.navigate("home", "studio", 1000, true, true);
  const f = clock.update(1080);
  assert.equal(f.cameraMix, 0);
  assert.equal(f.retreat, 0);
  assert.ok(f.homeOpacity > 0 && f.otherOpacity > 0);
  clock.update(1161);
  assert.equal(clock.active, false);
});

test("new notes from home do not extract an existing archive, and return to home", () => {
  for (let i = 0; i <= 100; i++) {
    const f = evaluateStudioTrayTimeline((i * 1.4) / 100, "home");
    assert.equal(f.verticalClearance, 0);
    assert.equal(f.cassetteTransfer, 0);
  }
  const draft = createDefaultStudioDraft("tools", "home");
  const html = renderStudioViewMarkup(draft);
  assert.ok(html.includes("返回主页"));
  assert.ok(html.includes("就绪"));
  assert.equal(draft.lockedCode, "NEW");
});

test("reader return labels follow the actual source, including the missing-file view", () => {
  const origin = { hash: "#/home", label: "主页" };
  assert.ok(
    renderReaderViewMarkup("tools/aegisub", new Set(), true, origin).includes(
      "<span>主页</span>",
    ),
  );
  assert.ok(
    renderReaderViewMarkup("missing/file", new Set(), false, origin).includes(
      'href="#/home"',
    ),
  );
  assert.equal(parseHashRoute(buildLibraryHash("all")).category, "all");
  assert.equal(buildLibraryHash("tools"), "#/library/tools");
});

test("static drafts stay unsaved and the AI template uses the repository's real domains", () => {
  const draft = createDefaultStudioDraft("tools", "home");
  draft.localDiskAvailable = false;
  draft.dirty = true;
  assert.ok(renderStudioSaveStatusMarkup(draft).includes("未保存"));
  assert.ok(renderStudioViewMarkup(draft, false).includes("导出 Markdown"));
  const ids = knowledgeRepository
    .portals()
    .map((p) => p.id)
    .join(" | ");
  assert.ok(ATLAS_AI_ARCHIVE_PROMPT.includes(ids));
});
