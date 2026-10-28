// Read-only browser checks. Save/preview concurrency uses intercepted responses;
// no note is written, deleted or imported by this script.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
const { chromium } = createRequire(import.meta.url)(
  process.env.PLAYWRIGHT_MODULE || "playwright",
);
const browser = await chromium.launch({
  channel: process.env.REVIEW_CHANNEL || "msedge",
  headless: true,
});
const url = process.env.REVIEW_URL || "http://127.0.0.1:5173/";
const dir = ".tools/home-transitions";
const errors = [],
  checks = [];
await mkdir(dir, { recursive: true });
async function open({
  width = 1920,
  height = 1080,
  reduced = false,
  webgl = true,
  dark = false,
} = {}) {
  const context = await browser.newContext({
    viewport: { width, height },
    serviceWorkers: "block",
  });
  await context.addInitScript(
    ({ reduced, webgl, dark }) => {
      localStorage.setItem(
        "rhine-settings",
        JSON.stringify({
          sound: false,
          music: false,
          superPerformance: true,
          colorTheme: dark ? "dark" : "light",
          motion: reduced
            ? {
                boot: false,
                surfaceTransitions: false,
                selectionTransition: false,
                detailTransition: false,
                rollingText: false,
              }
            : { boot: false, surfaceTransitions: true, pointerParallax: false },
        }),
      );
      if (!webgl) {
        const original = HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.getContext = function (type, ...args) {
          return /^webgl/.test(type)
            ? null
            : original.call(this, type, ...args);
        };
      }
    },
    { reduced, webgl, dark },
  );
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(url + "#/home");
  await page.waitForFunction(() => window.rhine?.stats().startup === "started");
  return { page, context };
}
async function settle(page, view) {
  await page.waitForFunction(
    (view) => {
      const s = window.rhine?.stats(),
        stage = document.querySelector("#stage");
      return (
        s?.atlasView === view &&
        !s.homeTransit.active &&
        (view === "archive" ||
          !document.querySelector("#atlas-surface").inert) &&
        (view !== "studio" || stage.dataset.studioTransitioning !== "true")
      );
    },
    view,
    { timeout: 15000 },
  );
}
async function nav(page, hash, view) {
  await page.evaluate((hash) => window.rhine.navigate(hash), hash);
  await settle(page, view);
}
async function record(name, run) {
  await run();
  checks.push(name);
  console.log("PASS", name);
}
try {
  if (!process.env.REVIEW_VIEWPORTS_ONLY) {
    const { page, context } = await open();
    await settle(page, "home");
    await record(
      "home glass deck and orbital arcs stay inside their instrument",
      async () => {
        assert.equal(await page.locator(".rhine-portal-col").count(), 5);
        await page.waitForTimeout(600);
        const offset = await page.evaluate(() => {
          const center = document
            .querySelector(".rhine-orbital-graphic")
            .getBoundingClientRect();
          return Math.max(
            ...[...document.querySelectorAll(".orbital-arc")].map((el) => {
              const r = el.getBoundingClientRect();
              return Math.hypot(
                r.x + r.width / 2 - center.x - center.width / 2,
                r.y + r.height / 2 - center.y - center.height / 2,
              );
            }),
          );
        });
        assert.ok(offset < 2, "orbital center drift: " + offset);
        await page.screenshot({ path: dir + "/home.png" });
      },
    );
    await record(
      "home reader returns to the same home scroll and entry",
      async () => {
        await page
          .locator(".atlas-surface-scroll")
          .evaluate((el) => (el.scrollTop = 40));
        const before = await page
          .locator(".atlas-surface-scroll")
          .evaluate((el) => el.scrollTop);
        await page.locator(".rhine-ledger-row").first().click();
        await settle(page, "reader");
        assert.match(
          await page.locator(".optical-return-btn").innerText(),
          /主页/,
        );
        await page.locator(".optical-return-btn").click();
        await settle(page, "home");
        assert.equal(
          await page
            .locator(".atlas-surface-scroll")
            .evaluate((el) => el.scrollTop),
          before,
        );
      },
    );
    await record(
      "explicit domain entry clears incompatible search and preserves global library memory",
      async () => {
        await page
          .locator(
            '.rhine-portal-col[data-portal-id="tools"] a.rhine-inline-action',
          )
          .click();
        await settle(page, "library");
        await page.locator("#atlas-library-search").fill("Aegisub");
        await nav(page, "#/home", "home");
        await page
          .locator(
            '.rhine-portal-col[data-portal-id="computing"] a.rhine-inline-action',
          )
          .click();
        await settle(page, "library");
        assert.equal(
          await page.locator("#atlas-library-search").inputValue(),
          "",
        );
        assert.match(
          await page.locator(".desk-domain-item.active").innerText(),
          /编程与 AI/,
        );
        await page.locator("#atlas-library-search").fill("Git");
        await nav(page, "#/home", "home");
        await page.goBack();
        await settle(page, "library");
        assert.equal(
          await page.locator("#atlas-library-search").inputValue(),
          "Git",
        );
        await nav(page, "#/home", "home");
        await page.locator('[data-action="nav-library"]').click();
        await settle(page, "library");
        assert.equal(
          await page.locator("#atlas-library-search").inputValue(),
          "Git",
        );
        assert.match(
          await page.locator(".desk-domain-item.active").innerText(),
          /编程与 AI/,
        );
        await page.screenshot({ path: dir + "/library.png" });
      },
    );
    await record(
      "Escape reverses the home transfer without resetting its pose or leaving duplicate IDs",
      async () => {
        await nav(page, "#/home", "home");
        await page
          .locator(
            '[data-action="open-3d-portal"],[data-atlas-action="open-3d-portal"]',
          )
          .first()
          .click();
        await page.waitForFunction(
          () =>
            window.rhine.stats().homeTransit.progress > 0.15 &&
            window.rhine.stats().homeTransit.progress < 0.8,
        );
        const before = await page.evaluate(
          () => window.rhine.stats().homeTransit.progress,
        );
        await page.keyboard.press("Escape");
        const after = await page.evaluate(
          () => window.rhine.stats().homeTransit.progress,
        );
        assert.ok(after > 0 && Math.abs(after - before) < 0.3);
        await settle(page, "home");
        assert.equal(await page.locator("#home-transit-outgoing").count(), 0);
        const dup = await page.evaluate(() => {
          const ids = [...document.querySelectorAll("[id]")].map((e) => e.id);
          return ids.filter((id, i) => ids.indexOf(id) !== i);
        });
        assert.deepEqual(dup, []);
      },
    );
    await record(
      "home 3D domain entry restores the chosen lane without opening a file",
      async () => {
        await page
          .locator(
            '.rhine-portal-col[data-portal-id="research"] [data-atlas-action="open-3d-portal"]',
          )
          .click();
        await settle(page, "archive");
        const s = await page.evaluate(() => window.rhine.stats());
        assert.equal(s.selectedLane, 2);
        assert.equal(s.mode, "archive");
        await page.screenshot({ path: dir + "/archive.png" });
      },
    );
    await record(
      "rapid destination changes keep the newest target and home return source",
      async () => {
        await nav(page, "#/home", "home");
        await page.evaluate(() => window.rhine.navigate("#/archive"));
        await page.waitForFunction(
          () => window.rhine.stats().homeTransit.progress > 0.1,
        );
        await page.evaluate(() => window.rhine.navigate("#/studio"));
        await settle(page, "studio");
        assert.match(
          await page.locator(".studio-top-bar").innerText(),
          /返回主页/,
        );
        assert.equal(await page.locator("#home-transit-outgoing").count(), 0);
      },
    );
    await record(
      "new-note draft survives top navigation and restores body selection",
      async () => {
        await nav(page, "#/home", "home");
        await page.locator('[data-action="nav-studio"]').click();
        await settle(page, "studio");
        assert.match(
          await page.locator(".studio-top-bar").innerText(),
          /返回主页/,
        );
        assert.equal(
          await page.locator("#studio-dock-code").innerText(),
          "NEW",
        );
        await page.locator("#studio-input-title").fill("临时浏览器草稿");
        await page
          .locator("#studio-cm-body")
          .fill("## 浏览器草稿\n这段内容仅在隔离浏览器内。");
        await page.locator("#studio-cm-body").press("Control+Home");
        for (let i = 0; i < 3; i++) await page.keyboard.press("ArrowRight");
        for (let i = 0; i < 5; i++) await page.keyboard.press("Shift+ArrowRight");
        assert.equal(await page.evaluate(() => window.getSelection().toString()), "浏览器草稿");
        await nav(page, "#/home", "home");
        await page.locator('[data-action="nav-studio"]').click();
        await settle(page, "studio");
        assert.equal(
          await page.locator("#studio-input-title").inputValue(),
          "临时浏览器草稿",
        );
        await page.locator("#studio-cm-body").waitFor({ state: "visible" });
        assert.match(await page.locator("#studio-cm-body").innerText(), /浏览器草稿/);
        assert.equal(await page.evaluate(() => window.getSelection().toString()), "浏览器草稿");
        await page.screenshot({ path: dir + "/studio.png" });
      },
    );
    await record(
      "late entry load cannot replace a newer editor target",
      async () => {
        await page.route(
          "**/__atlas_api/entry?slug=tools%2Faegisub",
          async (route) => {
            const response = await route.fetch();
            await new Promise((r) => setTimeout(r, 900));
            await route.fulfill({ response });
          },
        );
        await page.evaluate(() =>
          window.rhine.navigate("#/studio/tools/aegisub"),
        );
        await page.waitForTimeout(100);
        await page.evaluate(() =>
          window.rhine.navigate("#/studio/tools/obsidian"),
        );
        await settle(page, "studio");
        await page.waitForTimeout(1100);
        assert.match(
          await page.locator("#studio-input-title").inputValue(),
          /Obsidian/,
        );
        assert.match(page.url(), /studio\/tools\/obsidian/);
        await page.unroute("**/__atlas_api/entry?slug=tools%2Faegisub");
      },
    );
    await record(
      "local preview immediately reflects the latest body without a server request",
      async () => {
        let previewRequests = 0;
        await page.route("**/__atlas_api/preview", async (route) => {
          previewRequests++;
          await route.abort();
        });
        await page.locator("#studio-cm-body").fill("preview_old");
        await page.locator("#studio-cm-body").fill("preview_current");
        await page.locator('[data-studio-tab="preview"]').click();
        await page.locator("#studio-preview-body").getByText("preview_current").waitFor();
        assert.equal(previewRequests, 0);
        await page.locator('[data-studio-tab="edit"]').click();
        await page.unroute("**/__atlas_api/preview");
      },
    );
    await record(
      "save completion for a departed note cannot rewrite another editor or route",
      async () => {
        let started;
        const saveStarted = new Promise((resolve) => { started = resolve; });
        await page.route("**/__atlas_api/save", async (route) => {
          started();
          await new Promise((r) => setTimeout(r, 700));
          await route.fulfill({
            json: {
              ok: true,
              slug: "tools/obsidian",
              relPath: "content/tools/obsidian.md",
            },
          });
        });
        await page.locator("#studio-input-title").fill("MOCK_SAVE_OBSIDIAN");
        await page.locator('[data-studio-action="save-entry"]').first().click();
        await saveStarted;
        await page.evaluate(() =>
          window.rhine.navigate("#/studio/tools/aegisub"),
        );
        await settle(page, "studio");
        await page.waitForTimeout(900);
        assert.match(
          await page.locator("#studio-input-title").inputValue(),
          /Aegisub/,
        );
        assert.match(page.url(), /studio\/tools\/aegisub/);
        await page.unroute("**/__atlas_api/save");
      },
    );
    await record(
      "discard after editing during save restores the submitted version",
      async () => {
        let started;
        const saveStarted = new Promise((resolve) => { started = resolve; });
        await page.route("**/__atlas_api/save", async (route) => {
          started();
          await new Promise((r) => setTimeout(r, 550));
          await route.fulfill({
            json: {
              ok: true,
              slug: "tools/aegisub",
              relPath: "content/tools/aegisub.md",
            },
          });
        });
        await page.locator("#studio-cm-body").fill("submitted_version");
        await page.locator('[data-studio-action="save-entry"]').first().click();
        await saveStarted;
        await page.locator("#studio-cm-body").fill("later_unsaved_version");
        await page.waitForTimeout(900);
        assert.match(
          await page.locator("#studio-save-status").innerText(),
          /未保存/,
        );
        await page.locator('[data-studio-dropdown="top-more"]').click();
        await page.locator('[data-studio-action="discard-draft"]').click();
        assert.equal(
          await page.locator("#studio-cm-body").innerText(),
          "submitted_version",
        );
        await page.unroute("**/__atlas_api/save");
      },
    );
    await record("reinitialize releases the home observation pose and snapshot", async () => {
      await nav(page, "#/home", "home");
      await page.getByRole("button", { name: "REINITIALIZE ↗", exact: true }).click();
      await settle(page, "archive");
      assert.equal(await page.evaluate(() => window.rhine.stats().homeTransit.progress), 1);
      assert.equal(await page.locator("#home-transit-outgoing").count(), 0);
    });
    await context.close();
  }
  for (const config of [
    { width: 390, height: 844 },
    { width: 844, height: 390 },
    { reduced: true, dark: true },
    { webgl: false },
  ]) {
    const { page: p, context: c } = await open(config);
    await record("fallback / viewport " + JSON.stringify(config), async () => {
      await settle(p, "home");
      assert.ok(
        await p.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      );
      if (config.width) {
        await p.waitForTimeout(350);
        const clipped = await p.locator(".system-nav").evaluate((el) =>
          [...el.querySelectorAll("button")]
            .filter((b) => {
              if (getComputedStyle(b).display === "none") return false;
              const r = b.getBoundingClientRect();
              return r.x < -1 || r.right > innerWidth + 1;
            })
            .map((b) => b.textContent),
        );
        assert.deepEqual(clipped, [], "mobile navigation clipped");
        const overflow = await p
          .locator(".home-observation-deck .atlas-surface-scroll")
          .evaluate((el) => ({
            width: el.clientWidth,
            scroll: el.scrollWidth,
            offenders: [...el.querySelectorAll("*")]
              .filter(
                (n) =>
                  n.getBoundingClientRect().right >
                  el.getBoundingClientRect().right + 1,
              )
              .slice(0, 10)
              .map((n) => n.className),
          }));
        assert.ok(
          overflow.scroll <= overflow.width + 1,
          "home content clipped: " + JSON.stringify(overflow),
        );
        await p.screenshot({ path: dir + "/home-" + config.width + ".png" });
      }
      await nav(p, "#/library/tools", "library");
      if (config.width)
        await p.screenshot({ path: dir + "/library-" + config.width + ".png" });
      await nav(p, "#/home", "home");
      await nav(p, "#/studio", "studio");
      assert.match(await p.locator(".studio-top-bar").innerText(), /返回主页/);
      if (config.width) {
        const save = await p
          .locator(".studio-top-bar .studio-primary-save-btn")
          .boundingBox();
        assert.ok(save.width >= 80 && save.height <= 48, "save label squeezed");
        await p
          .locator("#studio-cm-body")
          .evaluate((el) => el.scrollIntoView({ block: "nearest" }));
        const body = await p.locator("#studio-cm-body").boundingBox();
        assert.ok(
          body.height >= 100 && body.y >= 0 && body.y < config.height,
          "editor inaccessible",
        );
      }
      if (config.webgl === false) {
        assert.equal(
          await p.locator('[data-atlas-action="open-3d-portal"]').count(),
          0,
        );
        await nav(p, "#/studio/tools/aegisub", "studio");
        assert.equal(
          await p.locator(".studio-cassette-dock.is-vector-fallback").count(),
          1,
        );
        assert.ok(await p.locator(".studio-bay-cassette-card").isVisible());
      }
      await p.screenshot({
        path:
          dir +
          "/viewport-" +
          (config.width || 1920) +
          "-" +
          (config.height || 1080) +
          "-" +
          (config.webgl === false
            ? "2d"
            : config.reduced
              ? "reduced"
              : "full") +
          ".png",
      });
    });
    await c.close();
  }
  assert.deepEqual(errors, []);
  await writeFile(
    dir + "/results.json",
    JSON.stringify(
      { checks, errors, note: "save requests intercepted; no content writes" },
      null,
      2,
    ),
  );
  console.log(
    "Completed",
    checks.length,
    "browser checks, no page exceptions.",
  );
} finally {
  await browser.close();
}
