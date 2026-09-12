import { describe, it, expect } from "vitest";
import { spend, isAchievable, buildPuzzle, assertPuzzleValid } from "../src/games/ration/content-build.ts";
import { buildShareText, isSpoilerSafe } from "../src/games/ration/share.ts";
import type { AttemptState, LetterCounts, TargetBucket } from "../src/games/ration/types.ts";

const inventory: LetterCounts = { R: 2, A: 3, T: 3, E: 3, C: 1 };
const candidates = ["REACT", "RATE", "TEAR", "EAT", "ATE", "CAT", "RAT"];
const targets: TargetBucket[] = [{ length: 5, count: 1 }, { length: 4, count: 1 }, { length: 3, count: 1 }];

describe("spend", () => {
  it("deducts letters or returns null if unaffordable", () => {
    expect(spend({ R: 1, A: 1, T: 1 }, "RAT")).toEqual({ R: 0, A: 0, T: 0 });
    expect(spend({ R: 0, A: 1, T: 1 }, "RAT")).toBeNull();
  });
});

describe("isAchievable (fairness gate solver)", () => {
  it("confirms a solvable histogram from shared inventory", () => {
    expect(isAchievable(inventory, targets, candidates)).toBe(true);
  });
  it("rejects when inventory is too small", () => {
    expect(isAchievable({ R: 1, A: 1, T: 1 }, targets, candidates)).toBe(false);
  });
  it("trivially true for empty targets", () => {
    expect(isAchievable(inventory, [], candidates)).toBe(true);
  });
});

describe("buildPuzzle + gate", () => {
  it("builds an achievable puzzle", () => {
    const p = buildPuzzle(inventory, targets, candidates, "puz-0000");
    expect(p).not.toBeNull();
    expect(() => assertPuzzleValid(p!, candidates)).not.toThrow();
  });
  it("returns null for an unachievable puzzle", () => {
    expect(buildPuzzle({ R: 1 }, targets, candidates, "x")).toBeNull();
  });
});

describe("share (spoiler-safe)", () => {
  const state: AttemptState = { puzzleId: "puz-0000", dayId: "2026-07-25", words: ["REACT", "RATE", "EAT"], isComplete: true };
  it("never contains a submitted word", () => {
    const text = buildShareText(state, targets, "2026-07-25");
    expect(isSpoilerSafe(text, state.words)).toBe(true);
    for (const w of state.words) expect(text).not.toContain(w);
  });
  it("shows day id and per-length coverage", () => {
    const text = buildShareText(state, targets, "2026-07-25");
    expect(text).toContain("Ration 2026-07-25");
    expect(text).toContain("5:");
  });
});
