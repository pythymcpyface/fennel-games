import { describe, it, expect } from "vitest";
import {
  lineStep,
  cellsBetween,
  targetCells,
  initAttempt,
  isRevealed,
  withinRadius,
  resolveSelection,
  applySelection,
  isSolved,
} from "../src/games/fogline/engine.ts";
import type { Puzzle } from "../src/games/fogline/types.ts";

// 3x5 grid. Row0 = "MOSS " padded; targets: MOSS at (0,0)→(0,3), PINE at (2,0)→(2,3).
// Only MOSS + halo is seeded, so PINE starts fogged.
const puzzle: Puzzle = {
  puzzleId: "puz-0000",
  rows: 3,
  cols: 5,
  grid: ["MOSSX", "ABCDE", "PINEZ"],
  targets: [
    { id: "T0", word: "MOSS", start: { row: 0, col: 0 }, dir: { row: 0, col: 1 } },
    { id: "T1", word: "PINE", start: { row: 2, col: 0 }, dir: { row: 0, col: 1 } },
  ],
  seedCells: [
    { row: 0, col: 0 }, { row: 0, col: 1 }, { row: 0, col: 2 }, { row: 0, col: 3 },
  ],
  fogRevealRadius: 2,
  distanceMetric: "CHEBYSHEV",
};

describe("fogline engine — geometry & fog", () => {
  it("lineStep handles straight lines, rejects non-collinear/single", () => {
    expect(lineStep({ row: 0, col: 0 }, { row: 0, col: 3 })).toEqual({ dr: 0, dc: 1, len: 4 });
    expect(lineStep({ row: 0, col: 0 }, { row: 1, col: 2 })).toBeNull();
    expect(lineStep({ row: 1, col: 1 }, { row: 1, col: 1 })).toBeNull();
  });

  it("cellsBetween is inclusive and contiguous", () => {
    expect(cellsBetween({ row: 0, col: 0 }, { row: 0, col: 3 })).toHaveLength(4);
  });

  it("targetCells lays a word along its direction", () => {
    const cells = targetCells(puzzle.targets[0]);
    expect(cells).toEqual([
      { row: 0, col: 0 }, { row: 0, col: 1 }, { row: 0, col: 2 }, { row: 0, col: 3 },
    ]);
  });

  it("seeds only the declared cells at start", () => {
    const s = initAttempt(puzzle, "2026-01-01");
    expect(isRevealed(s, puzzle, { row: 0, col: 0 })).toBe(true);
    expect(isRevealed(s, puzzle, { row: 2, col: 0 })).toBe(false); // PINE fogged
  });

  it("withinRadius uses the configured metric", () => {
    expect(withinRadius({ row: 0, col: 0 }, { row: 2, col: 2 }, 2, "CHEBYSHEV")).toBe(true);
    expect(withinRadius({ row: 0, col: 0 }, { row: 2, col: 2 }, 2, "MANHATTAN")).toBe(false); // dist 4
  });
});

describe("fogline engine — selection & progressive reveal", () => {
  it("blocks a selection that enters the fog and does not count it", () => {
    const s = initAttempt(puzzle, "2026-01-01");
    const out = applySelection(s, puzzle, { row: 2, col: 0 }, { row: 2, col: 3 }); // PINE, fogged
    expect(out.resolution.matchType).toBe("BLOCKED_BY_FOG");
    expect(out.state.selectionCount).toBe(0);
  });

  it("finds a seeded target and recedes the fog to reveal the next word", () => {
    let s = initAttempt(puzzle, "2026-01-01");
    // PINE is fogged initially.
    expect(isRevealed(s, puzzle, { row: 2, col: 0 })).toBe(false);
    const out = applySelection(s, puzzle, { row: 0, col: 0 }, { row: 0, col: 3 }); // MOSS
    s = out.state;
    expect(out.resolution.matchType).toBe("FOUND");
    expect(s.selectionCount).toBe(1);
    // radius 2 from row0 reaches row2 → PINE now revealed.
    expect(isRevealed(s, puzzle, { row: 2, col: 0 })).toBe(true);
  });

  it("completes when all targets found; solved", () => {
    let s = initAttempt(puzzle, "2026-01-01");
    s = applySelection(s, puzzle, { row: 0, col: 0 }, { row: 0, col: 3 }).state; // MOSS → reveals PINE
    s = applySelection(s, puzzle, { row: 2, col: 0 }, { row: 2, col: 3 }).state; // PINE
    expect(isSolved(s, puzzle)).toBe(true);
    expect(s.isComplete).toBe(true);
    expect(s.selectionCount).toBe(2);
  });

  it("re-selecting a found target is ALREADY_FOUND but still counts a selection", () => {
    let s = initAttempt(puzzle, "2026-01-01");
    s = applySelection(s, puzzle, { row: 0, col: 0 }, { row: 0, col: 3 }).state;
    const out = applySelection(s, puzzle, { row: 0, col: 0 }, { row: 0, col: 3 });
    expect(out.resolution.matchType).toBe("ALREADY_FOUND");
    expect(out.state.selectionCount).toBe(2);
  });

  it("NO_MATCH for a revealed line spelling nothing", () => {
    const s = initAttempt(puzzle, "2026-01-01");
    const res = resolveSelection(s, puzzle, { row: 0, col: 0 }, { row: 0, col: 2 }); // "MOS"
    expect(res.matchType).toBe("NO_MATCH");
  });
});
