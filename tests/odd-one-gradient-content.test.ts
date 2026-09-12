import { describe, it, expect } from "vitest";
import { pickOdd, bucketHeat, isFairSet, buildPuzzles, assertPuzzlesValid, type CandidateSet } from "../src/games/odd-one-gradient/content-build.ts";
import { HEAT_MAX } from "../src/games/odd-one-gradient/types.ts";

const fair: CandidateSet = {
  words: ["apple", "banana", "grape", "hammer", "orange", "peach"],
  coldness: { apple: 8, banana: 9, grape: 27, hammer: 255, orange: 10, peach: 6 },
  themeLabel: "fruit",
};

describe("pickOdd", () => {
  it("selects the coldest word", () => expect(pickOdd(fair)).toBe("hammer"));
});

describe("bucketHeat", () => {
  it("buckets the outlier to HEAT_MAX and the tight majority near 0", () => {
    const scores = bucketHeat(fair);
    expect(scores.hammer.heat).toBe(HEAT_MAX);
    expect(scores.peach.heat).toBe(0);
  });
});

describe("isFairSet", () => {
  it("accepts a decisive outlier", () => expect(isFairSet(fair)).toBe(true));

  it("rejects an ambiguous set (two similar coldness peaks)", () => {
    const ambiguous: CandidateSet = {
      words: ["a", "b", "c", "d", "e", "f"],
      coldness: { a: 5, b: 5, c: 5, d: 5, e: 120, f: 118 },
      themeLabel: "x",
    };
    expect(isFairSet(ambiguous)).toBe(false);
  });

  it("rejects wrong size", () => {
    expect(isFairSet({ ...fair, words: fair.words.slice(0, 5) })).toBe(false);
  });

  it("rejects a missing theme", () => {
    expect(isFairSet({ ...fair, themeLabel: "  " })).toBe(false);
  });
});

describe("buildPuzzles + gate", () => {
  it("emits fair puzzles and passes assert", () => {
    const puzzles = buildPuzzles([fair]);
    expect(puzzles).toHaveLength(1);
    expect(puzzles[0].odd).toBe("hammer");
    expect(puzzles[0].puzzleId).toBe("puz-0000");
    expect(() => assertPuzzlesValid(puzzles)).not.toThrow();
  });

  it("drops ambiguous candidates", () => {
    const ambiguous: CandidateSet = {
      words: ["a", "b", "c", "d", "e", "f"],
      coldness: { a: 5, b: 5, c: 5, d: 5, e: 120, f: 118 },
      themeLabel: "x",
    };
    expect(buildPuzzles([ambiguous])).toHaveLength(0);
  });
});
