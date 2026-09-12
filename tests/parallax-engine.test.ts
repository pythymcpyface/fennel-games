import { describe, it, expect } from "vitest";
import {
  initAttempt,
  submit,
  canSubmit,
  isWellFormed,
  isValidGuess,
  normalize,
} from "../src/games/parallax/engine.ts";
import type { Puzzle } from "../src/games/parallax/types.ts";
import { GUESS_BUDGET, CLOSENESS_MAX } from "../src/games/parallax/types.ts";

const puzzle: Puzzle = {
  puzzleId: "puz-0000",
  anchorA: "OCEAN",
  anchorB: "DESERT",
  target: "COAST",
  table: {
    COAST: { balance: "BALANCED", closeness: CLOSENESS_MAX },
    BEACH: { balance: "A", closeness: 7 },
    DUNE: { balance: "B", closeness: 6 },
    APPLE: { balance: "A", closeness: 1 },
  },
};

describe("validation", () => {
  it("isWellFormed accepts letter words, rejects junk", () => {
    expect(isWellFormed("COAST")).toBe(true);
    expect(isWellFormed("")).toBe(false);
    expect(isWellFormed("a1c")).toBe(false);
  });
  it("isValidGuess requires table membership", () => {
    expect(isValidGuess("beach", puzzle)).toBe(true);
    expect(isValidGuess("zzzz", puzzle)).toBe(false);
  });
  it("normalize uppercases + trims", () => {
    expect(normalize("  CoAsT ")).toBe("COAST");
  });
});

describe("submit + state machine", () => {
  it("rejects out-of-vocab words without a row", () => {
    const s0 = initAttempt(puzzle, "2026-07-25");
    const out = submit(s0, puzzle, "ZZZZ");
    expect(out.accepted).toBe(false);
    expect(out.reason).toBe("vocab");
    expect(out.state.rows.length).toBe(0);
  });
  it("records balance + closeness for a valid guess", () => {
    const s0 = initAttempt(puzzle, "2026-07-25");
    const out = submit(s0, puzzle, "beach");
    expect(out.accepted).toBe(true);
    expect(out.row).toEqual({ guess: "BEACH", balance: "A", closeness: 7 });
  });
  it("rejects duplicates", () => {
    let s = initAttempt(puzzle, "2026-07-25");
    s = submit(s, puzzle, "BEACH").state;
    expect(submit(s, puzzle, "beach").reason).toBe("duplicate");
  });
  it("wins when the target is guessed", () => {
    const s0 = initAttempt(puzzle, "2026-07-25");
    const out = submit(s0, puzzle, "COAST");
    expect(out.solved).toBe(true);
    expect(out.state.isSolved).toBe(true);
  });
  it("fails after the guess budget with no solve", () => {
    let s = initAttempt(puzzle, "2026-07-25");
    // Build a puzzle whose vocab has >= GUESS_BUDGET distinct non-target words.
    const big: Puzzle = { ...puzzle, table: { COAST: { balance: "BALANCED", closeness: CLOSENESS_MAX } } };
    const pool: string[] = [];
    for (let i = 0; i < GUESS_BUDGET; i++) {
      const w = `WORD${String.fromCharCode(65 + i)}`; // WORDA, WORDB, ... distinct
      big.table[w] = { balance: "A", closeness: 0 };
      pool.push(w);
    }
    for (let i = 0; i < GUESS_BUDGET; i++) s = submit(s, big, pool[i]).state;
    expect(s.rows.length).toBe(GUESS_BUDGET);
    expect(s.isFailed).toBe(true);
    expect(canSubmit(s)).toBe(false);
  });
  it("blocks submission after terminal", () => {
    let s = initAttempt(puzzle, "2026-07-25");
    s = submit(s, puzzle, "COAST").state;
    expect(submit(s, puzzle, "BEACH").reason).toBe("terminal");
  });
  it("budget is 12", () => {
    expect(GUESS_BUDGET).toBe(12);
  });
});
