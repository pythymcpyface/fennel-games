import { describe, it, expect } from "vitest";
import { isFairSet, buildPuzzles, assertPuzzlesValid, type CandidateSet } from "../src/games/vowel-ghost/content-build.ts";

const dict = new Set(["APPLE", "ORANGE", "GRAPE", "LEMON", "PEACH", "GRIPE", "PRICE"]);
// rankBySkeleton: skeleton -> words most-common-first
const rank: Record<string, string[]> = {
  PPL: ["APPLE"],
  RNG: ["ORANGE"],
  GRP: ["GROUP", "GRIP", "GRAPE"], // GRAPE is only rank 3 -> not in top 2
  LMN: ["LEMON"],
  PCH: ["PEACH"],
};

describe("isFairSet (REQ-025, frequency-aware, top-2)", () => {
  it("rejects a set where the answer is outside the top-2 fillings (GRAPE is 3rd)", () => {
    expect(isFairSet({ words: ["APPLE", "ORANGE", "GRAPE", "LEMON", "PEACH"], themeLabel: "Fruit" }, dict, rank)).toBe(false);
  });
  it("accepts when every answer is within the top-2 fillings of its skeleton", () => {
    const rank2 = { ...rank, GRP: ["GRIPE", "GRAPE"] }; // GRAPE now rank 2
    expect(isFairSet({ words: ["APPLE", "ORANGE", "GRAPE", "LEMON", "PEACH"], themeLabel: "Fruit" }, dict, rank2)).toBe(true);
  });
  it("rejects wrong length / non-dictionary / empty label", () => {
    const r = { ...rank, GRP: ["GRAPE"] };
    expect(isFairSet({ words: ["APPLE"], themeLabel: "x" }, dict, r)).toBe(false);
    expect(isFairSet({ words: ["APPLE", "ORANGE", "GRAPE", "LEMON", "ZZZZ"], themeLabel: "x" }, dict, r)).toBe(false);
  });
});

describe("buildPuzzles + gate", () => {
  it("emits fair sets and computes skeletons", () => {
    const rank2 = { ...rank, GRP: ["GRIPE", "GRAPE"] };
    const cands: CandidateSet[] = [{ words: ["APPLE", "ORANGE", "GRAPE", "LEMON", "PEACH"], themeLabel: "Fruit" }];
    const puzzles = buildPuzzles(cands, dict, rank2);
    expect(puzzles).toHaveLength(1);
    expect(puzzles[0].skeletons).toEqual(["PPL", "RNG", "GRP", "LMN", "PCH"]);
    expect(() => assertPuzzlesValid(puzzles, dict, rank2)).not.toThrow();
  });
  it("drops sets whose answer is not the top filling", () => {
    const cands: CandidateSet[] = [{ words: ["APPLE", "ORANGE", "GRAPE", "LEMON", "PEACH"], themeLabel: "Fruit" }];
    expect(buildPuzzles(cands, dict, rank)).toHaveLength(0);
  });
});
