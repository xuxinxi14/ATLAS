import fs from "node:fs/promises";
import path from "node:path";
import {
  buildKnowledgeBase,
  formatEntryTextDownload,
} from "./content-engine.mjs";

const repoRoot = path.resolve(".");
const generatedDir = path.join(repoRoot, "src", "generated");
const publicDir = path.join(repoRoot, "public");
const archivesDir = path.join(publicDir, "archives");

const result = await buildKnowledgeBase({
  repoRoot,
  copyAssets: true,
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
