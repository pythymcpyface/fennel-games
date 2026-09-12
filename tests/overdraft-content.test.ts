import { describe, it, expect } from "vitest";
import {
  isInSetWord,
  findPositiveInSetWord,
  buildPuzzle,
  assertPuzzleValid,
  LETTER_POINTS,
} from "../src/games/overdraft/content-build.ts";
import { buildShareText, isSpoilerSafe, scoreBand } from "../src/games/overdraft/share.ts";
import type { AttemptState } from "../src/games/overdraft/types.ts";

const letterSet = ["A", "C", "E", "I", "O", "R", "S", "T"];
const candidates = ["CATS", "CARES", "REACTS", "CODING", "BREAD"];

describe("fairness gate", () => {
  it("isInSetWord detects words using only the set", () => {
    expect(isInSetWord("CATS", letterSet)).toBe(true);
    expect(isInSetWord("BREAD", letterSet)).toBe(false); // B,D outside
  });
  it("findPositiveInSetWord returns a positive-score in-set word", () => {
    const puzzle = buildPuzzle(letterSet, "p", candidates)!;
    const proof = findPositiveInSetWord(letterSet, puzzle, candidates);
    expect(proof).not.toBeNull();
    expect(isInSetWord(proof!, letterSet)).toBe(true);
  });
  it("LETTER_POINTS covers A-Z", () => {
    for (const ch of "ABCDEFGHIJKLMNOPQRSTUVWXYZ") expect(LETTER_POINTS[ch]).toBeGreaterThan(0);
  });
});

describe("buildPuzzle + gate", () => {
  it("builds a puzzle when a positive in-set word exists", () => {
    const p = buildPuzzle(letterSet, "puz-0000", candidates);
    expect(p).not.toBeNull();
    expect(() => assertPuzzleValid(p!, candidates)).not.toThrow();
    expect(p!.maxBorrow).toBe(2);
  });
  it("returns null when no in-set word exists in the candidate pool", () => {
    // A letter set with no matching candidate word.
    expect(buildPuzzle(["X", "Q", "Z", "J"], "x", candidates)).toBeNull();
  });
});

describe("share (spoiler-safe)", () => {
  it("scoreBand buckets by net score", () => {
    expect(scoreBand(0)).toBe("S0");
    expect(scoreBand(3)).toBe("S1");
    expect(scoreBand(25)).toBe("S5");
  });
  it("share text never contains the finalized word", () => {
    const state: AttemptState = { puzzleId: "puz-0000", dayId: "2026-07-25", finalWord: "CARES", netScore: 7, borrowedCount: 1, isComplete: true };
    const text = buildShareText(state, "2026-07-25");
    expect(isSpoilerSafe(text, "CARES")).toBe(true);
    expect(text).not.toContain("CARES");
    expect(text).toContain("Overdraft 2026-07-25");
    expect(text).toContain("borrow 1/2");
  });
});
