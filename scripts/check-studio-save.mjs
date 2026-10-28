// This test writes two uniquely named notes. It must only run in an isolated
// verification copy, never against the user's working content directory.
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { parseFrontMatter } from "./content-engine.mjs";
const root = path.resolve(process.env.ATLAS_TEST_ROOT || "");
if (
  !process.env.ATLAS_TEST_ROOT ||
  !root.toLowerCase().includes(`${path.sep}.tools${path.sep}`)
)
  throw new Error("ATLAS_TEST_ROOT must name an isolated copy inside .tools");
const base = process.env.REVIEW_URL || "http://127.0.0.1:5219/";
if (!/^http:\/\/127\.0\.0\.1:\d+\/$/.test(base))
  throw new Error("Only a local isolated test server is allowed");
const nonce = Date.now().toString(36);
const first = `codex-save-test-${nonce}`,
  second = `codex-save-other-${nonce}`;
const firstPath = path.join(root, "content", "tools", `${first}.md`);
const secondPath = path.join(root, "content", "tools", `${second}.md`);
const post = async (endpoint, data) => {
  const response = await fetch(new URL(`/__atlas_api/${endpoint}`, base), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(data),
  });
  return { status: response.status, data: await response.json() };
};
const draft = (stem) => ({
  title: "隔离保存测试",
  category: "tools",
  fileSlug: stem,
  type: "skill",
  status: "learning",
  summary: "隔离测试",
  tags: ["one,two"],
  body: "## 原文\n\n**测试内容**",
});
let createdFirst = false,
  createdSecond = false;
try {
  let result = await post("save", {
    ...draft(first),
    id: `stable-${nonce}`,
    aliases: [`tools/alias-${nonce}`],
  });
  assert.equal(result.status, 200, JSON.stringify(result));
  createdFirst = true;
  let original = await fs.readFile(firstPath, "utf8");
  original = original
    .replace("prerequisites: []", "prerequisites: [tool-aegisub]")
    .replace("related: []", "related: [skill-git-workflow]")
    .replace("\n---\n\n#", '\ncustom_field: "kept, value"\n---\n\n#');
  await fs.writeFile(firstPath, original, "utf8");
  const editedBody = "## 修改后\n\n正文\n\n";
  result = await post("save", {
    ...draft(first),
    originalSlug: `tools/${first}`,
    body: editedBody,
  });
  assert.equal(result.status, 200, JSON.stringify(result));
  const saved = await fs.readFile(firstPath, "utf8");
  const parsed = parseFrontMatter(saved);
  assert.equal(parsed.data.id, `stable-${nonce}`);
  assert.deepEqual(parsed.data.aliases, [`tools/alias-${nonce}`]);
  assert.deepEqual(parsed.data.prerequisites, ["tool-aegisub"]);
  assert.deepEqual(parsed.data.related, ["skill-git-workflow"]);
  assert.deepEqual(parsed.data.tags, ["one,two"]);
  assert.equal(parsed.data.custom_field, "kept, value");
  assert.ok(
    parsed.body.endsWith(editedBody),
    "saving must preserve trailing Markdown newlines",
  );

  result = await post("save", draft(second));
  assert.equal(result.status, 200, JSON.stringify(result));
  createdSecond = true;
  const other = await fs.readFile(secondPath, "utf8");
  result = await post("save", {
    ...draft(second),
    originalSlug: `tools/${first}`,
  });
  assert.equal(result.status, 409, JSON.stringify(result));
  assert.equal(await fs.readFile(firstPath, "utf8"), saved);
  assert.equal(await fs.readFile(secondPath, "utf8"), other);

  result = await post("save", {
    ...draft(first),
    originalSlug: `tools/${first}`,
    body: "![缺失文件](./assets/codex-nonexistent-image.png)",
  });
  assert.equal(result.status, 500, JSON.stringify(result));
  assert.equal(
    await fs.readFile(firstPath, "utf8"),
    saved,
    "failed validation must restore original bytes",
  );
  assert.equal(await fs.readFile(secondPath, "utf8"), other);
  console.log(
    "PASS save preserves ID, aliases, relations, custom metadata, and quoted values",
  );
  console.log(
    "PASS collision is rejected and a failed save restores both notes",
  );
} finally {
  if (createdFirst) await post("delete", { slug: `tools/${first}` });
  if (createdSecond) await post("delete", { slug: `tools/${second}` });
}
