import { describe, it, expect } from "vitest";
import {
  lettersOf,
  totalLettersUsed,
  remainingInventory,
  canAfford,
  initAttempt,
  coverage,
  isHistogramMet,
  submit,
  removeWord,
  score,
} from "../src/games/ration/engine.ts";
import type { Puzzle } from "../src/games/ration/types.ts";

// Inventory affords RATE(4), TEAR(4), EAT(3), ATE(3), REACT(5) with sharing.
const puzzle: Puzzle = {
  puzzleId: "puz-0000",
  inventory: { R: 2, A: 3, T: 3, E: 3, C: 1 },
  targets: [{ length: 5, count: 1 }, { length: 4, count: 1 }, { length: 3, count: 1 }],
};
const dict = new Set(["REACT", "RATE", "TEAR", "EAT", "ATE", "CAT", "RAT"]);

describe("letter accounting", () => {
  it("lettersOf counts letters", () => {
    expect(lettersOf("RATE")).toEqual({ R: 1, A: 1, T: 1, E: 1 });
    expect(lettersOf("EEL")).toEqual({ E: 2, L: 1 });
  });
  it("totalLettersUsed sums across words", () => {
    expect(totalLettersUsed(["RAT", "EAT"])).toEqual({ R: 1, A: 2, T: 2, E: 1 });
  });
  it("remainingInventory subtracts spent letters", () => {
    const rem = remainingInventory(puzzle, ["RAT"]);
    expect(rem.R).toBe(1);
    expect(rem.A).toBe(2);
    expect(rem.T).toBe(2);
  });
  it("canAfford respects the shared budget", () => {
    expect(canAfford(puzzle, [], "REACT")).toBe(true);
    // spend both R's via RATE + REACT would need R:2 -> ok, but then RAT needs another R
    expect(canAfford(puzzle, ["RATE", "REACT"], "RAT")).toBe(false); // no R left
  });
});

describe("coverage + completion", () => {
  it("coverage caps at required per length", () => {
    const cov = coverage(["RATE", "TEAR", "EAT"], puzzle.targets);
    expect(cov[4]).toBe(1); // required 1, two 4-letter words -> capped at 1
    expect(cov[3]).toBe(1);
    expect(cov[5]).toBe(0);
  });
  it("isHistogramMet needs every bucket satisfied", () => {
    expect(isHistogramMet(["REACT", "RATE", "EAT"], puzzle.targets)).toBe(true);
    expect(isHistogramMet(["RATE", "EAT"], puzzle.targets)).toBe(false); // no 5-letter
  });
});

describe("submit", () => {
  it("accepts affordable dictionary words and completes on histogram", () => {
    let s = initAttempt(puzzle, "d");
    s = submit(s, puzzle, dict, "REACT").state;
    s = submit(s, puzzle, dict, "RATE").state;
    const out = submit(s, puzzle, dict, "EAT");
    expect(out.solved).toBe(true);
    expect(out.state.isComplete).toBe(true);
  });
  it("rejects non-dictionary / unaffordable / duplicate", () => {
    let s = initAttempt(puzzle, "d");
    expect(submit(s, puzzle, dict, "ZZZ").reason).toBe("dictionary");
    s = submit(s, puzzle, dict, "REACT").state; // uses C
    expect(submit(s, puzzle, dict, "CAT").reason).toBe("inventory"); // C already spent
    s = submit(s, puzzle, dict, "RATE").state;
    expect(submit(s, puzzle, dict, "RATE").reason).toBe("duplicate");
  });
  it("removeWord restores letters", () => {
    let s = initAttempt(puzzle, "d");
    s = submit(s, puzzle, dict, "REACT").state;
    expect(canAfford(puzzle, s.words, "CAT")).toBe(false);
    s = removeWord(s, "REACT");
    expect(canAfford(puzzle, s.words, "CAT")).toBe(true);
  });
  it("score sums word lengths", () => {
    expect(score(["RATE", "EAT"])).toBe(7);
  });
});
