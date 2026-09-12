import { describe, it, expect } from "vitest";
import { initAttempt, evaluateGuess, submit, canGuess } from "../src/games/odd-sense/engine.ts";
import { applyHint } from "../src/games/odd-sense/hint.ts";
import { buildShareText, isSpoilerSafe } from "../src/games/odd-sense/share.ts";
import type { Puzzle } from "../src/games/odd-sense/types.ts";

const puzzle: Puzzle = {
  puzzleId: "puz-0001",
  words: ["BAT", "GLOVE", "PITCH", "DIAMOND", "MOLE"],
  oddWordIndex: 4, // MOLE
  themeLabel: "Baseball",
  oddCategoryLabel: "Animal",
  hintEliminationIndex: 0, // BAT (themed, non-odd)
};

describe("evaluateGuess (REQ-008)", () => {
  it("TEST-015/016: correct only on odd index", () => {
    expect(evaluateGuess(4, 4)).toBe("CORRECT");
    expect(evaluateGuess(0, 4)).toBe("INCORRECT");
  });
});

describe("submit (REQ-009..012)", () => {
  it("TEST-020: correct guess solves", () => {
    const a = initAttempt(puzzle, "2024-04-01");
    const out = submit(a, puzzle, 4)!;
    expect(out.result).toBe("CORRECT");
    expect(out.state.state).toBe("solved");
    expect(out.state.remainingAttempts).toBe(4);
  });

  it("TEST-019: incorrect decrements attempts and records history", () => {
    const a = initAttempt(puzzle, "2024-04-01");
    const out = submit(a, puzzle, 0)!;
    expect(out.result).toBe("INCORRECT");
    expect(out.state.remainingAttempts).toBe(3);
    expect(out.state.guessHistory).toHaveLength(1);
    expect(out.state.guessHistory[0].attemptNumber).toBe(1);
  });

  it("fails after 4 wrong guesses", () => {
    let a = initAttempt(puzzle, "2024-04-01");
    for (const i of [0, 1, 2, 3]) a = submit(a, puzzle, i)!.state;
    expect(a.state).toBe("failed");
    expect(canGuess(a)).toBe(false);
  });

  it("TEST-014: unset/out-of-range selection is a no-op (null)", () => {
    const a = initAttempt(puzzle, "2024-04-01");
    expect(submit(a, puzzle, -1)).toBeNull();
    expect(submit(a, puzzle, 99)).toBeNull();
  });

  it("REQ-015: cannot submit an eliminated word", () => {
    let a = initAttempt(puzzle, "2024-04-01");
    a = applyHint(a, puzzle)!; // eliminates index 0
    expect(submit(a, puzzle, 0)).toBeNull();
  });

  it("TEST-021: no mutation after solve", () => {
    let a = initAttempt(puzzle, "2024-04-01");
    a = submit(a, puzzle, 4)!.state; // solved
    expect(submit(a, puzzle, 1)).toBeNull();
  });

  it("is pure (prev unchanged)", () => {
    const a = initAttempt(puzzle, "2024-04-01");
    submit(a, puzzle, 0);
    expect(a.guessHistory).toHaveLength(0);
  });
});

describe("hint (REQ-013/014)", () => {
  it("TEST-022: eliminates a non-odd word", () => {
    const a = initAttempt(puzzle, "2024-04-01");
    const h = applyHint(a, puzzle)!;
    expect(h.eliminatedWordIndex).toBe(0);
    expect(h.eliminatedWordIndex).not.toBe(puzzle.oddWordIndex);
    expect(h.hintUsed).toBe(true);
  });

  it("cannot be used twice", () => {
    let a = initAttempt(puzzle, "2024-04-01");
    a = applyHint(a, puzzle)!;
    expect(applyHint(a, puzzle)).toBeNull();
  });

  it("no-op when not in progress", () => {
    const a = { ...initAttempt(puzzle, "2024-04-01"), state: "solved" as const };
    expect(applyHint(a, puzzle)).toBeNull();
  });
});

describe("share (REQ-018/019)", () => {
  it("blocks per attempt + solve, spoiler-safe", () => {
    let a = initAttempt(puzzle, "2024-04-01");
    a = submit(a, puzzle, 0)!.state; // wrong
    a = submit(a, puzzle, 4)!.state; // solve
    const text = buildShareText(a, "2024-04-01");
    expect(text).toContain("Odd Sense 2024-04-01 2/4");
    expect(isSpoilerSafe(text, puzzle)).toBe(true);
    expect(text.toUpperCase()).not.toContain("MOLE");
    expect(text.toUpperCase()).not.toContain("BASEBALL");
  });

  it("isSpoilerSafe flags a leak of a word or label", () => {
    expect(isSpoilerSafe("it was MOLE", puzzle)).toBe(false);
    expect(isSpoilerSafe("theme Baseball", puzzle)).toBe(false);
  });

  it("failed puzzle shows X/4", () => {
    let a = initAttempt(puzzle, "2024-04-01");
    for (const i of [0, 1, 2, 3]) a = submit(a, puzzle, i)!.state;
    expect(buildShareText(a, "2024-04-01")).toContain("X/4");
  });
});
