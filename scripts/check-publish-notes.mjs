// Exercises the one-click publisher against an isolated local bare repository.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { publishNotes } from "./publish-notes.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const toolsDir = await fs.realpath(path.join(root, ".tools"));
const temp = await fs.mkdtemp(path.join(toolsDir, "publish-test-"));
const bare = path.join(temp, "remote.git");
const work = path.join(temp, "work");
const other = path.join(temp, "other");
function git(cwd, ...args) {
  const result = spawnSync("git", args, { cwd, encoding: "utf8" });
  if (result.status !== 0) throw new Error(result.stderr);
  return result.stdout.trim();
}
async function write(rel, value, base = work) {
  const target = path.join(base, rel);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, value, "utf8");
}
const options = {
  root: work,
  remoteAllowed: (url) => path.resolve(url) === bare,
  validate: async () => ({ entries: [{}] }),
  useGh: false,
  monitor: false,
};
try {
  git(temp, "init", "--bare", "--initial-branch=main", bare);
  git(temp, "init", "--initial-branch=main", work);
  git(work, "config", "user.name", "ATLAS test");
  git(work, "config", "user.email", "atlas-test@example.invalid");
  git(work, "config", "core.autocrlf", "false");
  await write("content/seed.md", "original\n");
  await write("content/.obsidian/core-plugins.json", "original settings\n");
  await write("README.md", "original readme\n");
  git(work, "add", "--all");
  git(work, "commit", "-m", "fixture");
  git(work, "remote", "add", "origin", bare);
  git(work, "push", "-u", "origin", "main");

  await write("content/seed.md", "updated\n");
  await write("content/学科/新笔记.md", "中文笔记\n");
  await write("content/.obsidian/core-plugins.json", "private settings\n");
  await write("README.md", "unrelated edit\n");
  await write("output/not-included.txt", "unrelated output\n");
  const first = await publishNotes(options);
  assert.ok(first.changed.includes("content/seed.md"));
  assert.ok(first.changed.includes("content/学科/新笔记.md"));
  assert.equal(git(temp, "--git-dir", bare, "show", "main:content/seed.md"), "updated");
  assert.equal(git(temp, "--git-dir", bare, "show", "main:README.md"), "original readme");
  assert.equal(git(temp, "--git-dir", bare, "show", "main:content/.obsidian/core-plugins.json"), "original settings");
  assert.equal((await fs.readFile(path.join(work, "README.md"), "utf8")).trim(), "unrelated edit");

  const unchanged = await publishNotes(options);
  assert.equal(unchanged.sha, first.sha);
  assert.equal(unchanged.changed.length, 0);
  git(work, "add", "README.md");
  await assert.rejects(() => publishNotes(options), /暂存区已有其他改动/);
  assert.equal(git(work, "diff", "--cached", "--name-only"), "README.md");
  git(work, "reset", "-q", "HEAD", "--", "README.md");

  git(temp, "clone", bare, other);
  git(other, "config", "user.name", "Other test");
  git(other, "config", "user.email", "other@example.invalid");
  await write("content/remote.md", "remote change\n", other);
  git(other, "add", "content/remote.md");
  git(other, "commit", "-m", "remote change");
  git(other, "push", "origin", "main");
  await write("content/seed.md", "local work remains\n");
  await assert.rejects(() => publishNotes(options), /远程 main 有本地尚未包含的提交/);
  assert.equal(git(work, "rev-parse", "HEAD"), first.sha);
  assert.equal(git(work, "diff", "--cached", "--name-only"), "");
  assert.equal((await fs.readFile(path.join(work, "content/seed.md"), "utf8")).trim(), "local work remains");
  console.log("PASS one-click publishing: scoped changes, Unicode, no-op, staged changes and remote divergence");
} finally {
  const resolved = await fs.realpath(temp);
  if (!resolved.startsWith(toolsDir + path.sep) || !path.basename(resolved).startsWith("publish-test-")) throw new Error("Unsafe test cleanup path");
  await fs.rm(resolved, { recursive: true, force: true });
}
