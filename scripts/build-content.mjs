import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildKnowledgeBase,
  formatEntryTextDownload,
} from "./content-engine.mjs";

export async function syncContentFiles(repoRoot = path.resolve(".")) {
  const generatedDir = path.join(repoRoot, "src", "generated");
  const publicDir = path.join(repoRoot, "public");
  const archivesDir = path.join(publicDir, "archives");

  const result = await buildKnowledgeBase({
    repoRoot,
    copyAssets: true,
    strictRelations: false,
  });

  await fs.mkdir(generatedDir, { recursive: true });
  await fs.mkdir(archivesDir, { recursive: true });

  const manifestPayload = {
    portals: result.portals,
    inbox: result.inbox,
    entries: result.entries,
  };

  await fs.writeFile(
    path.join(generatedDir, "entries-manifest.json"),
    JSON.stringify(manifestPayload, null, 2) + "\n",
    "utf8",
  );

  await fs.writeFile(
    path.join(generatedDir, "telemetry.json"),
    JSON.stringify(result.telemetry, null, 2) + "\n",
    "utf8",
  );

  await fs.writeFile(
    path.join(generatedDir, "search-index.json"),
    JSON.stringify(result.searchIndex, null, 2) + "\n",
    "utf8",
  );

  await fs.writeFile(
    path.join(publicDir, "search-index.json"),
    JSON.stringify(result.searchIndex, null, 2) + "\n",
    "utf8",
  );

  // Clean up stale ATLAS-*.txt files from deleted notes
  const validTxtFiles = new Set(
    result.entries.map((entry) => `ATLAS-${entry.id}.txt`),
  );
  const existingArchives = await fs.readdir(archivesDir).catch(() => []);
  for (const name of existingArchives) {
    if (name.startsWith("ATLAS-") && name.endsWith(".txt") && !validTxtFiles.has(name)) {
      await fs.rm(path.join(archivesDir, name), { force: true });
    }
  }

  for (const entry of result.entries) {
    const txtContent = formatEntryTextDownload(entry);
    await fs.writeFile(
      path.join(archivesDir, `ATLAS-${entry.id}.txt`),
      txtContent,
      "utf8",
    );
  }

  console.log(
    `[ATLAS] Built ${result.entries.length} knowledge entries (${result.telemetry.totalEntries} published, ${result.telemetry.inboxCount} inbox drafts, ${result.copiedMediaFiles.length} co-located media files).`,
  );
  return result;
}

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isMain) {
  await syncContentFiles();
}
