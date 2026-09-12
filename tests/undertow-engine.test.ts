import { describe, it, expect } from "vitest";
import {
  lineStep,
  cellsBetween,
  readForward,
  reverse,
  lineKey,
  initAttempt,
  resolveSelection,
  applySelection,
  isSolved,
  allFound,
} from "../src/games/undertow/engine.ts";
import type { Puzzle } from "../src/games/undertow/types.ts";

// 3x5 grid. Row0 holds "NAECO" = OCEAN reversed (target). Row1 holds "WAVE " but
// we use a clean layout: place OCEAN reversed on row0, and decoy WAVE forward on
// row1 cols0..3.
const puzzle: Puzzle = {
  puzzleId: "puz-0000",
  rows: 3,
  cols: 5,
  grid: ["NAECO", "WAVEX", "QRSTU"],
  targets: [{ id: "T0", word: "OCEAN", start: { row: 0, col: 0 }, end: { row: 0, col: 4 } }],
  decoys: [{ id: "D0", word: "WAVE", start: { row: 1, col: 0 }, end: { row: 1, col: 3 } }],
  mistakeBudget: 0,
};

describe("undertow engine — geometry", () => {
  it("lineStep accepts horizontal, vertical, diagonal; rejects non-collinear and single-cell", () => {
    expect(lineStep({ row: 0, col: 0 }, { row: 0, col: 4 })).toEqual({ dr: 0, dc: 1, len: 5 });
    expect(lineStep({ row: 0, col: 0 }, { row: 4, col: 0 })).toEqual({ dr: 1, dc: 0, len: 5 });
    expect(lineStep({ row: 0, col: 0 }, { row: 3, col: 3 })).toEqual({ dr: 1, dc: 1, len: 4 });
    expect(lineStep({ row: 0, col: 0 }, { row: 1, col: 2 })).toBeNull(); // knight-ish
    expect(lineStep({ row: 2, col: 2 }, { row: 2, col: 2 })).toBeNull(); // single cell
  });

  it("cellsBetween returns the inclusive contiguous cells", () => {
    const cells = cellsBetween({ row: 0, col: 0 }, { row: 0, col: 4 })!;
    expect(cells).toHaveLength(5);
    expect(cells[0]).toEqual({ row: 0, col: 0 });
    expect(cells[4]).toEqual({ row: 0, col: 4 });
  });

  it("readForward + reverse compose correctly", () => {
    const cells = cellsBetween({ row: 0, col: 0 }, { row: 0, col: 4 })!;
    expect(readForward(cells, puzzle)).toBe("NAECO");
    expect(reverse("NAECO")).toBe("OCEAN");
  });

  it("lineKey treats A->B and B->A as identical", () => {
    const a = lineKey({ id: "x", word: "W", start: { row: 0, col: 0 }, end: { row: 0, col: 4 } });
    const b = lineKey({ id: "y", word: "W", start: { row: 0, col: 4 }, end: { row: 0, col: 0 } });
    expect(a).toBe(b);
  });
});

describe("undertow engine — selection resolution", () => {
  it("matches a target only via the REVERSED reading", () => {
    const s = initAttempt(puzzle, "2026-01-01");
    const res = resolveSelection(s, puzzle, { row: 0, col: 0 }, { row: 0, col: 4 });
    expect(res.matchType).toBe("TARGET_MATCH");
    expect(res.targetId).toBe("T0");
  });

  it("selecting the target line reversed-direction still matches (reads end->start? no — engine reads start->end)", () => {
    // Reading col4->col0 gives OCEAN forward, reverse = NAECO, not a target. So the
    // player must select in the direction that reads NAECO forward.
    const s = initAttempt(puzzle, "2026-01-01");
    const res = resolveSelection(s, puzzle, { row: 0, col: 4 }, { row: 0, col: 0 });
    expect(res.matchType).toBe("NO_MATCH");
  });

  it("counts a forward decoy read as DECOY_MATCH", () => {
    const s = initAttempt(puzzle, "2026-01-01");
    const res = resolveSelection(s, puzzle, { row: 1, col: 0 }, { row: 1, col: 3 });
    expect(res.matchType).toBe("DECOY_MATCH");
  });

  it("returns NO_MATCH for a line spelling nothing", () => {
    const s = initAttempt(puzzle, "2026-01-01");
    const res = resolveSelection(s, puzzle, { row: 2, col: 0 }, { row: 2, col: 4 });
    expect(res.matchType).toBe("NO_MATCH");
  });

  it("returns ALREADY_FOUND when re-selecting a found target", () => {
    let s = initAttempt(puzzle, "2026-01-01");
    s = applySelection(s, puzzle, { row: 0, col: 0 }, { row: 0, col: 4 }).state;
    const res = resolveSelection(s, puzzle, { row: 0, col: 0 }, { row: 0, col: 4 });
    expect(res.matchType).toBe("ALREADY_FOUND");
  });
});

describe("undertow engine — apply + solve", () => {
  it("records found targets and completes; solved with 0 mistakes", () => {
    let s = initAttempt(puzzle, "2026-01-01");
    const out = applySelection(s, puzzle, { row: 0, col: 0 }, { row: 0, col: 4 });
    s = out.state;
    expect(out.resolution.matchType).toBe("TARGET_MATCH");
    expect(allFound(s, puzzle)).toBe(true);
    expect(isSolved(s, puzzle)).toBe(true);
  });

  it("a decoy selection increments mistakes and (budget 0) blocks solved", () => {
    let s = initAttempt(puzzle, "2026-01-01");
    s = applySelection(s, puzzle, { row: 1, col: 0 }, { row: 1, col: 3 }).state; // decoy
    s = applySelection(s, puzzle, { row: 0, col: 0 }, { row: 0, col: 4 }).state; // target
    expect(s.mistakeCount).toBe(1);
    expect(allFound(s, puzzle)).toBe(true);
    expect(isSolved(s, puzzle)).toBe(false); // budget 0 exceeded
  });

  it("respects a non-zero mistake budget", () => {
    const lenient: Puzzle = { ...puzzle, mistakeBudget: 1 };
    let s = initAttempt(lenient, "2026-01-01");
    s = applySelection(s, lenient, { row: 1, col: 0 }, { row: 1, col: 3 }).state; // 1 mistake
    s = applySelection(s, lenient, { row: 0, col: 0 }, { row: 0, col: 4 }).state; // target
    expect(isSolved(s, lenient)).toBe(true);
  });
});
