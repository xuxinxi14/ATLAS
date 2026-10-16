import assert from "node:assert/strict";
import { test } from "node:test";
import { searchKnowledge } from "../../src/search/search-engine.ts";
import {
  buildEntryHash,
  buildLibraryHash,
  parseHashRoute,
} from "../../src/app/router.ts";
import { knowledgeRepository } from "../../src/knowledge/repository.ts";

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

  // Verify alias lookup in repository ("tools/ppt-workflow" -> "tools-ppt-master-workflow")
  const aliased = knowledgeRepository.bySlug("tools/ppt-workflow");
  assert.ok(aliased);
  assert.equal(aliased.id, "tools-ppt-master-workflow");

  assert.equal(buildEntryHash("tools/aegisub"), "#/entry/tools/aegisub");
  assert.equal(buildLibraryHash("research"), "#/library/research");
});
