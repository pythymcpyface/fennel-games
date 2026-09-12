import { describe, it, expect } from "vitest";
import {
  scoreOne,
  scoreGuess,
  submit,
  initAttempt,
  canSubmit,
  isWellFormed,
  isValidGuess,
} from "../src/games/mirrorle/engine.ts";
import type { Puzzle } from "../src/games/mirrorle/types.ts";
import { GUESS_BUDGET, WORD_LEN } from "../src/games/mirrorle/types.ts";

const puzzle: Puzzle = { puzzleId: "puz-0000", secretA: "CRANE", secretB: "MOIST" };
const dict = new Set([
  "CRANE", "MOIST", "CRATE", "MOUSE", "PLANT", "STONE", "AUDIO", "RAISE", "MIRTH",
]);
// larger dict for budget-exhaustion test (9 distinct non-solving guesses)
const bigDict = new Set([
  "CRANE", "MOIST", "CRATE", "MOUSE", "PLANT", "STONE", "AUDIO", "RAISE", "MIRTH",
  "GRADE", "SLICE",
]);

describe("scoreOne (per-secret Wordle accounting)", () => {
  it("all greens on exact match", () => {
    expect(scoreOne("CRANE", "CRANE")).toEqual({ green: WORD_LEN, yellow: 0 });
  });
  it("counts greens and yellows without exceeding letter multiplicity", () => {
    // secret STONE, guess NOTES: N present, O green? positions:
    // guess N O T E S vs secret S T O N E
    // pos0 N/S no; pos1 O/T no; pos2 T/O no; pos3 E/N no; pos4 S/E no => 0 green
    // letters N,O,T,E,S all present once => 5 yellow
    expect(scoreOne("NOTES", "STONE")).toEqual({ green: 0, yellow: 5 });
  });
  it("does not double-count a duplicate guess letter beyond secret occurrences", () => {
    // guess EERIE vs secret CRANE, aligned: E-C E-R R-A I-N E-E
    // pos4 E==E => 1 green; secret's only E consumed => extra guess E's yield 0 yellow.
    // guess R (pos2) matches secret R (pos1) not-in-place => 1 yellow. So green1/yellow1.
    const r = scoreOne("EERIE", "CRANE");
    expect(r.green).toBe(1);
    expect(r.yellow).toBe(1);
  });
});

describe("scoreGuess (aggregated across both secrets)", () => {
  it("sums greens and yellows across A and B", () => {
    const a = scoreOne("CRATE", "CRANE"); // vs A
    const b = scoreOne("CRATE", "MOIST"); // vs B
    const agg = scoreGuess("CRATE", puzzle);
    expect(agg.green).toBe(a.green + b.green);
    expect(agg.yellow).toBe(a.yellow + b.yellow);
    expect(agg.guess).toBe("CRATE");
  });
  it("guessing secretA yields WORD_LEN green from A alone (plus any from B)", () => {
    const agg = scoreGuess("CRANE", puzzle);
    expect(agg.green).toBeGreaterThanOrEqual(WORD_LEN);
  });
});

describe("validation", () => {
  it("isWellFormed requires exactly 5 letters", () => {
    expect(isWellFormed("CRANE")).toBe(true);
    expect(isWellFormed("CRAN")).toBe(false);
    expect(isWellFormed("CRANES")).toBe(false);
    expect(isWellFormed("CR4NE")).toBe(false);
  });
  it("isValidGuess requires dictionary membership", () => {
    expect(isValidGuess("crane", dict)).toBe(true);
    expect(isValidGuess("zzzzz", dict)).toBe(false);
  });
});

describe("submit + state machine", () => {
  it("rejects non-dictionary words without consuming a row", () => {
    const s0 = initAttempt(puzzle, "2026-07-25");
    const out = submit(s0, puzzle, dict, "ZZZZZ");
    expect(out.accepted).toBe(false);
    expect(out.reason).toBe("dictionary");
    expect(out.state.rows.length).toBe(0);
  });
  it("rejects malformed guesses", () => {
    const s0 = initAttempt(puzzle, "2026-07-25");
    expect(submit(s0, puzzle, dict, "CR").reason).toBe("well-formed");
  });
  it("rejects duplicates", () => {
    let s = initAttempt(puzzle, "2026-07-25");
    s = submit(s, puzzle, dict, "CRATE").state;
    const dup = submit(s, puzzle, dict, "CRATE");
    expect(dup.accepted).toBe(false);
    expect(dup.reason).toBe("duplicate");
  });
  it("wins only when BOTH secrets have been solved", () => {
    let s = initAttempt(puzzle, "2026-07-25");
    s = submit(s, puzzle, dict, "CRANE").state; // solves A
    expect(s.isSolved).toBe(false); // B not solved yet
    const out = submit(s, puzzle, dict, "MOIST"); // solves B
    expect(out.solved).toBe(true);
    expect(out.state.isSolved).toBe(true);
  });
  it("fails after the guess budget with no solve", () => {
    let s = initAttempt(puzzle, "2026-07-25");
    // 9 distinct valid non-solving words to exhaust the budget.
    const words = ["CRATE", "MOUSE", "PLANT", "STONE", "AUDIO", "RAISE", "MIRTH", "GRADE", "SLICE"];
    for (const w of words) s = submit(s, puzzle, bigDict, w).state;
    expect(s.rows.length).toBe(GUESS_BUDGET);
    expect(s.isFailed).toBe(true);
    expect(s.isSolved).toBe(false);
    expect(canSubmit(s)).toBe(false);
  });
  it("blocks submission after terminal", () => {
    let s = initAttempt(puzzle, "2026-07-25");
    s = submit(s, puzzle, dict, "CRANE").state;
    s = submit(s, puzzle, dict, "MOIST").state;
    expect(s.isSolved).toBe(true);
    const after = submit(s, puzzle, dict, "CRATE");
    expect(after.accepted).toBe(false);
    expect(after.reason).toBe("terminal");
  });
  it("respects the guess budget constant", () => {
    expect(GUESS_BUDGET).toBe(9);
  });
});
