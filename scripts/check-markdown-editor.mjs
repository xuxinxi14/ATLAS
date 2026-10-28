// Browser-only checks: save and asset writes are intercepted; real notes are never changed.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)(
  process.env.PLAYWRIGHT_MODULE || "playwright",
);
const browser = await chromium.launch({
  channel: process.env.REVIEW_CHANNEL || "msedge",
  headless: true,
});
const errors = [];
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
        surfaceTransitions: false,
        pointerParallax: false,
      },
    }),
  ),
);
const page = await context.newPage();
page.on("pageerror", (error) => errors.push(error.message));
let previewRequests = 0;
await page.route("**/__atlas_api/preview", (route) => {
  previewRequests++;
  return route.abort();
});
let savedBody = "";
await page.route("**/__atlas_api/save", async (route) => {
  savedBody = route.request().postDataJSON().body;
  await route.fulfill({
    json: {
      ok: true,
      slug: "tools/browser-test",
      relPath: "content/tools/browser-test.md",
    },
  });
});

async function settled(view) {
  await page.waitForFunction(
    (expected) =>
      window.rhine?.stats().atlasView === expected &&
      !window.rhine.stats().homeTransit.active,
    view,
    { timeout: 30000 },
  );
}
async function saveAndReadBody() {
  const response = page.waitForResponse((item) =>
    item.url().includes("/__atlas_api/save"),
  );
  await page.locator('[data-studio-action="save-entry"]').first().click();
  await response;
  await page.waitForFunction(
    () =>
      !document
        .querySelector("#studio-save-status")
        ?.textContent?.includes("正在保存"),
  );
  return savedBody;
}
try {
  await page.goto(
    (process.env.REVIEW_URL || "http://127.0.0.1:5173/") + "#/studio",
  );
  await page.waitForFunction(
    () => window.rhine?.stats().startup === "started",
    null,
    { timeout: 30000 },
  );
  await settled("studio");
  const editor = page.locator("#studio-cm-body");
  await editor.waitFor({ state: "visible" });
  await page.locator("#studio-input-title").fill("浏览器 Markdown 测试");
  const source = [
    "## 结构标题",
    "",
    "**粗体**、*斜体*、~~删除~~、==重点==、$x^2$ 和 [[tools/aegisub|字幕档案]]。",
    "",
    "- [ ] 检查项",
    "",
    "| 参数 | 数值 |",
    "|---|---|",
    "| A | 2 |",
    "",
    "> [!TIP] 实用提示",
    "> 下一行说明",
    "",
    "```js",
    "const x = 1;",
    "```",
    "",
    "$$",
    "\\frac{1}{2}",
    "$$",
    "",
    "![示例](./assets/sample.png)",
    "",
    '<img src="x" onerror="window.__atlasXss=1">',
    "",
    "[回到标题](#结构标题)",
    "[[#结构标题|文内跳转]]",
    "",
    "末尾",
  ].join("\n");
  await editor.fill(source);
  await editor.press("Control+Home");
  await page.waitForTimeout(300);
  assert.equal(await page.locator(".studio-rendered-block table").count(), 1);
  assert.equal(await page.locator(".studio-rendered-block pre").count(), 1);
  assert.equal(
    await page
      .locator(".studio-rendered-block .studio-markdown-callout")
      .count(),
    1,
  );
  assert.ok((await page.locator(".studio-rendered-block .katex").count()) > 0);
  assert.equal(await page.locator(".studio-inline-preview mark").count(), 1);
  assert.ok((await page.locator(".studio-md-strong").count()) > 0);
  await page.screenshot({ path: "output/playwright/markdown-live.png" });

  await page.locator('[data-studio-tab="preview"]').click();
  await page.locator("#studio-preview-body table").waitFor();
  assert.equal(
    await page.locator("#studio-preview-body h2").innerText(),
    "结构标题",
  );
  assert.equal(
    await page.locator("#studio-preview-body strong").first().innerText(),
    "粗体",
  );
  assert.equal(
    await page.locator("#studio-preview-body mark").innerText(),
    "重点",
  );
  assert.match(
    await page
      .locator("#studio-preview-body .studio-wiki-link")
      .filter({ hasText: "字幕档案" })
      .getAttribute("href"),
    /entry\/tools\/aegisub/,
  );
  assert.equal(
    await page
      .locator("#studio-preview-body .studio-markdown-callout strong")
      .innerText(),
    "实用提示",
  );
  assert.equal(
    await page
      .locator("#studio-preview-body pre code .hljs-keyword")
      .innerText(),
    "const",
  );
  assert.equal(await page.locator("#studio-preview-body [onerror]").count(), 0);
  assert.equal(await page.evaluate(() => window.__atlasXss), undefined);
  assert.equal(previewRequests, 0);
  const beforeAnchor = page.url();
  await page
    .locator("#studio-preview-body a")
    .filter({ hasText: "回到标题" })
    .click();
  assert.equal(
    page.url(),
    beforeAnchor,
    "local heading links must not replace the app route",
  );
  await page
    .locator("#studio-preview-body a")
    .filter({ hasText: "文内跳转" })
    .click();
  assert.equal(page.url(), beforeAnchor);
  await page.screenshot({ path: "output/playwright/markdown-reading.png" });
  assert.equal(
    await saveAndReadBody(),
    source,
    "reading must never rewrite the Markdown source",
  );

  await page.locator('[data-studio-tab="source"]').click();
  assert.equal(await page.locator(".studio-rendered-block").count(), 0);
  assert.match(await editor.innerText(), /\*\*粗体\*\*/);
  await editor.press("Control+End");
  await page.keyboard.insertText("中文");
  await page.locator('[data-studio-dropdown="category"]').click();
  await page.locator('[data-studio-dropdown="category"]').click();
  await editor.focus();
  await page.keyboard.press("Control+z");
  assert.equal(
    await saveAndReadBody(),
    source,
    "undo survives mode changes and DOM rebuilds",
  );
  await editor.focus();
  await editor.press("Control+Home");
  await page.keyboard.press("Control+b");
  await page.keyboard.insertText("快捷键");
  assert.ok((await saveAndReadBody()).startsWith("**快捷键**## 结构标题"));
  await editor.focus();
  await page.keyboard.press("Control+f");
  await page.locator(".studio-editor-host .cm-search").waitFor();
  await page.keyboard.press("Escape");
  await editor.focus();
  await page.keyboard.press("Control+e");
  assert.equal(await page.locator("#studio-preview-pane").isVisible(), true);
  await page.keyboard.press("Control+e");
  assert.equal(await editor.isVisible(), true);
  assert.equal(await page.locator('[data-studio-tab="source"]').getAttribute("aria-selected"), "true");
  console.log(
    "PASS rich live preview, source, reading, safe rendering, undo and shortcuts",
  );

  await page.locator('[data-studio-tab="edit"]').click();
  await editor.fill("- [ ] 待完成\n\n结尾");
  await editor.press("Control+End");
  await page.locator(".studio-editor-host input[type=checkbox]").click();
  assert.match(await saveAndReadBody(), /^- \[x\] 待完成/);
  console.log("PASS task checkbox writes back to the original Markdown");

  await editor.fill("前文后文");
  await editor.press("Control+Home");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await page.locator('[data-studio-dropdown="insert"]').click();
  await page.locator('[data-studio-insert="code"]').click();
  assert.match(await saveAndReadBody(), /^前文\n~~~powershell[\s\S]*后文$/);

  await page.route("**/__atlas_api/upload-asset", (route) =>
    route.fulfill({
      json: {
        ok: true,
        markdownPath: "./assets/clipboard.png",
        fileName: "clipboard.png",
      },
    }),
  );
  await editor.focus();
  const pasteResponse = page.waitForResponse((response) =>
    response.url().includes("/__atlas_api/upload-asset"),
  );
  await editor.evaluate((element) => {
    const data = new DataTransfer();
    data.items.add(
      new File([new Uint8Array([137, 80, 78, 71])], "clipboard.png", {
        type: "image/png",
      }),
    );
    element.dispatchEvent(
      new ClipboardEvent("paste", {
        clipboardData: data,
        bubbles: true,
        cancelable: true,
      }),
    );
  });
  await pasteResponse;
  await page.waitForTimeout(200);
  assert.match(
    await saveAndReadBody(),
    /!\[clipboard\]\(\.\/assets\/clipboard\.png\)/,
  );
  await page.unroute("**/__atlas_api/upload-asset");
  console.log(
    "PASS snippets and clipboard images are inserted at the editor selection",
  );

  let releaseUpload;
  const uploadStarted = new Promise((resolve) => {
    page.route("**/__atlas_api/upload-asset", async (route) => {
      resolve();
      await new Promise((done) => {
        releaseUpload = done;
      });
      await route.fulfill({
        json: {
          ok: true,
          markdownPath: "./assets/browser-test.png",
          fileName: "browser-test.png",
        },
      });
    });
  });
  await page
    .locator("#studio-image-input")
    .setInputFiles({
      name: "browser-test.png",
      mimeType: "image/png",
      buffer: Buffer.from("89504e470d0a1a0a", "hex"),
    });
  await uploadStarted;
  await page.evaluate(() => window.rhine.navigate("#/studio/tools/aegisub"));
  await settled("studio");
  releaseUpload();
  await page.waitForTimeout(500);
  await page.locator('[data-studio-tab="source"]').click();
  assert.doesNotMatch(await editor.innerText(), /browser-test\.png/);
  console.log("PASS late image upload cannot modify a different note");
  await context.setOffline(true);
  const offlineDownload = page.waitForEvent("download");
  await page.locator('[data-studio-action="save-entry"]').first().click();
  await offlineDownload;
  assert.match(
    await page.locator(".studio-primary-save-btn").first().innerText(),
    /导出 Markdown/,
  );
  await context.setOffline(false);
  console.log("PASS losing the local service falls back to Markdown export");
  assert.deepEqual(errors, []);
} finally {
  await context.close();
  await browser.close();
}
