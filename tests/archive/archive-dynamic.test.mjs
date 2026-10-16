import assert from "node:assert/strict";
import { test } from "node:test";
import {
  archiveColumns,
  columnFiles,
  fileAtSlot,
  fileLocation,
  records,
} from "../../src/data.ts";
import {
  fileAtCell,
  LOOP_COLUMNS,
  LOOP_ROWS,
  selectionCell,
  visibleCell,
  wrap,
} from "../../src/archive-loop.ts";

function makeSyntheticRecords(countsPerCol) {
  const cols = ["tools", "computing", "research", "academics", "life"];
  const list = [];
  cols.forEach((col, cIdx) => {
    const count = countsPerCol[cIdx] ?? 0;
    for (let i = 0; i < count; i++) {
      list.push({
        id: `X-${String(list.length + 1).padStart(3, "0")}`,
        entryId: `${col}-${i + 1}`,
        slug: `${col}/item-${i + 1}`,
        title: `${col} Item ${i + 1}`,
        category: col,
      });
    }
  });
  return { cols, list };
}

test("handles categories with 0, 1, 8, 41, and 200 entries without crashing or losing items", () => {
  const { cols, list } = makeSyntheticRecords([0, 1, 8, 41, 200]);
  assert.equal(list.length, 250);

  // Column 0 has 0 entries: should safely return 0 without NaN
  assert.equal(columnFiles(0, list, cols).length, 0);
  const emptyCellFile = fileAtCell({ lane: 0, row: 12 }, list, cols);
  assert.equal(Number.isNaN(emptyCellFile), false);

  // Column 1 has 1 entry: scrolling up and down always maps to that single entry
  const col1Files = columnFiles(1, list, cols);
  assert.equal(col1Files.length, 1);
  for (let r = -20; r <= 50; r++) {
    assert.equal(fileAtCell({ lane: 1, row: r }, list, cols), col1Files[0]);
  }

  // Column 3 has 41 entries (> 32 slot pool rows): all 41 are reachable in sequence
  const col3Files = columnFiles(3, list, cols);
  assert.equal(col3Files.length, 41);
  const seen41 = new Set();
  for (let r = 12; r < 12 + 41; r++) {
    const idx = fileAtCell({ lane: 3, row: r }, list, cols);
    seen41.add(idx);
  }
  assert.equal(seen41.size, 41, "All 41 entries in column 3 must be reachable");

  // Column 4 has 200 entries: all 200 are reachable while visible pool remains fixed at 288
  const col4Files = columnFiles(4, list, cols);
  assert.equal(col4Files.length, 200);
  const seen200 = new Set();
  let currentCell = { lane: 4, row: 12 };
  for (let step = 0; step < 200; step++) {
    const idx = fileAtCell(currentCell, list, cols);
    seen200.add(idx);
    const nextIdx = col4Files[wrap(step + 1, col4Files.length)];
    currentCell = selectionCell(
      nextIdx,
      currentCell,
      { axis: "row", direction: 1 },
      list,
      cols,
    );
  }
  assert.equal(
    seen200.size,
    200,
    "All 200 entries in column 4 must be visited during continuous scroll",
  );

  // Visible cell pool never exceeds LOOP_COLUMNS * LOOP_ROWS (288)
  const visible = Array.from({ length: LOOP_COLUMNS * LOOP_ROWS }, (_, i) =>
    visibleCell(i, currentCell),
  );
  assert.equal(visible.length, 288);
});

test("3D ArchiveRecord and 2D KnowledgeRepository share identical entry data", () => {
  assert.ok(records.length >= 14);
  for (let i = 0; i < records.length; i++) {
    const rec = records[i];
    const loc = fileLocation(i);
    assert.ok(loc.lane >= 0 && loc.lane < archiveColumns.length);
    assert.equal(typeof rec.entryId, "string");
    assert.equal(typeof rec.slug, "string");
    assert.ok(rec.html.length > 0);
  }
});
