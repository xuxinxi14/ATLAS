import path from "node:path";
import { buildKnowledgeBase } from "./content-engine.mjs";

const repoRoot = path.resolve(".");
const result = await buildKnowledgeBase({
  repoRoot,
  copyAssets: false,
});

console.log(
  `[ATLAS] Content validation passed: ${result.entries.length} entries across ${result.portals.length} portals (+ inbox).`,
);
