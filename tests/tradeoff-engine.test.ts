import { describe, it, expect } from "vitest";
import { SCRABBLE_VALUES, scoreWord, isOneLetterChange, normalizeWord, initAttempt, submitMove, findHint, currentScore } from "../src/games/tradeoff/engine.ts";
import { buildShareText, isSpoilerSafe } from "../src/games/tradeoff/share.ts";
import type { Puzzle } from "../src/games/tradeoff/types.ts";

// CAT(5) -> COT(5) -> COT... use a graph that climbs in value.
// values: C3 A1 T1=5 ; CAT->BAT(B3+A1+T1=5) ; CAT->CAB(3+1+3=7) ; CAB->CAD? keep simple.
const values = SCRABBLE_VALUES;
const neighbors: Record<string, string[]> = {
  CAT: ["BAT", "CAB", "COT"],
  BAT: ["CAT", "BAY"],
  CAB: ["CAT", "CAY"],
  COT: ["CAT", "COY"],
  CAY: ["CAB"],
  COY: ["COT"],
  BAY: ["BAT"],
};
const puzzle: Puzzle = {
  puzzleId: "puz-0001",
  startWord: "CAT",
  swapBudget: 3,
  parScore: 7, // CAB = 7
  letterValues: values,
  neighbors,
};

describe("scoring + rules", () => {
  it("scoreWord sums letter values", () => {
    expect(scoreWord("CAT", values)).toBe(5); // 3+1+1
    expect(scoreWord("CAB", values)).toBe(7); // 3+1+3
  });
  it("isOneLetterChange TEST-010/011", () => {
    expect(isOneLetterChange("CAT", "CAB")).toBe(true);
    expect(isOneLetterChange("CAT", "CAT")).toBe(false);
    expect(isOneLetterChange("CAT", "DOG")).toBe(false);
    expect(isOneLetterChange("CAT", "CATS")).toBe(false);
  });
  it("normalizeWord uppercases + strips", () => {
    expect(normalizeWord(" cab! ")).toBe("CAB");
  });
});

describe("submitMove (REQ-005..016)", () => {
  it("TEST-014/015/016: valid move updates word, history, swaps", () => {
    const a = initAttempt(puzzle, "2024-04-01");
    const r = submitMove(a, puzzle, "cab");
    expect(r.ok).toBe(true);
    expect(r.state.currentWord).toBe("CAB");
    expect(r.state.moveHistory).toEqual(["CAT", "CAB"]);
    expect(r.state.swapsUsed).toBe(1);
  });
  it("TEST-023: reaching par wins", () => {
    const a = initAttempt(puzzle, "2024-04-01");
    const r = submitMove(a, puzzle, "cab"); // score 7 == par
    expect(r.state.winState).toBe("won");
  });
  it("errors: wrong length / not one change / not in dict", () => {
    const a = initAttempt(puzzle, "2024-04-01");
    expect(submitMove(a, puzzle, "cats").error).toBe("WRONG_LENGTH");
    expect(submitMove(a, puzzle, "dog").error).toBe("NOT_ONE_LETTER_CHANGE");
    expect(submitMove(a, puzzle, "cax").error).toBe("NOT_IN_DICTIONARY");
  });
  it("TEST-018: no moves after ended", () => {
    let a = initAttempt(puzzle, "2024-04-01");
    a = submitMove(a, puzzle, "cab").state; // win
    expect(submitMove(a, puzzle, "cat").error).toBe("ALREADY_ENDED");
  });
  it("TEST-024: loses when budget exhausted below par", () => {
    // budget 1 puzzle that cannot reach par in 1 move to a low-value cycle
    const lowPar: Puzzle = { ...puzzle, swapBudget: 1, parScore: 999 };
    let a = initAttempt(lowPar, "2024-04-01");
    a = submitMove(a, lowPar, "bat").state; // score 5 < 999, budget used
    expect(a.winState).toBe("lost");
  });
  it("is pure", () => {
    const a = initAttempt(puzzle, "2024-04-01");
    submitMove(a, puzzle, "cab");
    expect(a.currentWord).toBe("CAT");
  });
});

describe("findHint (REQ-017/018)", () => {
  it("returns a score-improving neighbor (deterministic lowest)", () => {
    const a = initAttempt(puzzle, "2024-04-01");
    expect(findHint(a, puzzle)).toBe("CAB"); // only improving neighbor (7 > 5)
  });
  it("null when no improving neighbor", () => {
    // CAY = 3+1+4 = 8; its only neighbor CAB = 7 (< 8) => no improving hint
    const a = { ...initAttempt(puzzle, "2024-04-01"), currentWord: "CAY" };
    expect(findHint(a, puzzle)).toBeNull();
  });
});

describe("share (REQ-021)", () => {
  it("shows swaps + progress bar, spoiler-safe", () => {
    let a = initAttempt(puzzle, "2024-04-01");
    a = submitMove(a, puzzle, "cab").state;
    const text = buildShareText(a, puzzle, "2024-04-01");
    expect(text).toContain("Tradeoff 2024-04-01 1/3");
    expect(text).toMatch(/[🟩⬛]/u);
    expect(isSpoilerSafe(text, a.moveHistory)).toBe(true);
    expect(text.toUpperCase()).not.toContain("CAB");
  });
  it("currentScore reflects word", () => {
    const a = initAttempt(puzzle, "2024-04-01");
    expect(currentScore(a, puzzle)).toBe(5);
  });
});
