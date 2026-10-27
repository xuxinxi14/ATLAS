import assert from "node:assert/strict";
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)(
  process.env.PLAYWRIGHT_MODULE || "playwright",
);
const browser = await chromium.launch({ channel: "msedge", headless: true });
try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    serviceWorkers: "block",
  });
  await context.addInitScript(() =>
    localStorage.setItem(
      "rhine-settings",
      JSON.stringify({
        sound: false,
        music: false,
        superPerformance: true,
        motion: {
          boot: false,
          surfaceTransitions: true,
          pointerParallax: false,
        },
      }),
    ),
  );
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(
    (process.env.REVIEW_URL || "http://127.0.0.1:5192/") + "#/home",
  );
  await page.waitForFunction(() => window.rhine?.stats().startup === "started");
  await page.locator('[data-action="nav-studio"]').click();
  await page.waitForFunction(
    () =>
      window.rhine.stats().atlasView === "studio" &&
      !window.rhine.stats().homeTransit.active &&
      !document.querySelector("#atlas-surface").inert,
  );
  await page.waitForTimeout(500);
  console.log(
    "Static primary action:",
    await page.locator(".studio-top-bar .studio-primary-save-btn").innerText(),
  );
  assert.match(
    await page.locator(".studio-top-bar .studio-primary-save-btn").innerText(),
    /导出 Markdown/,
  );
  assert.match(await page.locator(".studio-top-bar").innerText(), /返回主页/);
  await page.locator("#studio-input-title").fill("ATLAS static smoke");
  await page
    .locator("#studio-input-body")
    .fill("## Static preview\nExport only.");
  const downloadPromise = page.waitForEvent("download");
  await page
    .locator('.studio-top-bar [data-studio-action="save-entry"]')
    .click();
  const download = await downloadPromise;
  assert.equal(download.suggestedFilename(), "atlas-static-smoke.md");
  assert.match(await page.locator("#studio-save-status").innerText(), /未保存/);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(350);
  const actions = await page
    .locator(".studio-top-bar .studio-primary-save-btn")
    .boundingBox();
  assert.ok(
    actions.x >= 0 && actions.x + actions.width <= 390,
    "static export button clipped",
  );
  await page.locator('[data-studio-action="return-origin"]').first().click();
  await page.waitForFunction(
    () =>
      window.rhine.stats().atlasView === "home" &&
      !window.rhine.stats().homeTransit.active,
  );
  assert.deepEqual(errors, []);
  console.log(
    "PASS production static entry, export and return without local disk API.",
  );
} finally {
  await browser.close();
}
