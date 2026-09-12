import { describe, it, expect } from "vitest";
import { isValidChain, buildPuzzles, assertPuzzlesValid, type CandidatePuzzle } from "../src/games/rhyme-chain/content-build.ts";
import type { RhymeDict } from "../src/games/rhyme-chain/types.ts";

const dict: RhymeDict = {
  light: "AIT", right: "AIT", kite: "AIT", night: "AIT",
  cat: "AT", hat: "AT",
};

// clue -> the dictionary words that answer it
const clueIndex: Record<string, string[]> = {
  "opposite of wrong": ["right"],
  "a flying toy": ["kite"],
  "a small pet": ["cat"],
  "ambiguous night-ish": ["night", "kite"], // two words -> ambiguous clue
};

describe("isValidChain (REQ-019/020)", () => {
  it("accepts an unbroken, unambiguous rhyme chain", () => {
    const cand: CandidatePuzzle = { seedWord: "light", slots: [{ clue: "opposite of wrong", answer: "right" }, { clue: "a flying toy", answer: "kite" }] };
    expect(isValidChain(cand, dict, clueIndex)).toBe(true);
  });

  it("rejects a broken rhyme chain (answer does not rhyme with previous)", () => {
    const cand: CandidatePuzzle = { seedWord: "light", slots: [{ clue: "a small pet", answer: "cat" }] };
    expect(isValidChain(cand, dict, clueIndex)).toBe(false);
  });

  it("rejects an ambiguous clue (maps to >1 rhyming word)", () => {
    const cand: CandidatePuzzle = { seedWord: "light", slots: [{ clue: "ambiguous night-ish", answer: "night" }] };
    expect(isValidChain(cand, dict, clueIndex)).toBe(false);
  });

  it("rejects unknown seed or answer", () => {
    expect(isValidChain({ seedWord: "zzz", slots: [{ clue: "opposite of wrong", answer: "right" }] }, dict, clueIndex)).toBe(false);
  });
});

describe("buildPuzzles + gate", () => {
  it("emits only valid chains with sequential ids", () => {
    const puzzles = buildPuzzles(
      [
        { seedWord: "light", slots: [{ clue: "opposite of wrong", answer: "right" }, { clue: "a flying toy", answer: "kite" }] },
        { seedWord: "light", slots: [{ clue: "a small pet", answer: "cat" }] }, // broken
      ],
      dict,
      clueIndex,
    );
    expect(puzzles).toHaveLength(1);
    expect(puzzles[0].puzzleId).toBe("puz-0000");
    expect(() => assertPuzzlesValid(puzzles, dict, clueIndex)).not.toThrow();
  });

  it("is deterministic", () => {
    const c = [{ seedWord: "light", slots: [{ clue: "opposite of wrong", answer: "right" }] }];
    expect(buildPuzzles(c, dict, clueIndex)).toEqual(buildPuzzles(c, dict, clueIndex));
  });
});
