// Focused browser regression for phone navigation, list menus, reading and dialogs.
// Set PLAYWRIGHT_MODULE to a local Playwright installation when it is not in node_modules.
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const { chromium, webkit } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || "playwright");
const base = (process.env.REVIEW_URL || "http://127.0.0.1:5173/").replace(/\/$/, "");
const engine = process.env.REVIEW_ENGINE || "chromium";
const browser = engine === "webkit"
  ? await webkit.launch({ headless: true })
  : await chromium.launch({ channel: "msedge", headless: true });
const cases = [
  ["small", 320, 568],
  ["phone", 393, 720],
  ["large", 430, 932],
  ["landscape", 844, 390],
  ["short-landscape", 568, 320],
].filter(([name]) => !process.env.REVIEW_CASES || process.env.REVIEW_CASES.split(",").includes(name));

const box = async (locator) => {
  const result = await locator.boundingBox();
  assert.ok(result, `missing or hidden: ${locator}`);
  return { ...result, right: result.x + result.width, bottom: result.y + result.height };
};
function inside(rect, width, height, label) {
  assert.ok(rect.x >= -1 && rect.y >= -1 && rect.right <= width + 1 && rect.bottom <= height + 1,
    `${label} outside ${width}×${height}: ${JSON.stringify(rect)}`);
}
function disjoint(a, b, label) {
  assert.ok(a.right <= b.x + 1 || b.right <= a.x + 1 || a.bottom <= b.y + 1 || b.bottom <= a.y + 1,
    `${label} overlap: ${JSON.stringify({ a, b })}`);
}
async function settled(page, view) {
  await page.waitForFunction(expected => window.rhine?.stats().atlasView === expected && !window.rhine.stats().homeTransit.active, view, { timeout: 60000 });
}

try {
  for (const [name, width, height] of cases) {
    const context = await browser.newContext({ viewport: { width, height }, isMobile: true, hasTouch: true, reducedMotion: "reduce", serviceWorkers: "block" });
    await context.addInitScript(() => localStorage.setItem("rhine-settings", JSON.stringify({
      sound: false, music: false, superPerformance: true,
      motion: { boot: false, surfaceTransitions: false, pointerParallax: false },
    })));
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    try {
      await page.goto(`${base}/?scene=archive#/home`, { waitUntil: "domcontentloaded" });
      await page.waitForFunction(() => window.rhine?.stats().ready && window.rhine.stats().startup === "started", null, { timeout: 90000 });
      await settled(page, "home");
      const modeButtons = page.locator(".system-nav .nav-mode-btn:visible");
      const buttons = await modeButtons.all();
      const navBoxes = await Promise.all(buttons.map(box));
      for (let i = 0; i < navBoxes.length; i++) {
        inside(navBoxes[i], width, height, `navigation ${i}`);
        for (let j = i + 1; j < navBoxes.length; j++) disjoint(navBoxes[i], navBoxes[j], "navigation buttons");
      }
      const settingsButton = box(page.locator('[data-action="settings"]'));
      for (const nav of navBoxes) disjoint(nav, await settingsButton, "navigation and settings");

      await page.locator('[data-action="nav-library"]').click();
      await settled(page, "library");
      await page.locator(".desk-dir-row").first().waitFor({ state: "visible" });
      const title = await box(page.locator(".desk-dir-row").first().locator(".desk-col-title"));
      if (width < height) assert.ok(title.width >= width * 0.45, `list title squeezed: ${title.width}`);
      const searchSize = await page.locator("#atlas-library-search").evaluate(el => parseFloat(getComputedStyle(el).fontSize));
      if (width < height) assert.ok(searchSize >= 16, "phone search input should not trigger iOS zoom");
      await page.locator(".desk-row-more-btn").first().click();
      const menu = page.locator(".desk-row-menu:not([hidden])");
      const menuBox = await box(menu);
      inside(menuBox, width, height, "row menu");
      if (width < height) {
        for (const item of await menu.locator('[role="menuitem"]').all()) {
          const itemBox = await box(item);
          inside(itemBox, width, height, "row menu item");
          assert.ok(itemBox.y >= menuBox.y && itemBox.bottom <= menuBox.bottom + 1);
        }
      }
      await menu.locator('[data-atlas-action="toggle-save"]').click();
      await page.locator(".desk-row-more-btn").first().click();
      await page.locator(".desk-row-menu:not([hidden]) [data-atlas-action=\"toggle-save\"]").click();

      await page.locator('[data-atlas-action="toggle-desk-filter"]').click();
      const filter = page.locator(".desk-filter-popover:not([hidden])");
      inside(await box(filter), width, height, "filter");
      await filter.locator('[data-library-status="learning"]').click();
      await page.locator('[data-atlas-action="reset-library-filters"]').first().click();
      await page.locator(".desk-act-secondary").click();
      await settled(page, "reader");
      const back = await box(page.locator(".optical-return-btn"));
      const tocButton = await box(page.locator('[data-optical-toggle="toc"]').first());
      const moreButton = await box(page.locator('[data-optical-toggle="more"]'));
      for (const [label, rect] of [["reader back", back], ["reader contents", tocButton], ["reader actions", moreButton]]) inside(rect, width, height, label);
      disjoint(back, tocButton, "reader toolbar");
      disjoint(tocButton, moreButton, "reader controls");
      await page.locator('[data-optical-toggle="toc"]').first().click();
      await page.locator("#optical-toc-drawer:not([hidden])").waitFor({ state: "visible" });
      await page.locator(".optical-drawer-close").click();
      await page.locator('[data-optical-toggle="more"]').click();
      inside(await box(page.locator("#optical-more-menu:not([hidden])")), width, height, "reader menu");
      const lastReaderAction = page.locator("#optical-more-menu:not([hidden]) .optical-menu-item").last();
      await lastReaderAction.scrollIntoViewIfNeeded();
      inside(await box(lastReaderAction), width, height, "last reader menu action");
      await page.locator('[data-optical-toggle="more"]').click();
      await page.locator('[data-atlas-action="exit-optical-reader"]').click();
      await settled(page, "library");

      await page.locator('[data-action="settings"]').click();
      const modal = page.locator(".terminal-modal");
      inside(await box(modal), width, height, "settings dialog");
      await modal.evaluate(el => { el.scrollTop = el.scrollHeight; });
      const close = await box(page.locator('[data-action="close-modal"]'));
      inside(close, width, height, "settings close");
      await page.locator('[data-action="close-modal"]').click();
      await page.locator(".terminal-modal").waitFor({ state: "detached" });

      await page.locator('[data-action="nav-archive"]').click();
      await settled(page, "archive");
      if (width < height) {
        await page.waitForFunction(() => {
          const title = document.querySelector("#selected-title")?.getBoundingClientRect();
          return title && title.left >= 0 && title.right <= innerWidth + 1;
        }).catch(async (error) => {
          console.error(await page.evaluate(() => ({
            hash: location.hash, layout: document.querySelector("#stage").dataset.layout,
            stageScroll: [document.querySelector("#stage").scrollLeft, document.querySelector("#stage").scrollTop],
            title: document.querySelector("#selected-title").outerHTML.slice(0, 300),
            titleRect: document.querySelector("#selected-title").getBoundingClientRect().toJSON(),
            measure: document.querySelector("#selected-title .rn-measure")?.getBoundingClientRect().width,
            summary: document.querySelector(".file-summary").getBoundingClientRect().toJSON(),
          })));
          throw error;
        });
        inside(await box(page.locator("#selected-title")), width, height, "archive title");
      }
      if (name === "phone") {
        const selected = await page.evaluate(() => window.rhine.stats().selected);
        await page.setViewportSize({ width: height, height: width });
        await page.waitForFunction(() => document.querySelector("#stage").dataset.layout === "compact" && !document.querySelector("#selected-title").classList.contains("mobile-wrapped"));
        assert.equal(await page.evaluate(() => window.rhine.stats().selected), selected);
        await page.setViewportSize({ width, height });
        await page.waitForFunction(() => document.querySelector("#stage").dataset.layout === "portrait");
        assert.equal(await page.evaluate(() => window.rhine.stats().selected), selected);
      }
      await page.locator(".read-file").first().click();
      await page.waitForFunction(() => window.rhine.stats().mode === "detail", null, { timeout: 60000 });
      await page.waitForFunction(() => window.rhine.stats().decryption.clarity === 1, null, { timeout: 60000 });
      await page.waitForFunction(() => {
        const back = document.querySelector(".back-button")?.getBoundingClientRect();
        const panel = document.querySelector(".detail-content")?.getBoundingClientRect();
        const nav = document.querySelector(".system-nav")?.getBoundingClientRect();
        return back && panel && nav && back.top >= nav.bottom - 1 && panel.top >= 0 && panel.bottom <= innerHeight + 1;
      }, null, { timeout: 30000 }).catch(async (error) => {
        console.error(await page.evaluate(() => Object.fromEntries(["#stage", "#detail-ui", ".system-nav", ".back-button", ".detail-content"].map(selector => {
          const el = document.querySelector(selector), css = getComputedStyle(el);
          return [selector, { rect: el.getBoundingClientRect().toJSON(), transform: css.transform, translate: css.translate, top: css.top, position: css.position }];
        }))));
        throw error;
      });
      const backButton = await box(page.locator(".back-button"));
      for (const nav of navBoxes) disjoint(nav, backButton, "archive detail back button");
      const documentPanel = page.locator(".detail-content");
      inside(await box(documentPanel), width, height, "archive detail");
      await documentPanel.locator('[data-action="bookmark"]').scrollIntoViewIfNeeded();
      assert.ok(await documentPanel.evaluate(el => el.scrollHeight > el.clientHeight && el.scrollTop > 0), "detail must scroll to actions");
      if (name === "phone" && engine === "chromium") {
        await page.locator(".viewer-open").click();
        await page.waitForFunction(() => JSON.parse(document.querySelector(".model-viewer")?.dataset.stats || "{}").ready, null, { timeout: 60000 });
        for (const selector of [".viewer-back", ".viewer-surface", ".viewer-actions", ".viewer-reset"]) inside(await box(page.locator(selector)), width, height, selector);
        await page.locator('[data-viewer="explode"]').click();
        await page.waitForFunction(() => JSON.parse(document.querySelector(".model-viewer").dataset.stats).spread > .99, null, { timeout: 30000 });
        await page.locator('[data-viewer="close"]').click();
        await page.waitForFunction(() => document.querySelector(".model-viewer").hidden);
      }
      assert.deepEqual(errors, []);
      console.log(`${engine} ${name}: navigation, list, menus, reader, settings and 3D detail passed`);
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
}
