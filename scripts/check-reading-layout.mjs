import assert from "node:assert/strict";
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)(
  process.env.PLAYWRIGHT_MODULE || "playwright",
);
const browser = await chromium.launch({
  channel: process.env.REVIEW_CHANNEL || "msedge",
  headless: true,
});
const failures = [];
for (const viewport of [
  { width: 1920, height: 1080 },
  { width: 1024, height: 768 },
  { width: 390, height: 844 },
  { width: 844, height: 390 },
]) {
  for (const dark of [false, true]) {
    const context = await browser.newContext({
      viewport,
      serviceWorkers: "block",
    });
    await context.addInitScript(
      (dark) =>
        localStorage.setItem(
          "rhine-settings",
          JSON.stringify({
            sound: false,
            music: false,
            superPerformance: true,
            colorTheme: dark ? "dark" : "light",
            motion: {
              boot: false,
              surfaceTransitions: false,
              pointerParallax: false,
            },
          }),
        ),
      dark,
    );
    const page = await context.newPage();
    page.on("pageerror", (e) => failures.push(e.message));
    await page.goto(
      (process.env.REVIEW_URL || "http://127.0.0.1:5173/") + "#/library",
    );
    await page.waitForFunction(
      () => window.rhine?.stats().startup === "started",
      null,
      { timeout: 30000 },
    );
    await page.locator('[data-atlas-action="toggle-desk-filter"]').click();
    const filter = page.locator(".desk-filter-popover");
    await filter.waitFor({ state: "visible" });
    const appearance = await filter.evaluate((el) => {
      const style = getComputedStyle(el),
        rect = el.getBoundingClientRect();
      const obscured = [];
      const x = Math.min(innerWidth - 1, rect.left + rect.width * 0.86);
      for (
        let y = Math.max(1, rect.top + 10);
        y < Math.min(innerHeight - 1, rect.bottom - 10);
        y += 10
      ) {
        const top = document.elementFromPoint(x, y);
        if (top && !el.contains(top)) obscured.push(top.className);
      }
      return {
        background: style.backgroundColor,
        x: rect.x,
        right: rect.right,
        width: innerWidth,
        obscured,
      };
    });
    assert.ok(
      !appearance.background.startsWith("rgba(") ||
        appearance.background.endsWith(", 1)"),
      JSON.stringify(appearance),
    );
    assert.ok(
      appearance.x >= -1 && appearance.right <= appearance.width + 1,
      "filter outside viewport " + JSON.stringify(appearance),
    );
    assert.deepEqual(
      appearance.obscured,
      [],
      "another surface covers the filter: " + JSON.stringify(appearance),
    );
    if (viewport.width === 1920)
      await page.screenshot({
        path: `output/playwright/filter-${dark ? "dark" : "light"}.png`,
      });

    await page.evaluate(() => window.rhine.navigate("#/entry/tools/aegisub"));
    await page.waitForFunction(
      () => window.rhine?.stats().atlasView === "reader",
    );
    await page.locator('[data-optical-toggle="more"]').first().click();
    await page.locator('[data-optical-action="toggle-recede"]').click();
    await page.waitForFunction(
      () =>
        document.querySelector("#optical-reader-stage")?.dataset.receded ===
        "true",
    );
    const reader = await page.evaluate(() => {
      const signature = document.querySelector(".optical-stage-signature"),
        actions = document.querySelector(".optical-top-actions");
      const a = signature.getBoundingClientRect(),
        b = actions.getBoundingClientRect(),
        s = getComputedStyle(signature);
      return {
        hidden:
          s.visibility === "hidden" || s.display === "none" || +s.opacity === 0,
        overlaps:
          a.left < b.right &&
          b.left < a.right &&
          a.top < b.bottom &&
          b.top < a.bottom,
      };
    });
    assert.ok(
      reader.hidden || !reader.overlaps,
      "reader header overlaps " + JSON.stringify(reader),
    );
    if (viewport.width === 1920)
      await page.screenshot({
        path: `output/playwright/reader-expanded-${dark ? "dark" : "light"}.png`,
      });
    console.log("PASS layout", JSON.stringify({ viewport, dark }));
    await context.close();
  }
}
assert.deepEqual(failures, []);
await browser.close();
