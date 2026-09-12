import { describe, it, expect } from "vitest";
import {
  permutations,
  isUniqueUpToReversal,
  buildPuzzle,
  assertPuzzleValid,
} from "../src/games/seam/content-build.ts";
import { linkKey } from "../src/games/seam/engine.ts";
import { buildShareText, isSpoilerSafe } from "../src/games/seam/share.ts";
import type { AttemptState } from "../src/games/seam/types.ts";

describe("permutations", () => {
  it("generates n! orderings", () => {
    expect(permutations(4).length).toBe(24);
    expect(permutations(3).length).toBe(6);
  });
});

describe("uniqueness gate", () => {
  it("a path chain 0-1-2-3-4 is unique up to reversal", () => {
    const links = new Set<string>();
    for (let i = 0; i < 4; i++) links.add(linkKey(i, i + 1));
    expect(isUniqueUpToReversal(5, links)).toBe(true);
  });
  it("a chain with an extra cross-link is NOT unique", () => {
    const links = new Set<string>();
    for (let i = 0; i < 4; i++) links.add(linkKey(i, i + 1));
    links.add(linkKey(0, 4)); // makes a cycle -> multiple perfect paths
    expect(isUniqueUpToReversal(5, links)).toBe(false);
  });
});

describe("buildPuzzle", () => {
  const identityScramble = (n: number) => Array.from({ length: n }, (_, i) => i);
  it("builds a valid puzzle and round-trips the solved reading", () => {
    const chain = ["FIRE", "FLY", "PAPER", "BACK", "BONE"];
    const p = buildPuzzle(chain, "puz-0000", identityScramble);
    expect(p).not.toBeNull();
    const solvedReading = p!.solution.map((i) => p!.words[i]);
    expect(solvedReading).toEqual(chain.map((w) => w.toUpperCase()));
    expect(() => assertPuzzleValid(p!)).not.toThrow();
  });
  it("scrambled display still round-trips to the chain", () => {
    const chain = ["SUN", "FLOWER", "POT", "LUCK", "DRAW"];
    const scramble = (_n: number) => [2, 0, 4, 1, 3]; // arbitrary permutation
    const p = buildPuzzle(chain, "puz-0001", scramble)!;
    const solvedReading = p.solution.map((i) => p.words[i]);
    expect(solvedReading).toEqual(chain.map((w) => w.toUpperCase()));
    expect(() => assertPuzzleValid(p)).not.toThrow();
  });
});

describe("share (spoiler-safe)", () => {
  const state: AttemptState = {
    puzzleId: "puz-0000",
    dayId: "2026-07-25",
    order: [0, 1, 2, 3, 4],
    attempts: 2,
    isSolved: true,
    history: [2, 4],
  };
  const words = ["PAPER", "FLY", "BONE", "FIRE", "BACK"];
  it("never contains a puzzle word", () => {
    const text = buildShareText(state, "2026-07-25", 4);
    expect(isSpoilerSafe(text, words)).toBe(true);
    for (const w of words) expect(text).not.toContain(w);
  });
  it("shows the day id and try count when solved", () => {
    const text = buildShareText(state, "2026-07-25", 4);
    expect(text).toContain("Seam 2026-07-25");
    expect(text).toContain("2 tries");
  });
});
