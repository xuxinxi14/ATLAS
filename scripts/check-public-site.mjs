// Read-only browser checks against a built ATLAS_PUBLIC=1 site.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || "playwright");
const base = process.env.REVIEW_URL || "http://127.0.0.1:5230/ATLAS/";
const browser = await chromium.launch({ channel: process.env.REVIEW_CHANNEL || "msedge", headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await context.addInitScript(() => localStorage.setItem("rhine-settings", JSON.stringify({
  sound: false, music: false, superPerformance: true,
  motion: { boot: false, surfaceTransitions: false, pointerParallax: false },
})));
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
async function settle(view) {
  await page.waitForFunction((expected) => window.rhine?.stats().atlasView === expected && !window.rhine.stats().homeTransit.active, view, { timeout: 30000 });
}
try {
  await page.goto(base + "#/home");
  await page.waitForFunction(() => window.rhine?.stats().startup === "started", null, { timeout: 45000 });
  await settle("home");
  assert.equal(await page.locator('[data-action="nav-studio"], a[href^="#/studio"]').count(), 0);
  assert.match(await page.locator(".rhine-protocol-section").innerText(), /档案浏览指引/);
  await page.keyboard.press("n");
  assert.equal(await page.evaluate(() => window.rhine.stats().atlasView), "home");

  await page.evaluate(() => window.rhine.navigate("#/library"));
  await settle("library");
  assert.equal(await page.locator(".desk-new-btn").count(), 0);
  await page.locator(".desk-row-more-btn").first().click();
  assert.equal(await page.locator('.desk-row-menu:not([hidden]) a[href^="#/studio"]').count(), 0);
  await page.evaluate(() => window.rhine.navigate("#/studio/tools/aegisub"));
  await page.waitForFunction(() => location.hash === "#/library");
  await settle("library");
  assert.equal(await page.locator(".studio-writing-surface").count(), 0);

  await page.evaluate(() => window.rhine.navigate("#/entry/tools/aegisub"));
  await settle("reader");
  await page.locator('[data-optical-toggle="more"]').first().click();
  assert.equal(await page.locator('#optical-more-menu a[href^="#/studio"]').count(), 0);
  await page.keyboard.press("e");
  assert.equal(await page.evaluate(() => window.rhine.stats().atlasView), "reader");

  await page.evaluate(() => window.rhine.navigate("#/archive"));
  await settle("archive");
  await page.locator('[data-action="open"]').first().click();
  await page.waitForFunction(() => window.rhine.stats().mode === "detail");
  assert.equal(await page.locator('[data-action="edit-studio"]').count(), 0);

  await page.waitForFunction(() => document.documentElement.dataset.offlineReady === "true", null, { timeout: 90000 });
  await page.evaluate(() => window.rhine.navigate("#/entry/tools/aegisub"));
  await settle("reader");
  await context.setOffline(true);
  await page.reload();
  await page.waitForFunction(() => window.rhine?.stats().startup === "started", null, { timeout: 30000 });
  await settle("reader");
  assert.match(await page.locator("#atlas-reader-scroll h1").innerText(), /Aegisub/);
  assert.deepEqual(errors, []);
  console.log("PASS public read-only navigation, shortcuts, archive detail and offline reload");
} finally {
  await context.close();
  await browser.close();
}
