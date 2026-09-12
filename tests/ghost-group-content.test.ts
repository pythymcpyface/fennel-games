import { describe, it, expect } from "vitest";
import { isFairPuzzle, buildPuzzle, assertPuzzleValid } from "../src/games/ghost-group/content-build.ts";
import { buildShareText, isSpoilerSafe } from "../src/games/ghost-group/share.ts";
import type { AttemptState, Puzzle } from "../src/games/ghost-group/types.ts";

const groups = [
  { label: "Alpha", words: ["A0", "A1", "A2", "A3"] },
  { label: "Beta", words: ["B0", "B1", "B2", "B3"] },
  { label: "Gamma", words: ["C0", "C1", "C2", "C3"] },
  { label: "Ghost", words: ["G0", "G1", "G2", "G3"] },
];
const identity = (n: number) => Array.from({ length: n }, (_, i) => i);

describe("buildPuzzle + fairness gate", () => {
  it("builds a fair 16-word puzzle covering all tiles disjointly", () => {
    const p = buildPuzzle(groups, 3, ["Ghost", "X", "Y"], "puz-0000", identity);
    expect(p).not.toBeNull();
    expect(p!.words.length).toBe(16);
    expect(() => assertPuzzleValid(p!)).not.toThrow();
    expect(p!.categories.filter((c) => c.isGhost).length).toBe(1);
  });
  it("scramble remaps indices but keeps groups intact", () => {
    const scramble = (_n: number) => [15, 0, 14, 1, 13, 2, 12, 3, 11, 4, 10, 5, 9, 6, 8, 7];
    const p = buildPuzzle(groups, 3, ["Ghost", "X", "Y"], "puz-0001", scramble)!;
    // The ghost category's 4 display indices must still map to the 4 ghost words.
    const ghost = p.categories.find((c) => c.isGhost)!;
    const ghostWords = ghost.wordIdx.map((i) => p.words[i]).sort();
    expect(ghostWords).toEqual(["G0", "G1", "G2", "G3"]);
  });
  it("rejects overlapping groups", () => {
    const bad: Puzzle = {
      puzzleId: "x",
      words: Array.from({ length: 16 }, (_, i) => `W${i}`),
      categories: [
        { id: "c0", label: "A", wordIdx: [0, 1, 2, 3], isGhost: false },
        { id: "c1", label: "B", wordIdx: [3, 4, 5, 6], isGhost: false }, // overlaps 3
        { id: "c2", label: "C", wordIdx: [7, 8, 9, 10], isGhost: false },
        { id: "c3", label: "G", wordIdx: [11, 12, 13, 14], isGhost: true },
      ],
      ghostCandidates: ["G", "X", "Y"],
    };
    expect(isFairPuzzle(bad)).toBe(false);
  });
  it("rejects when ghost label absent from candidates", () => {
    const p = buildPuzzle(groups, 3, ["NotGhost", "X", "Y"], "puz-0002", identity);
    expect(p).toBeNull();
  });
});

describe("share (spoiler-safe)", () => {
  const state: AttemptState = {
    puzzleId: "puz-0000",
    dayId: "2026-07-25",
    solved: ["cat-0", "cat-1", "cat-2", "cat-3"],
    mistakes: 1,
    playState: "won",
    ghostPick: "Ghost",
    ghostCorrect: true,
    history: [true, false, true, true, true],
  };
  it("contains no words or labels", () => {
    const text = buildShareText(state, "2026-07-25");
    expect(isSpoilerSafe(text, ["A0", "B1"], ["Alpha", "Beta"])).toBe(true);
    expect(text).toContain("GG 2026-07-25");
    expect(text).toContain("👻+");
  });
});
