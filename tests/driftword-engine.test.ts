import { describe, it, expect } from "vitest";
import {
  score,
  targetIndexForTurn,
  targetForTurn,
  isWellFormed,
  isValidGuess,
  initAttempt,
  submit,
  canSubmit,
} from "../src/games/driftword/engine.ts";
import type { Puzzle } from "../src/games/driftword/types.ts";
import { GUESS_BUDGET } from "../src/games/driftword/types.ts";

const puzzle: Puzzle = { puzzleId: "puz-0000", path: ["CRANE", "CRATE", "GRATE", "GRACE", "TRACE", "TRICE"] };
const dict = new Set([...puzzle.path, "SLATE", "AUDIO", "PLANT", "MOIST", "BRACE", "FJORD", "NYMPH"]);

describe("score (Wordle two-pass)", () => {
  it("all green on exact", () => {
    expect(score("CRANE", "CRANE")).toEqual(["G", "G", "G", "G", "G"]);
  });
  it("marks present-wrong-position as Y", () => {
    // guess SLATE vs CRANE: S x, L x, A(pos2) vs A(pos2 in CRANE? C R A N E) => A is pos2 in both => G
    // compute precisely
    expect(score("SLATE", "CRANE")).toEqual(["X", "X", "G", "X", "G"]);
  });
});

describe("drift targeting", () => {
  it("targetIndexForTurn clamps to path end", () => {
    expect(targetIndexForTurn(0, 6)).toBe(0);
    expect(targetIndexForTurn(3, 6)).toBe(3);
    expect(targetIndexForTurn(9, 6)).toBe(5);
  });
  it("targetForTurn returns the drifted word", () => {
    expect(targetForTurn(puzzle, 0)).toBe("CRANE");
    expect(targetForTurn(puzzle, 2)).toBe("GRATE");
  });
});

describe("validation", () => {
  it("isWellFormed requires 5 letters", () => {
    expect(isWellFormed("CRANE")).toBe(true);
    expect(isWellFormed("CRAN")).toBe(false);
  });
  it("isValidGuess needs dictionary membership", () => {
    expect(isValidGuess("crane", dict)).toBe(true);
    expect(isValidGuess("zzzzz", dict)).toBe(false);
  });
});

describe("submit + drift", () => {
  it("turn 0 scores against path[0]; guessing it wins", () => {
    const s0 = initAttempt(puzzle, "d");
    const out = submit(s0, puzzle, dict, "CRANE");
    expect(out.solved).toBe(true);
    expect(out.row?.targetIndex).toBe(0);
  });
  it("turn 1 scores against the DRIFTED target path[1]", () => {
    let s = initAttempt(puzzle, "d");
    s = submit(s, puzzle, dict, "SLATE").state; // wrong on turn 0
    const out = submit(s, puzzle, dict, "CRATE"); // path[1] is CRATE -> should win
    expect(out.row?.targetIndex).toBe(1);
    expect(out.solved).toBe(true);
  });
  it("rejects non-dictionary and malformed without consuming a turn", () => {
    const s0 = initAttempt(puzzle, "d");
    expect(submit(s0, puzzle, dict, "ZZZZZ").reason).toBe("dictionary");
    expect(submit(s0, puzzle, dict, "CR").reason).toBe("well-formed");
    expect(submit(s0, puzzle, dict, "ZZZZZ").state.rows.length).toBe(0);
  });
  it("loses after the budget without catching the drift", () => {
    let s = initAttempt(puzzle, "d");
    // 6 distinct valid words, none equal to that turn's drifted target.
    const wrong = ["SLATE", "AUDIO", "PLANT", "MOIST", "FJORD", "NYMPH"];
    for (let i = 0; i < GUESS_BUDGET; i++) s = submit(s, puzzle, dict, wrong[i]).state;
    expect(s.rows.length).toBe(GUESS_BUDGET);
    expect(s.isFailed).toBe(true);
    expect(canSubmit(s)).toBe(false);
  });
});
