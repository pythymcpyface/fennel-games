import { describe, it, expect } from "vitest";
import {
  isWellFormed,
  normalize,
  borrowedLetters,
  baseScore,
  evaluate,
  canSubmitWord,
  initAttempt,
  submit,
} from "../src/games/overdraft/engine.ts";
import type { Puzzle } from "../src/games/overdraft/types.ts";

// Letter set C,A,T,S,E,R,O,I. Points: standard-ish.
const puzzle: Puzzle = {
  puzzleId: "puz-0000",
  letterSet: ["A", "C", "E", "I", "O", "R", "S", "T"],
  letterPoints: { A: 1, C: 3, E: 1, I: 1, O: 1, R: 1, S: 1, T: 1, B: 3, D: 2, N: 1, G: 2, L: 1 },
  scoringMethod: "LETTER_SUM",
  maxBorrow: 2,
  borrowPenalty: 4,
};
const dict = new Set(["CATS", "CARES", "REACTS", "CODING", "BREAD", "CARIES"]);

describe("borrow accounting", () => {
  it("borrowedLetters are those outside the set", () => {
    expect(borrowedLetters("CATS", puzzle.letterSet)).toEqual([]);
    expect(borrowedLetters("CODING", puzzle.letterSet)).toEqual(["D", "N", "G"]); // D,N,G not in set
  });
  it("in-set letters reuse freely", () => {
    expect(borrowedLetters("SASS", ["A", "S"])).toEqual([]);
  });
});

describe("scoring", () => {
  it("baseScore by LETTER_SUM", () => {
    expect(baseScore("CATS", puzzle)).toBe(3 + 1 + 1 + 1); // C3 A1 T1 S1 = 6
  });
  it("baseScore by LENGTH", () => {
    expect(baseScore("CATS", { ...puzzle, scoringMethod: "LENGTH" })).toBe(4);
  });
  it("evaluate computes penalty and net", () => {
    // CARES: all in set -> 0 borrow. C3 A1 R1 E1 S1 = 7 net 7.
    const ev = evaluate("CARES", puzzle, dict);
    expect(ev.borrowedCount).toBe(0);
    expect(ev.penalty).toBe(0);
    expect(ev.netScore).toBe(7);
    expect(ev.inDictionary).toBe(true);
  });
  it("evaluate penalises borrowed letters", () => {
    // BREAD: B,D borrowed (2). base B3 R1 E1 A1 D2 = 8, penalty 2*4=8, net 0.
    const ev = evaluate("BREAD", puzzle, dict);
    expect(ev.borrowedCount).toBe(2);
    expect(ev.penalty).toBe(8);
    expect(ev.netScore).toBe(0);
    expect(ev.overLimit).toBe(false);
  });
  it("flags over the borrow limit", () => {
    // CODING: D,N,G borrowed (3) > maxBorrow 2 -> overLimit.
    const ev = evaluate("CODING", puzzle, dict);
    expect(ev.borrowedCount).toBe(3);
    expect(ev.overLimit).toBe(true);
  });
});

describe("validation + submit", () => {
  it("isWellFormed + normalize", () => {
    expect(isWellFormed("cats")).toBe(true);
    expect(isWellFormed("c-a")).toBe(false);
    expect(normalize(" cats ")).toBe("CATS");
  });
  it("canSubmitWord requires dict + within limit", () => {
    expect(canSubmitWord("CARES", puzzle, dict)).toBe(true);
    expect(canSubmitWord("CODING", puzzle, dict)).toBe(false); // over limit
    expect(canSubmitWord("ZZZZ", puzzle, dict)).toBe(false); // not a word
  });
  it("submit finalizes exactly one word and records net score", () => {
    const s0 = initAttempt(puzzle, "d");
    const out = submit(s0, puzzle, dict, "CARES");
    expect(out.accepted).toBe(true);
    expect(out.state.isComplete).toBe(true);
    expect(out.state.netScore).toBe(7);
    // no resubmission
    expect(submit(out.state, puzzle, dict, "CATS").reason).toBe("complete");
  });
  it("rejects over-limit and non-dictionary submissions", () => {
    const s0 = initAttempt(puzzle, "d");
    expect(submit(s0, puzzle, dict, "CODING").reason).toBe("over-limit");
    expect(submit(s0, puzzle, dict, "ZZZZ").reason).toBe("dictionary");
  });
});
