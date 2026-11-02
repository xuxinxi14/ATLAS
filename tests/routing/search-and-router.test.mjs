import assert from "node:assert/strict";
import { test } from "node:test";
import {
  searchKnowledge,
  parseSearchQueryOperators,
} from "../../src/search/search-engine.ts";
import {
  buildEntryHash,
  buildLibraryHash,
  parseHashRoute,
} from "../../src/app/router.ts";
import { hotReloadRepositoryData, knowledgeRepository } from "../../src/knowledge/repository.ts";

test("mixed Chinese, English, and case-insensitive search ranks title matches first", () => {
  const res1 = searchKnowledge("aegisub 字幕");
  assert.ok(res1.length > 0);
  assert.equal(res1[0].item.id, "tool-aegisub");
  assert.ok(res1[0].matchedFields.includes("标题"));

  // Full-width / uppercase normalization
  const res2 = searchKnowledge("ＰＰＴ-MASTER");
  assert.ok(res2.length > 0);
  assert.equal(res2[0].item.id, "tools-ppt-master-workflow");

  // Body-only match (e.g. "reset --soft HEAD~1")
  const res3 = searchKnowledge("reset --soft");
  assert.ok(res3.length > 0);
  assert.equal(res3[0].item.id, "skill-git-workflow");
  assert.ok(res3[0].snippet.includes("reset --soft"));
});

test("hash router parses home, archive, library, entry, and alias slugs accurately", () => {
  assert.deepEqual(parseHashRoute("#/home"), { view: "home" });
  assert.deepEqual(parseHashRoute("#/archive"), {
    view: "archive",
    category: undefined,
  });
  assert.deepEqual(parseHashRoute("#/library/tools"), {
    view: "library",
    category: "tools",
    query: undefined,
  });
  assert.deepEqual(parseHashRoute("#/entry/tools/ppt-master"), {
    view: "reader",
    slug: "tools/ppt-master",
    anchor: undefined,
  });

  // Test alias lookup with an isolated fixture; notes can change their own aliases.
  const original = [...knowledgeRepository.all(true)];
  const fixture = { ...original[0], aliases: ["test/alias"] };
  try {
    hotReloadRepositoryData({ entries: [fixture] });
    assert.equal(knowledgeRepository.bySlug("test/alias")?.id, fixture.id);
  } finally {
    hotReloadRepositoryData({ entries: original });
  }

  assert.equal(buildEntryHash("tools/aegisub"), "#/entry/tools/aegisub");
  assert.equal(buildLibraryHash("research"), "#/library/research");
});

test("structured search operators (tag:, #tag, cat:, status:, type:, code:) filter and rank accurately", () => {
  const parsed = parseSearchQueryOperators(
    "tag:rt-qpcr cat:research status:proficient type:snippet 2^-ddCt",
  );
  assert.deepEqual(parsed.tags, ["rt-qpcr"]);
  assert.deepEqual(parsed.categories, ["research"]);
  assert.deepEqual(parsed.statuses, ["proficient"]);
  assert.deepEqual(parsed.types, ["snippet"]);
  assert.equal(parsed.freeQuery, "2^-ddct");

  const byTag = searchKnowledge("#rt-qpcr");
  assert.ok(byTag.length >= 1, "#rt-qpcr matches RT-qPCR note");
  assert.equal(byTag[0].item.id, "research-qpcr-ct-ddct");

  const byCatAndType = searchKnowledge("cat:academics type:skill MeSH");
  assert.ok(byCatAndType.length >= 1);
  assert.equal(byCatAndType[0].item.id, "academics-pubmed-boolean-search");

  const byStatusOnly = searchKnowledge("status:review");
  assert.ok(byStatusOnly.length >= 1);
  assert.ok(
    byStatusOnly.every((r) => r.item.status === "review"),
    "status:review returns only review entries",
  );
});
