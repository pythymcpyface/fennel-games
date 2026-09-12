import { describe, it, expect } from "vitest";
import { margin, isFairTrail, buildPuzzles, assertPuzzlesValid, type CandidateTrail } from "../src/games/twin-trails/content-build.ts";

// margins: A-words have rankA much smaller than rankB (positive margin), B inverse.
const fair: CandidateTrail = {
  labelA: "sea",
  labelB: "woods",
  words: [
    { word: "tide", rankA: 3, rankB: 90, side: "A" },
    { word: "wave", rankA: 5, rankB: 88, side: "A" },
    { word: "reef", rankA: 8, rankB: 95, side: "A" },
    { word: "shore", rankA: 2, rankB: 70, side: "A" },
    { word: "pine", rankA: 92, rankB: 4, side: "B" },
    { word: "oak", rankA: 85, rankB: 6, side: "B" },
    { word: "moss", rankA: 99, rankB: 9, side: "B" },
    { word: "fern", rankA: 80, rankB: 3, side: "B" },
  ],
};

describe("margin", () => {
  it("is positive for A-leaning words", () => {
    expect(margin(fair.words[0])).toBe(87);
  });
  it("is negative for B-leaning words", () => {
    expect(margin(fair.words[4])).toBe(-88);
  });
});

describe("isFairTrail", () => {
  it("accepts decisively-split balanced trails", () => {
    expect(isFairTrail(fair)).toBe(true);
  });

  it("rejects when a word is a near coin-flip", () => {
    const flip: CandidateTrail = {
      ...fair,
      words: [{ ...fair.words[0], rankA: 40, rankB: 55 }, ...fair.words.slice(1)],
    };
    expect(isFairTrail(flip)).toBe(false);
  });

  it("rejects unbalanced sides", () => {
    const unbal: CandidateTrail = {
      ...fair,
      words: [...fair.words.slice(0, 5).map((w) => ({ ...w, side: "A" as const })), ...fair.words.slice(5)],
    };
    expect(isFairTrail(unbal)).toBe(false);
  });

  it("rejects missing labels", () => {
    expect(isFairTrail({ ...fair, labelA: " " })).toBe(false);
  });
});

describe("buildPuzzles + gate", () => {
  it("emits fair puzzles and passes assert", () => {
    const puzzles = buildPuzzles([fair]);
    expect(puzzles).toHaveLength(1);
    expect(puzzles[0].words).toHaveLength(8);
    expect(puzzles[0].puzzleId).toBe("puz-0000");
    expect(() => assertPuzzlesValid(puzzles)).not.toThrow();
  });

  it("drops unfair candidates", () => {
    const flip: CandidateTrail = {
      ...fair,
      words: [{ ...fair.words[0], rankA: 40, rankB: 55 }, ...fair.words.slice(1)],
    };
    expect(buildPuzzles([flip])).toHaveLength(0);
  });
});
