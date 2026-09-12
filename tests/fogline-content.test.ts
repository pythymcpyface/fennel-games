import { describe, it, expect } from "vitest";
import { validate, buildPuzzle, assertPuzzleValid, norm, type RawPuzzle } from "../src/games/fogline/content-build.ts";
import { buildShareText, isSpoilerSafe } from "../src/games/fogline/share.ts";
import { initAttempt, applySelection } from "../src/games/fogline/engine.ts";

function raw(): RawPuzzle {
  return {
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
}

describe("fogline content-build — fairness gate", () => {
  it("accepts a valid, solvable-from-seed puzzle", () => {
    expect(validate(raw())).toEqual([]);
    const p = buildPuzzle("puz-0000", raw())!;
    expect(p).not.toBeNull();
    expect(p.targets).toHaveLength(2);
    expect(() => assertPuzzleValid(raw())).not.toThrow();
  });

  it("rejects a target that does not read forward (REQ-014)", () => {
    const r = raw();
    r.grid[0] = "MXSSX"; // MOSS no longer reads
    expect(validate(r).some((x) => x.includes("does not read forward"))).toBe(true);
  });

  it("rejects dimension mismatch (REQ-015)", () => {
    const r = raw();
    r.rows = 4;
    expect(validate(r).some((x) => x.includes("rows"))).toBe(true);
  });

  it("rejects a target extending out of bounds", () => {
    const r = raw();
    r.targets[0].start = { row: 0, col: 3 }; // MOSS would run off the row
    expect(validate(r).some((x) => x.includes("out of bounds"))).toBe(true);
  });

  it("rejects a puzzle not solvable from seed (REQ-016)", () => {
    const r = raw();
    r.seedCells = [{ row: 1, col: 0 }]; // covers no full target
    expect(validate(r).some((x) => x.includes("solvable from seed"))).toBe(true);
  });

  it("rejects duplicate target ids", () => {
    const r = raw();
    r.targets[1].id = "T0";
    expect(validate(r)).toContain("duplicate target id");
  });

  it("norm uppercases + trims", () => {
    expect(norm("  moss ")).toBe("MOSS");
  });
});

describe("fogline share — spoiler safety", () => {
  it("emits a found/missed grid + selection count without words", () => {
    const p = buildPuzzle("puz-0000", raw())!;
    let s = initAttempt(p, "2026-01-01");
    s = applySelection(s, p, { row: 0, col: 0 }, { row: 0, col: 3 }).state; // MOSS
    const text = buildShareText(s, p, "2026-01-01");
    expect(text).toContain("Fogline 2026-01-01 1/2");
    expect(text).toContain("🟩");
    expect(text).toContain("⬛");
    expect(isSpoilerSafe(text, p)).toBe(true);
    expect(text.toUpperCase()).not.toContain("MOSS");
    expect(text.toUpperCase()).not.toContain("PINE");
  });

  it("isSpoilerSafe flags text containing a target word", () => {
    const p = buildPuzzle("puz-0000", raw())!;
    expect(isSpoilerSafe("Fogline MOSS", p)).toBe(false);
  });
});
