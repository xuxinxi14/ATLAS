import path from "node:path";
import { defineConfig } from "vite";
import { syncContentFiles } from "./scripts/build-content.mjs";

function atlasContentLiveSyncPlugin() {
  const contentDir = path.resolve("content");
  let debounceTimer = null;
  let isBuilding = false;
  let pendingRebuild = false;

  const isInsideContentDir = (filePath) => {
    const rel = path.relative(contentDir, path.resolve(filePath));
    return rel && !rel.startsWith("..") && !path.isAbsolute(rel);
  };

  return {
    name: "atlas-content-live-sync",
    configureServer(server) {
      server.watcher.add(contentDir);

      const triggerRebuild = (eventType, changedPath) => {
        if (!isInsideContentDir(changedPath)) return;
        const relFile = path
          .relative(path.resolve("."), changedPath)
          .replaceAll("\\", "/");
        if (
          relFile.includes("/.obsidian/") ||
          !/\.(md|json|png|jpg|jpeg|webp|svg|gif)$/i.test(relFile)
        ) {
          return;
        }
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(async () => {
          if (isBuilding) {
            pendingRebuild = true;
            return;
          }
          isBuilding = true;
          try {
            console.log(
              `[ATLAS Live Sync] 检测到笔记变更 (${eventType}: ${relFile})，正在重新编译索引...`,
            );
            await syncContentFiles(path.resolve("."));
            server.ws.send({ type: "full-reload", path: "*" });
          } catch (err) {
            console.error(
              `[ATLAS Live Sync] 编译失败：${err instanceof Error ? err.message : String(err)}`,
            );
          } finally {
            isBuilding = false;
            if (pendingRebuild) {
              pendingRebuild = false;
              triggerRebuild("change", changedPath);
            }
          }
        }, 120);
      };

      server.watcher.on("add", (p) => triggerRebuild("add", p));
      server.watcher.on("change", (p) => triggerRebuild("change", p));
      server.watcher.on("unlink", (p) => triggerRebuild("unlink", p));
    },
  };
}

export default defineConfig({
  plugins: [atlasContentLiveSyncPlugin()],
});
