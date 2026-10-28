// Regenerate the notices for the editor's pinned production dependency tree.
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const lock = JSON.parse(await readFile("package-lock.json", "utf8"));
const pending = [
  "@codemirror/commands", "@codemirror/lang-markdown", "@codemirror/language",
  "@codemirror/search", "@codemirror/state", "@codemirror/view",
  "@lezer/highlight", "@lezer/markdown", "dompurify", "highlight.js", "katex", "marked",
];
const names = new Set();
while (pending.length) {
  const name = pending.pop();
  if (names.has(name)) continue;
  const meta = lock.packages[`node_modules/${name}`];
  if (!meta) throw new Error(`Missing locked dependency: ${name}`);
  names.add(name);
  pending.push(...Object.keys(meta.dependencies || {}));
}
const notices = [
  "Markdown editor third-party notices",
  "Generated from the exact versions in package-lock.json by scripts/build-editor-licenses.mjs.",
  "DOMPurify is used under the Apache License 2.0 option; Copyright (c) Cure53 and other contributors.",
];
for (const name of [...names].sort()) {
  const dir = path.join("node_modules", ...name.split("/"));
  const meta = JSON.parse(await readFile(path.join(dir, "package.json"), "utf8"));
  const license = await readFile(path.join(dir, "LICENSE"), "utf8");
  notices.push(`\n${"=".repeat(72)}\n${name} ${meta.version} — ${meta.license}\n\n${license.trim()}`);
}
await writeFile("public/licenses/markdown-editor.txt", `${notices.join("\n")}\n`, "utf8");
console.log(`Included ${names.size} pinned dependency notices.`);
