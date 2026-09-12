import { describe, it, expect } from "vitest";
import { isValidSet, buildPuzzles, assertPuzzlesValid, type CandidateSet } from "../src/games/degrees/content-build.ts";

describe("isValidSet (REQ-018/019/020)", () => {
  it("accepts 5 distinct alpha words + label", () => {
    expect(isValidSet({ words: ["cool", "tepid", "warm", "hot", "scorching"], scaleLabel: "temperature" })).toBe(true);
  });
  it("rejects wrong length", () => {
    expect(isValidSet({ words: ["a", "b", "c", "d"], scaleLabel: "x" })).toBe(false);
  });
  it("rejects duplicates (case-insensitive)", () => {
    expect(isValidSet({ words: ["Warm", "warm", "hot", "cool", "icy"], scaleLabel: "t" })).toBe(false);
  });
  it("rejects empty label / non-alpha", () => {
    expect(isValidSet({ words: ["a", "b", "c", "d", "e"], scaleLabel: "" })).toBe(false);
    expect(isValidSet({ words: ["a1", "b", "c", "d", "e"], scaleLabel: "x" })).toBe(false);
  });
});

describe("buildPuzzles + gate", () => {
  it("emits valid sets with ids, drops invalid", () => {
    const cands: CandidateSet[] = [
      { words: ["cool", "tepid", "warm", "hot", "scorching"], scaleLabel: "temperature" },
      { words: ["a", "b", "c", "d"], scaleLabel: "bad" },
    ];
    const puzzles = buildPuzzles(cands);
    expect(puzzles).toHaveLength(1);
    expect(puzzles[0].puzzleId).toBe("puz-0000");
    expect(() => assertPuzzlesValid(puzzles)).not.toThrow();
  });
  it("is deterministic", () => {
    const c: CandidateSet[] = [{ words: ["tiny", "small", "medium", "large", "huge"], scaleLabel: "size" }];
    expect(buildPuzzles(c)).toEqual(buildPuzzles(c));
  });
});
