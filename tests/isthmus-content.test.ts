import { describe, it, expect } from "vitest";
import { findSolution, buildPuzzle, assertPuzzleValid } from "../src/games/isthmus/content-build.ts";
import { buildShareText, isSpoilerSafe } from "../src/games/isthmus/share.ts";
import type { AttemptState, Coord } from "../src/games/isthmus/types.ts";

const grid = [
  ["C", "X", "Z"],
  ["Q", "A", "Y"],
  ["W", "M", "T"],
];
const dict = new Set(["CAT"]);

describe("findSolution", () => {
  it("finds a shore-to-shore dictionary path", () => {
    const sol = findSolution(grid, dict, 3);
    expect(sol).not.toBeNull();
    expect(sol![0].row).toBe(0);
    expect(sol![sol!.length - 1].row).toBe(2);
    const word = sol!.map((c) => grid[c.row][c.col]).join("");
    expect(dict.has(word)).toBe(true);
  });
  it("returns null when no path spells a word", () => {
    expect(findSolution(grid, new Set(["ZZZ"]), 3)).toBeNull();
  });
});

describe("buildPuzzle + gate", () => {
  it("verifies a known path fast and passes the gate", () => {
    const known: Coord[] = [{ row: 0, col: 0 }, { row: 1, col: 1 }, { row: 2, col: 2 }];
    const p = buildPuzzle(grid, dict, "puz-0000", 3, known);
    expect(p).not.toBeNull();
    expect(() => assertPuzzleValid(p!, dict)).not.toThrow();
  });
  it("rejects a grid with no valid path", () => {
    expect(buildPuzzle(grid, new Set(["ZZZ"]), "puz-0001", 3)).toBeNull();
  });
});

describe("share (spoiler-safe)", () => {
  const solved: AttemptState = { puzzleId: "puz-0000", dayId: "2026-07-25", path: [], attempts: 2, isSolved: true, bestLen: 3 };
  it("never leaks the solution word", () => {
    const text = buildShareText(solved, "2026-07-25");
    expect(isSpoilerSafe(text, ["CAT"])).toBe(true);
    expect(text).not.toContain("CAT");
    expect(text).toContain("Isthmus 2026-07-25");
    expect(text).toContain("bridged");
  });
  it("shows unsolved state", () => {
    const s = { ...solved, isSolved: false };
    expect(buildShareText(s, "2026-07-25")).toContain("not yet");
  });
});
