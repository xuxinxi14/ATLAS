import { defineConfig, type Plugin, type ViteDevServer } from "vite";
import { existsSync, readFileSync } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { syncContentFiles } from "./scripts/build-content.mjs";
import {
  parseFrontMatter,
  renderMarkdownDocument,
} from "./scripts/content-engine.mjs";

// Keep Blender's stable source/export paths, while production URLs identify
// exact bytes and can be cached without revalidation across deployments.
const models = ["archive-cassette", "archive-assembly"].map((name) => {
  const source = readFileSync(`public/assets/${name}.glb`);
  const hash = createHash("sha256").update(source).digest("hex").slice(0, 16);
  return {
    key: `assets/${name}.glb`,
    fileName: `assets/${name}.${hash}.glb`,
    source,
  };
});

const hasNovecento = ["Normal", "DemiBold", "Bold"].every((weight) =>
  existsSync(
    `public/fonts/novecento/webFonts/NovecentoSansWide${weight}/font.woff2`,
  ),
);

const VALID_CATEGORIES = new Set([
  "tools",
  "computing",
  "research",
  "academics",
  "life",
  "inbox",
]);
const VALID_TYPES = new Set(["concept", "skill", "troubleshooting", "snippet"]);
const VALID_STATUSES = new Set([
  "draft",
  "todo",
  "learning",
  "proficient",
  "review",
]);

function sanitizeSlugStem(input: string): string {
  const cleaned = String(input || "")
    .trim()
    .toLowerCase()
    .replace(/\.md$/i, "")
    .replace(/[^a-z0-9\u4e00-\u9fa5_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
  return cleaned || `specimen-${Date.now().toString(36)}`;
}

function quoteYamlScalar(val: string): string {
  const clean = String(val ?? "")
    .replace(/\r?\n/g, " ")
    .trim();
  if (!clean) return '""';
  if (/[:#[\]{}&*!|>'"%@`]|^\s|\s$/.test(clean)) {
    return JSON.stringify(clean);
  }
  return clean;
}

function formatYamlArray(items: unknown): string {
  if (!Array.isArray(items) || items.length === 0) return "[]";
  const cleanItems = items
    .map((v) => String(v ?? "").trim())
    .filter(Boolean)
    .map((v) => (/[,\[\]"']/.test(v) ? JSON.stringify(v) : v));
  return `[${cleanItems.join(", ")}]`;
}

async function readJsonBody(req: IncomingMessage): Promise<Record<string, any>> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    req.on("end", () => {
      try {
        const raw = Buffer.concat(chunks).toString("utf8");
        resolve(raw ? JSON.parse(raw) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on("error", reject);
  });
}

function sendJson(res: ServerResponse, status: number, payload: unknown) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

async function loadCompiledSnapshot(repoRoot: string) {
  const genDir = path.join(repoRoot, "src", "generated");
  const [manifestRaw, telemetryRaw, searchRaw] = await Promise.all([
    fs.readFile(path.join(genDir, "entries-manifest.json"), "utf8"),
    fs.readFile(path.join(genDir, "telemetry.json"), "utf8"),
    fs.readFile(path.join(genDir, "search-index.json"), "utf8"),
  ]);
  return {
    manifest: JSON.parse(manifestRaw),
    telemetry: JSON.parse(telemetryRaw),
    searchIndex: JSON.parse(searchRaw),
  };
}

function atlasStudioPlugin(): Plugin {
  const repoRoot = path.resolve(".");
  const contentDir = path.join(repoRoot, "content");
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let isBuilding = false;
  let suppressWatcherUntil = 0;

  const isInsideDir = (targetDir: string, filePath: string) => {
    const rel = path.relative(targetDir, path.resolve(filePath));
    return Boolean(rel && !rel.startsWith("..") && !path.isAbsolute(rel));
  };

  return {
    name: "atlas-studio-and-live-sync",
    handleHotUpdate(ctx) {
      const normFile = ctx.file.replaceAll("\\", "/");
      // Never trigger a full browser reload when generated JSON manifests or txt exports update;
      // they are hot-swapped in memory via the custom WebSocket channel.
      if (
        normFile.includes("/src/generated/") ||
        normFile.includes("/public/archives/") ||
        normFile.endsWith("/public/search-index.json")
      ) {
        return [];
      }
      return undefined;
    },
    configureServer(server: ViteDevServer) {
      server.watcher.add(contentDir);

      const broadcastContentUpdate = async () => {
        const snapshot = await loadCompiledSnapshot(repoRoot);
        server.ws.send({
          type: "custom",
          event: "atlas:content-updated",
          data: snapshot,
        });
        return snapshot;
      };

      const onExternalContentChange = (eventType: string, changedPath: string) => {
        if (Date.now() < suppressWatcherUntil) return;
        if (!isInsideDir(contentDir, changedPath)) return;
        const relFile = path
          .relative(repoRoot, changedPath)
          .replaceAll("\\", "/");
        if (
          relFile.includes("/.obsidian/") ||
          !/\.(md|json|png|jpg|jpeg|webp|svg|gif)$/i.test(relFile)
        ) {
          return;
        }
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(async () => {
          if (isBuilding) return;
          isBuilding = true;
          try {
            console.log(
              `[ATLAS Live Sync] 检测到外部文件变更 (${eventType}: ${relFile})，正在热更新知识库...`,
            );
            await syncContentFiles(repoRoot);
            await broadcastContentUpdate();
          } catch (err) {
            console.error(
              `[ATLAS Live Sync] 编译异常：${err instanceof Error ? err.message : String(err)}`,
            );
          } finally {
            isBuilding = false;
          }
        }, 140);
      };

      server.watcher.on("add", (p) => onExternalContentChange("add", p));
      server.watcher.on("change", (p) => onExternalContentChange("change", p));
      server.watcher.on("unlink", (p) => onExternalContentChange("unlink", p));

      // Local WebUI Note Studio REST API
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith("/__atlas_api/")) {
          next();
          return;
        }

        const parsedUrl = new URL(req.url, "http://127.0.0.1");
        const pathname = parsedUrl.pathname;

        try {
          if (pathname === "/__atlas_api/ping" && req.method === "GET") {
            sendJson(res, 200, { ok: true, localDisk: true });
            return;
          }

          if (pathname === "/__atlas_api/snapshot" && req.method === "GET") {
            const snapshot = await loadCompiledSnapshot(repoRoot);
            sendJson(res, 200, { ok: true, ...snapshot });
            return;
          }

          if (pathname === "/__atlas_api/entry" && req.method === "GET") {
            const slugParam = (parsedUrl.searchParams.get("slug") || "")
              .trim()
              .replace(/^\/+|\/+$/g, "");
            if (!slugParam) {
              sendJson(res, 400, { ok: false, error: "缺少 slug 参数" });
              return;
            }
            const snapshot = await loadCompiledSnapshot(repoRoot);
            const found = snapshot.manifest.entries.find(
              (e: any) =>
                e.slug === slugParam ||
                e.id === slugParam ||
                (Array.isArray(e.aliases) && e.aliases.includes(slugParam)),
            );
            const relPath = found
              ? found.relPath
              : `content/${slugParam.endsWith(".md") ? slugParam : `${slugParam}.md`}`;
            const absPath = path.resolve(repoRoot, relPath);
            if (!isInsideDir(contentDir, absPath) || !existsSync(absPath)) {
              sendJson(res, 404, {
                ok: false,
                exists: false,
                error: `未找到对应的 Markdown 文件：${relPath}`,
              });
              return;
            }
            const raw = await fs.readFile(absPath, "utf8");
            const parsed = parseFrontMatter(raw, relPath);
            sendJson(res, 200, {
              ok: true,
              exists: true,
              relPath,
              entry: found ?? null,
              frontMatter: parsed.data,
              body: parsed.body,
              raw,
            });
            return;
          }

          if (pathname === "/__atlas_api/preview" && req.method === "POST") {
            const payload = await readJsonBody(req);
            const rawText = String(payload.rawMarkdown ?? "");
            let fm: Record<string, any> = {};
            let bodyText = String(payload.body ?? "");
            if (rawText) {
              try {
                const parsed = parseFrontMatter(rawText, "preview.md");
                fm = parsed.data;
                bodyText = parsed.body;
              } catch {
                bodyText = rawText;
              }
            }
            const rendered = renderMarkdownDocument(bodyText, {
              resolveImage: (src: string) => src,
              resolveLink: (href: string) => ({
                href,
                external: /^https?:\/\//i.test(href),
              }),
            });
            sendJson(res, 200, {
              ok: true,
              frontMatter: fm,
              body: bodyText.trim(),
              html: rendered.html,
              quickstartHtml: rendered.quickstartHtml,
              findings: rendered.findings,
              toc: rendered.toc,
            });
            return;
          }

          if (pathname === "/__atlas_api/save" && req.method === "POST") {
            const payload = await readJsonBody(req);
            const originalSlug = String(payload.originalSlug || "").trim();
            const oldSnapshot = originalSlug ? await loadCompiledSnapshot(repoRoot) : null;
            const oldEntry = oldSnapshot?.manifest?.entries?.find(
              (entry: any) => entry.slug === originalSlug || entry.id === originalSlug || entry.aliases?.includes(originalSlug),
            );
            let oldAbs: string | undefined;
            let oldRaw: string | undefined;
            let oldFrontMatter: Record<string, any> = {};
            if (originalSlug) {
              const candidate = path.resolve(repoRoot, oldEntry?.relPath || `content/${originalSlug}.md`);
              if (!isInsideDir(contentDir, candidate) || !existsSync(candidate)) {
                sendJson(res, 404, { ok: false, error: "原笔记不存在，请重新载入后再保存" });
                return;
              }
              oldAbs = candidate;
              oldRaw = await fs.readFile(candidate, "utf8");
              oldFrontMatter = parseFrontMatter(oldRaw, candidate).data;
            }
            const category = VALID_CATEGORIES.has(String(payload.category))
              ? String(payload.category)
              : "tools";
            const rawTitle = String(payload.title || "").trim() || "未命名知识档案";
            const fileStem = sanitizeSlugStem(
              payload.fileSlug ||
                String(payload.slug || "").split("/").pop() ||
                rawTitle,
            );
            const slug = `${category}/${fileStem}`;
            const id =
              String(oldFrontMatter.id || oldEntry?.id || payload.id || "").trim() ||
              `${category}-${fileStem}`.toLowerCase();
            const type = VALID_TYPES.has(String(payload.type))
              ? String(payload.type)
              : "skill";
            const status = VALID_STATUSES.has(String(payload.status))
              ? String(payload.status)
              : category === "inbox"
                ? "draft"
                : "learning";
            const subcategory =
              String(payload.subcategory || "general").trim() || "general";
            const today = new Date().toISOString().slice(0, 10);
            const created = /^\d{4}-\d{2}-\d{2}$/.test(String(payload.created || ""))
              ? String(payload.created)
              : today;
            const updated = today;

            const tags = Array.isArray(payload.tags)
              ? payload.tags
              : String(payload.tags || "")
                  .split(/[,，]/)
                  .map((s) => s.trim())
                  .filter(Boolean);

            const sourceUrls = (
              Array.isArray(payload.source_urls)
                ? payload.source_urls
                : String(payload.source_urls || "")
                    .split(/[\r\n,]+/)
                    .map((s) => s.trim())
                    .filter(Boolean)
            ).filter((u: string) => /^https?:\/\//i.test(u));

            const aliases = Array.isArray(payload.aliases)
              ? payload.aliases
              : payload.aliases === undefined
                ? (Array.isArray(oldFrontMatter.aliases) ? oldFrontMatter.aliases : oldEntry?.aliases || [])
                : String(payload.aliases || "")
                  .split(/[,，]/)
                  .map((s) => s.trim())
                  .filter(Boolean);
            const retainedArray = (name: string) =>
              Array.isArray(oldFrontMatter[name]) ? oldFrontMatter[name] : oldEntry?.[name] || [];

            let bodyContent = String(payload.body ?? "").replace(/\r\n/g, "\n");
            if (!bodyContent.startsWith("# ")) {
              bodyContent = `# ${rawTitle}\n\n${bodyContent}`;
            }
            const summary =
              String(payload.summary || "").trim() ||
              rawTitle;
            const versionScope =
              String(payload.version_scope || "通用版本").trim() || "通用版本";

            const yamlLines = [
              "---",
              `id: ${id}`,
              `title: ${quoteYamlScalar(rawTitle)}`,
              `slug: ${slug}`,
              `type: ${type}`,
              `category: ${category}`,
              `subcategory: ${quoteYamlScalar(subcategory)}`,
              `status: ${status}`,
              `tags: ${formatYamlArray(tags)}`,
              `summary: ${quoteYamlScalar(summary)}`,
              `created: ${created}`,
              `updated: ${updated}`,
              `version_scope: ${quoteYamlScalar(versionScope)}`,
              `source_urls: ${formatYamlArray(sourceUrls)}`,
              `prerequisites: ${formatYamlArray(retainedArray("prerequisites"))}`,
              `related: ${formatYamlArray(retainedArray("related"))}`,
              ...(aliases.length > 0
                ? [`aliases: ${formatYamlArray(aliases)}`]
                : []),
              ...Object.entries(oldFrontMatter)
                .filter(([key]) => !["id", "title", "slug", "type", "category", "subcategory", "status", "tags", "summary", "created", "updated", "version_scope", "source_urls", "prerequisites", "related", "aliases"].includes(key))
                .map(([key, value]) => `${key}: ${Array.isArray(value) ? formatYamlArray(value) : quoteYamlScalar(String(value ?? ""))}`),
              "---",
              "",
              bodyContent,
            ];

            const targetDir = path.join(contentDir, category);
            const targetFile = path.join(targetDir, `${fileStem}.md`);
            if (!isInsideDir(contentDir, targetFile)) {
              sendJson(res, 400, { ok: false, error: "非法文件路径" });
              return;
            }

            const samePath = Boolean(oldAbs && (path.resolve(oldAbs) === path.resolve(targetFile) ||
              (process.platform === "win32" && path.resolve(oldAbs).toLowerCase() === path.resolve(targetFile).toLowerCase())));
            if (existsSync(targetFile) && !samePath) {
              sendJson(res, 409, { ok: false, error: "目标文件已存在，请更换文件名，避免覆盖其他笔记" });
              return;
            }

            suppressWatcherUntil = Date.now() + 1500;
            await fs.mkdir(targetDir, { recursive: true });
            await fs.mkdir(path.join(targetDir, "assets"), { recursive: true });
            const newRaw = yamlLines.join("\n");
            let wroteTarget = false;
            let removedOriginal = false;
            let snapshot;
            try {
              await fs.writeFile(targetFile, newRaw, { encoding: "utf8", flag: samePath ? "w" : "wx" });
              wroteTarget = true;
              if (oldAbs && !samePath) {
                await fs.rm(oldAbs);
                removedOriginal = true;
              }
              await syncContentFiles(repoRoot);
              snapshot = await broadcastContentUpdate();
            } catch (error) {
              if (wroteTarget) {
                const current = await fs.readFile(targetFile, "utf8").catch(() => "");
                // Do not overwrite an external edit that arrived during the failed save.
                if (current === newRaw) {
                  if (samePath && oldRaw !== undefined) await fs.writeFile(targetFile, oldRaw, "utf8");
                  else await fs.rm(targetFile, { force: true });
                }
              }
              if (removedOriginal && oldAbs && oldRaw !== undefined && !existsSync(oldAbs)) {
                await fs.writeFile(oldAbs, oldRaw, "utf8");
              }
              await syncContentFiles(repoRoot).catch((restoreError) => console.error("[ATLAS] 恢复索引失败", restoreError));
              throw error;
            }
            sendJson(res, 200, {
              ok: true,
              slug,
              id,
              relPath: `content/${category}/${fileStem}.md`,
              snapshot,
            });
            return;
          }

          if (pathname === "/__atlas_api/delete" && req.method === "POST") {
            const payload = await readJsonBody(req);
            const targetSlug = String(payload.slug || "").trim();
            if (!targetSlug) {
              sendJson(res, 400, { ok: false, error: "缺少要删除的条目 slug" });
              return;
            }
            const currentSnapshot = await loadCompiledSnapshot(repoRoot);
            const entry = currentSnapshot.manifest.entries.find(
              (e: any) => e.slug === targetSlug || e.id === targetSlug,
            );
            if (!entry) {
              sendJson(res, 404, { ok: false, error: "未找到要删除的条目" });
              return;
            }
            const absFile = path.resolve(repoRoot, entry.relPath);
            if (!isInsideDir(contentDir, absFile) || !existsSync(absFile)) {
              sendJson(res, 404, { ok: false, error: "磁盘文件不存在" });
              return;
            }
            const trashDir = path.join(repoRoot, "backups", "studio-trash");
            await fs.mkdir(trashDir, { recursive: true });
            const stem = path.basename(absFile, ".md");
            const safeCategory = VALID_CATEGORIES.has(String(entry.category))
              ? String(entry.category)
              : "tools";
            const trashFileName = `${Date.now()}__${safeCategory}__${stem}.md`;
            const trashPath = path.join(trashDir, trashFileName);
            suppressWatcherUntil = Date.now() + 1500;
            await fs.copyFile(absFile, trashPath);
            await fs.rm(absFile, { force: true });
            await syncContentFiles(repoRoot);
            const snapshot = await broadcastContentUpdate();
            sendJson(res, 200, {
              ok: true,
              deletedSlug: targetSlug,
              trashFileName,
              snapshot,
            });
            return;
          }

          if (pathname === "/__atlas_api/trash" && req.method === "GET") {
            const trashDir = path.join(repoRoot, "backups", "studio-trash");
            if (!existsSync(trashDir)) {
              sendJson(res, 200, { ok: true, items: [] });
              return;
            }
            const dirEntries = await fs.readdir(trashDir, {
              withFileTypes: true,
            });
            const mdFiles = dirEntries.filter(
              (d) => d.isFile() && d.name.endsWith(".md"),
            );
            const items = await Promise.all(
              mdFiles.map(async (d) => {
                const fullPath = path.join(trashDir, d.name);
                const [raw, stat] = await Promise.all([
                  fs.readFile(fullPath, "utf8").catch(() => ""),
                  fs.stat(fullPath),
                ]);
                let fm: Record<string, any> = {};
                let body = raw;
                try {
                  const parsed = parseFrontMatter(raw, d.name);
                  fm = parsed.data;
                  body = parsed.body;
                } catch {
                  // Keep raw fallback
                }
                const nameMatch = /^(\d+)__([a-z]+)__(.+)\.md$/i.exec(d.name);
                const category = VALID_CATEGORIES.has(
                  String(fm.category || nameMatch?.[2] || ""),
                )
                  ? String(fm.category || nameMatch?.[2])
                  : "tools";
                const fileStem = sanitizeSlugStem(
                  nameMatch?.[3] ||
                    String(fm.slug || "").split("/").pop() ||
                    path.basename(d.name, ".md"),
                );
                const h1Match = body.match(/^#\s+(.+)$/m);
                const title = String(
                  fm.title || h1Match?.[1] || fileStem,
                ).trim();
                const summary = String(
                  fm.summary || body.replace(/^#\s+.+$/m, "").trim().slice(0, 80) || title,
                ).trim();
                const deletedMs = nameMatch
                  ? Number(nameMatch[1])
                  : stat.mtimeMs;
                return {
                  fileName: d.name,
                  title,
                  slug: `${category}/${fileStem}`,
                  category,
                  fileStem,
                  summary,
                  deletedAt: new Date(deletedMs)
                    .toISOString()
                    .replace("T", " ")
                    .slice(0, 16),
                  deletedMs,
                };
              }),
            );
            items.sort((a, b) => b.deletedMs - a.deletedMs);
            sendJson(res, 200, { ok: true, items });
            return;
          }

          if (
            pathname === "/__atlas_api/trash/restore" &&
            req.method === "POST"
          ) {
            const payload = await readJsonBody(req);
            const fileName = path.basename(String(payload.fileName || "").trim());
            if (!fileName || !fileName.endsWith(".md")) {
              sendJson(res, 400, { ok: false, error: "缺少合法的回收站文件名" });
              return;
            }
            const trashDir = path.join(repoRoot, "backups", "studio-trash");
            const trashFile = path.join(trashDir, fileName);
            if (!isInsideDir(trashDir, trashFile) || !existsSync(trashFile)) {
              sendJson(res, 404, { ok: false, error: "回收站文件不存在" });
              return;
            }
            const raw = await fs.readFile(trashFile, "utf8");
            let fm: Record<string, any> = {};
            try {
              fm = parseFrontMatter(raw, fileName).data;
            } catch {
              // ignore
            }
            const nameMatch = /^(\d+)__([a-z]+)__(.+)\.md$/i.exec(fileName);
            const category = VALID_CATEGORIES.has(
              String(fm.category || nameMatch?.[2] || ""),
            )
              ? String(fm.category || nameMatch?.[2])
              : "tools";
            let fileStem = sanitizeSlugStem(
              nameMatch?.[3] ||
                String(fm.slug || "").split("/").pop() ||
                path.basename(fileName, ".md"),
            );
            const targetDir = path.join(contentDir, category);
            await fs.mkdir(targetDir, { recursive: true });
            let targetFile = path.join(targetDir, `${fileStem}.md`);
            if (existsSync(targetFile)) {
              fileStem = `${fileStem}-restored-${Date.now().toString(36).slice(-4)}`;
              targetFile = path.join(targetDir, `${fileStem}.md`);
            }
            suppressWatcherUntil = Date.now() + 1500;
            await fs.writeFile(targetFile, raw, "utf8");
            await fs.rm(trashFile, { force: true });
            await syncContentFiles(repoRoot);
            const snapshot = await broadcastContentUpdate();
            sendJson(res, 200, {
              ok: true,
              slug: `${category}/${fileStem}`,
              relPath: `content/${category}/${fileStem}.md`,
              snapshot,
            });
            return;
          }

          if (pathname === "/__atlas_api/upload-asset" && req.method === "POST") {
            const payload = await readJsonBody(req);
            const category = VALID_CATEGORIES.has(String(payload.category))
              ? String(payload.category)
              : "tools";
            const rawName = String(payload.fileName || "image.png").replace(
              /[^a-zA-Z0-9._-]/g,
              "-",
            );
            const ext = path.extname(rawName) || ".png";
            const base = path.basename(rawName, ext);
            const safeName = `${base}-${Date.now().toString(36)}${ext}`;
            const base64Data = String(payload.base64Data || "").replace(
              /^data:[^;]+;base64,/,
              "",
            );
            if (!base64Data) {
              sendJson(res, 400, { ok: false, error: "空的图片数据" });
              return;
            }
            const assetsDir = path.join(contentDir, category, "assets");
            const destFile = path.join(assetsDir, safeName);
            if (!isInsideDir(contentDir, destFile)) {
              sendJson(res, 400, { ok: false, error: "非法图片路径" });
              return;
            }
            suppressWatcherUntil = Date.now() + 1200;
            await fs.mkdir(assetsDir, { recursive: true });
            await fs.writeFile(destFile, Buffer.from(base64Data, "base64"));
            sendJson(res, 200, {
              ok: true,
              fileName: safeName,
              markdownPath: `./assets/${safeName}`,
            });
            return;
          }

          if (pathname === "/__atlas_api/promote" && req.method === "POST") {
            const payload = await readJsonBody(req);
            const sourceSlug = String(payload.slug || "")
              .trim()
              .replace(/^\/+|\/+$/g, "");
            const targetCategory = String(payload.targetCategory || "").trim();
            if (
              !sourceSlug ||
              !VALID_CATEGORIES.has(targetCategory) ||
              targetCategory === "inbox"
            ) {
              sendJson(res, 400, {
                ok: false,
                error: "请指定有效的草稿 slug 与目标正式领域",
              });
              return;
            }
            const currentSnapshot = await loadCompiledSnapshot(repoRoot);
            const entry = currentSnapshot.manifest.entries.find(
              (e: any) =>
                e.slug === sourceSlug ||
                e.id === sourceSlug ||
                (Array.isArray(e.aliases) && e.aliases.includes(sourceSlug)),
            );
            const relPath = entry
              ? entry.relPath
              : `content/${sourceSlug.endsWith(".md") ? sourceSlug : `${sourceSlug}.md`}`;
            const absSource = path.resolve(repoRoot, relPath);
            if (!isInsideDir(contentDir, absSource) || !existsSync(absSource)) {
              sendJson(res, 404, { ok: false, error: "待转正的草稿文件不存在" });
              return;
            }
            const raw = await fs.readFile(absSource, "utf8");
            const parsed = parseFrontMatter(raw, relPath);
            const fm = parsed.data;
            const fileStem = sanitizeSlugStem(
              path.basename(absSource, ".md") ||
                String(fm.slug || "").split("/").pop() ||
                "promoted-note",
            );
            const newSlug = `${targetCategory}/${fileStem}`;
            const targetDir = path.join(contentDir, targetCategory);
            const targetFile = path.join(targetDir, `${fileStem}.md`);
            if (existsSync(targetFile) && path.resolve(targetFile) !== path.resolve(absSource)) {
              sendJson(res, 409, {
                ok: false,
                error: `目标领域已存在同名文件 content/${targetCategory}/${fileStem}.md`,
              });
              return;
            }

            const today = new Date().toISOString().slice(0, 10);
            const nextStatus =
              VALID_STATUSES.has(String(payload.targetStatus)) &&
              String(payload.targetStatus) !== "draft"
                ? String(payload.targetStatus)
                : fm.status && fm.status !== "draft"
                  ? String(fm.status)
                  : "learning";
            const aliases = Array.from(
              new Set([
                ...(Array.isArray(fm.aliases) ? fm.aliases : entry?.aliases || []),
                sourceSlug,
              ]),
            ).filter((a) => a && a !== newSlug);

            const id =
              String(fm.id || entry?.id || `${targetCategory}-${fileStem}`).trim();
            const title = String(fm.title || entry?.title || fileStem).trim();
            const type = VALID_TYPES.has(String(fm.type || entry?.type))
              ? String(fm.type || entry?.type)
              : "skill";
            const subcategory = String(
              fm.subcategory || entry?.subcategory || "general",
            ).trim();
            const tags = Array.isArray(fm.tags)
              ? fm.tags
              : entry?.tags || [];
            const summary = String(fm.summary || entry?.summary || title).trim();
            const created = /^\d{4}-\d{2}-\d{2}$/.test(String(fm.created || ""))
              ? String(fm.created)
              : today;
            const versionScope = String(
              fm.version_scope || entry?.version_scope || "通用版本",
            ).trim();
            const sourceUrls = Array.isArray(fm.source_urls)
              ? fm.source_urls
              : entry?.source_urls || [];
            const prerequisites = Array.isArray(fm.prerequisites)
              ? fm.prerequisites
              : entry?.prerequisites || [];
            const related = Array.isArray(fm.related)
              ? fm.related
              : entry?.related || [];

            let bodyContent = parsed.body.replace(/\r\n/g, "\n").trimStart();
            if (!bodyContent.startsWith("# ")) {
              bodyContent = `# ${title}\n\n${bodyContent}`;
            }

            const yamlLines = [
              "---",
              `id: ${id}`,
              `title: ${quoteYamlScalar(title)}`,
              `slug: ${newSlug}`,
              `type: ${type}`,
              `category: ${targetCategory}`,
              `subcategory: ${quoteYamlScalar(subcategory)}`,
              `status: ${nextStatus}`,
              `tags: ${formatYamlArray(tags)}`,
              `summary: ${quoteYamlScalar(summary)}`,
              `created: ${created}`,
              `updated: ${today}`,
              `version_scope: ${quoteYamlScalar(versionScope)}`,
              `source_urls: ${formatYamlArray(sourceUrls)}`,
              `prerequisites: ${formatYamlArray(prerequisites)}`,
              `related: ${formatYamlArray(related)}`,
              ...(aliases.length > 0
                ? [`aliases: ${formatYamlArray(aliases)}`]
                : []),
              "---",
              "",
              bodyContent,
            ];

            suppressWatcherUntil = Date.now() + 1500;
            await fs.mkdir(targetDir, { recursive: true });
            await fs.writeFile(targetFile, yamlLines.join("\n"), "utf8");
            if (path.resolve(targetFile) !== path.resolve(absSource)) {
              await fs.rm(absSource, { force: true });
            }
            await syncContentFiles(repoRoot);
            const snapshot = await broadcastContentUpdate();
            const promotedEntry = snapshot.manifest.entries.find(
              (e: any) => e.slug === newSlug || e.id === id,
            );
            sendJson(res, 200, {
              ok: true,
              slug: newSlug,
              id,
              visualCode: promotedEntry?.visualCode ?? "",
              globalCode: promotedEntry?.globalCode ?? "",
              relPath: `content/${targetCategory}/${fileStem}.md`,
              snapshot,
            });
            return;
          }

          sendJson(res, 404, { ok: false, error: "Unknown ATLAS API route" });
        } catch (err) {
          console.error("[ATLAS Studio API Error]", err);
          sendJson(res, 500, {
            ok: false,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => ({
  base: mode === "wallpaper" ? "./" : process.env.ATLAS_BASE || "/",
  build: {
    chunkSizeWarningLimit: 750,
    rollupOptions: {
      output: {
        manualChunks(id) {
          const norm = id.replaceAll("\\", "/");
          if (norm.includes("/node_modules/three/")) {
            return "three-vendor";
          }
          if (
            norm.includes("/node_modules/@codemirror/") ||
            norm.includes("/node_modules/@lezer/")
          ) {
            return "codemirror-vendor";
          }
          if (
            norm.includes("/node_modules/highlight.js/") ||
            norm.includes("/node_modules/marked/") ||
            norm.includes("/node_modules/dompurify/")
          ) {
            return "markdown-vendor";
          }
          if (norm.includes("/src/generated/")) {
            return "atlas-content-data";
          }
          return undefined;
        },
      },
    },
  },
  define: {
    __ATLAS_PUBLIC__: JSON.stringify(process.env.ATLAS_PUBLIC === "1"),
    __RHINE_MODELS__: JSON.stringify(
      Object.fromEntries(models.map((model) => [model.key, model.fileName])),
    ),
    __RHINE_NOVECENTO__: JSON.stringify(hasNovecento),
  },
  plugins: [
    atlasStudioPlugin(),
    {
      name: "versioned-model-assets",
      apply: "build",
      buildStart() {
        for (const model of models) {
          this.emitFile({
            type: "asset",
            fileName: model.fileName,
            source: model.source,
          });
        }
      },
    },
    ...(mode === "wallpaper"
      ? [
          {
            name: "wallpaper-host",
            transformIndexHtml(html: string) {
              return {
                html: html.replace(/\s*<link rel="manifest"[^>]*>/, ""),
                tags: [
                  {
                    tag: "script",
                    children: readFileSync("wallpaper/host.js", "utf8"),
                    injectTo: "head-prepend" as const,
                  },
                ],
              };
            },
          },
        ]
      : []),
  ],
}));
