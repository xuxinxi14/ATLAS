import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildKnowledgeBase } from "./content-engine.mjs";

const defaultRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repository = "xuxinxi14/ATLAS";
const actionsUrl = `https://github.com/${repository}/actions/workflows/deploy.yml`;
const siteUrl = "https://xuxinxi14.github.io/ATLAS/";
const notePaths = ["content", "src/generated", "public/archives", "public/search-index.json", "public/media"];
const excludedPaths = [":(exclude)content/.obsidian"];
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function command(program, args, cwd, { inherit = false, allowFailure = false } = {}) {
  const result = spawnSync(program, args, {
    cwd,
    encoding: "utf8",
    stdio: inherit ? "inherit" : ["ignore", "pipe", "pipe"],
    windowsHide: false,
  });
  if (result.error) throw result.error;
  if (result.status !== 0 && !allowFailure) {
    const detail = result.stderr?.trim() || `退出代码 ${result.status}`;
    throw new Error(`${program} ${args[0] || ""} 失败：${detail}`);
  }
  return { status: result.status, stdout: result.stdout || "", stderr: result.stderr || "" };
}

function expectedGitHubRemote(url) {
  return /^(?:https:\/\/github\.com\/|git@github\.com:|ssh:\/\/git@github\.com\/)xuxinxi14\/ATLAS(?:\.git)?\/?$/i.test(url.trim());
}

function findRuns(root, sha) {
  const result = command("gh", ["run", "list", "--repo", repository, "--workflow", "deploy.yml", "--commit", sha, "--limit", "10", "--json", "databaseId,status,conclusion,attempt,url,createdAt"], root, { allowFailure: true });
  if (result.status !== 0) return null;
  try { return JSON.parse(result.stdout); } catch { return null; }
}

async function waitForDeployment(root, sha) {
  console.log("等待 GitHub Actions 构建并发布……");
  let runs;
  for (let attempt = 0; attempt < 12; attempt++) {
    runs = findRuns(root, sha);
    if (runs === null) {
      console.log(`提交已推送，但无法读取构建状态。请查看：${actionsUrl}`);
      return;
    }
    if (runs.length) break;
    await delay(3000);
  }
  if (!runs?.length) {
    console.log("尚未发现自动构建，尝试手动启动部署工作流……");
    command("gh", ["workflow", "run", "deploy.yml", "--repo", repository, "--ref", "main"], root, { inherit: true });
    for (let attempt = 0; attempt < 12; attempt++) {
      await delay(3000);
      runs = findRuns(root, sha);
      if (runs?.length) break;
    }
  }
  if (!runs?.length) throw new Error(`代码已推送，但尚未找到部署任务；请查看 ${actionsUrl}`);
  const run = runs[0];
  if (run.status === "completed" && run.conclusion !== "success") {
    console.log("上次部署未成功，正在重新运行……");
    command("gh", ["run", "rerun", String(run.databaseId), "--repo", repository], root, { inherit: true });
    for (let attempt = 0; attempt < 12; attempt++) {
      await delay(2000);
      const updated = findRuns(root, sha)?.find((item) => item.databaseId === run.databaseId);
      if (updated && (updated.attempt > run.attempt || updated.status !== "completed")) break;
    }
  }
  command("gh", ["run", "watch", String(run.databaseId), "--repo", repository, "--interval", "5", "--compact", "--exit-status"], root, { inherit: true });
  console.log(`\n网站已发布：${siteUrl}`);
}

/** Options are injectable for isolated local-Git tests; the launcher supplies none. */
export async function publishNotes(options = {}) {
  const root = path.resolve(options.root || defaultRoot);
  const remoteAllowed = options.remoteAllowed || expectedGitHubRemote;
  const validate = options.validate || (() => buildKnowledgeBase({ repoRoot: root, copyAssets: false, strictRelations: false }));
  const monitor = options.monitor !== false;
  let ghAvailable = options.useGh;
  if (ghAvailable === undefined) {
    try {
      ghAvailable = command("gh", ["auth", "status", "--hostname", "github.com"], root, { allowFailure: true }).status === 0;
    } catch {
      ghAvailable = false;
    }
  }
  const gitPrefix = ghAvailable ? ["-c", "credential.helper=", "-c", "credential.helper=!gh auth git-credential"] : [];
  const git = (args, extra = {}) => command("git", [...gitPrefix, ...args], root, extra);

  const branch = git(["branch", "--show-current"]).stdout.trim();
  if (branch !== "main") throw new Error(`当前分支是 ${branch || "分离状态"}，请先切换到 main。`);
  if (git(["diff", "--cached", "--quiet"], { allowFailure: true }).status !== 0) {
    throw new Error("暂存区已有其他改动。为避免混入发布，请先自行提交或取消暂存后重试。");
  }
  const remote = git(["remote", "get-url", "origin"]).stdout.trim();
  if (!remoteAllowed(remote)) throw new Error(`origin 不是预期的 ${repository}，已停止推送。`);

  console.log("校验本地知识库……");
  const result = await validate();
  if (result?.entries) console.log(`已检查 ${result.entries.length} 条笔记（包括草稿箱）。`);
  console.log("检查远程 main 分支……");
  git(["fetch", "--quiet", "--no-tags", "origin", "main"], { inherit: true });
  const ancestor = git(["merge-base", "--is-ancestor", "refs/remotes/origin/main", "HEAD"], { allowFailure: true });
  if (ancestor.status !== 0) throw new Error("远程 main 有本地尚未包含的提交；请先检查并同步后再重试。脚本不会自动覆盖或合并。 ");

  const paths = notePaths.filter((item) => existsSync(path.join(root, item)) || git(["ls-files", "--", item]).stdout.trim());
  if (!paths.length) throw new Error("没有找到可同步的知识库目录。");
  git(["add", "-A", "--", ...paths, ...excludedPaths]);
  const changed = git(["diff", "--cached", "--name-only", "-z"]).stdout.split("\0").filter(Boolean);
  if (changed.length) {
    console.log("\n本次提交的笔记和生成文件：");
    command("git", ["diff", "--cached", "--stat"], root, { inherit: true });
    git(["commit", "-m", "content: update knowledge base"], { inherit: true });
  } else {
    console.log("没有新的笔记改动，将检查已有提交的发布状态。");
  }
  const sha = git(["rev-parse", "HEAD"]).stdout.trim();
  console.log("\n推送到 GitHub……");
  git(["push", "origin", "main"], { inherit: true });
  if (monitor && ghAvailable) await waitForDeployment(root, sha);
  else if (monitor) console.log(`提交已推送。部署状态请查看：${actionsUrl}\n网站地址：${siteUrl}`);
  return { sha, changed };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  publishNotes().catch((error) => {
    console.error(`\n更新未完成：${error instanceof Error ? error.message : String(error)}`);
    console.error("本地文件和已创建的提交会保留；处理提示后可再次运行此脚本。");
    process.exitCode = 1;
  });
}
