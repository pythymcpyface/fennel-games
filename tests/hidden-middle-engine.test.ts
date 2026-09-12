import { describe, it, expect } from "vitest";
import { normalizeGuess, isSubstringOf, initAttempt, submit, canSubmit } from "../src/games/hidden-middle/engine.ts";
import { applyHint } from "../src/games/hidden-middle/hint.ts";
import { buildShareText, isSpoilerSafe } from "../src/games/hidden-middle/share.ts";
import type { Puzzle } from "../src/games/hidden-middle/types.ts";

const puzzle: Puzzle = { puzzleId: "puz-0001", carrierWord: "SCANDALOUS", clue: "a quick look", answerWord: "SCAN" };
const dict = new Set(["SCAN", "SCANDAL", "CAN", "LOUS", "DAL", "SAD"]);

describe("normalizeGuess (REQ-006)", () => {
  it("trims, uppercases, strips non A-Z", () => {
    expect(normalizeGuess(" scan! ")).toBe("SCAN");
    expect(normalizeGuess("Café")).toBe("CAF");
  });
});

describe("isSubstringOf (REQ-007)", () => {
  it("TEST-009/010: contiguous substring check", () => {
    expect(isSubstringOf("SCAN", "SCANDALOUS")).toBe(true);
    expect(isSubstringOf("SAD", "SCANDALOUS")).toBe(false); // not contiguous
  });
});

describe("submit (REQ-004..016)", () => {
  it("TEST-013: correct answer solves", () => {
    const a = initAttempt(puzzle, "2024-04-01");
    const out = submit(a, puzzle, "scan", dict);
    expect(out.result).toBe("CORRECT");
    expect(out.state.status).toBe("solved");
    expect(out.state.incorrectAttemptsUsed).toBe(0);
  });

  it("TEST-014: incorrect consumes an attempt + feedback flags", () => {
    const a = initAttempt(puzzle, "2024-04-01");
    const out = submit(a, puzzle, "scandal", dict); // substring + word, but not the answer
    expect(out.result).toBe("INCORRECT");
    expect(out.state.incorrectAttemptsUsed).toBe(1);
    expect(out.feedback).toEqual({ isSubstring: true, isDictionaryWord: true });
  });

  it("feedback distinguishes substring vs dictionary", () => {
    const a = initAttempt(puzzle, "2024-04-01");
    const out = submit(a, puzzle, "sad", dict); // real word, NOT a substring
    expect(out.feedback).toEqual({ isSubstring: false, isDictionaryWord: true });
  });

  it("TEST-019: duplicate guess does not consume an attempt", () => {
    let a = initAttempt(puzzle, "2024-04-01");
    a = submit(a, puzzle, "scandal", dict).state; // 1 attempt
    const out = submit(a, puzzle, "SCANDAL", dict); // duplicate (normalized)
    expect(out.result).toBe("DUPLICATE");
    expect(out.state.incorrectAttemptsUsed).toBe(1);
    expect(out.state.guessHistory).toHaveLength(1);
  });

  it("empty guess is a no-op", () => {
    const a = initAttempt(puzzle, "2024-04-01");
    expect(submit(a, puzzle, "   ", dict).result).toBe("EMPTY");
  });

  it("TEST-016: fails after 6 incorrect", () => {
    let a = initAttempt(puzzle, "2024-04-01");
    for (const w of ["scandal", "can", "lous", "dal", "sad", "cans"]) a = submit(a, puzzle, w, dict).state;
    expect(a.status).toBe("failed");
    expect(canSubmit(a)).toBe(false);
  });

  it("TEST-005: no mutation after solve", () => {
    let a = initAttempt(puzzle, "2024-04-01");
    a = submit(a, puzzle, "scan", dict).state;
    expect(submit(a, puzzle, "can", dict).result).toBe("EMPTY");
  });

  it("is pure", () => {
    const a = initAttempt(puzzle, "2024-04-01");
    submit(a, puzzle, "scandal", dict);
    expect(a.guessHistory).toHaveLength(0);
  });
});

describe("hint (REQ-015)", () => {
  it("TEST-018: reveals start index + length, no attempt consumed", () => {
    const a = initAttempt(puzzle, "2024-04-01");
    const h = applyHint(a, puzzle)!;
    expect(h.startIndex).toBe(0); // SCAN at index 0 of SCANDALOUS
    expect(h.length).toBe(4);
    expect(h.state.hintRevealed).toBe(true);
    expect(h.state.incorrectAttemptsUsed).toBe(0);
  });
});

describe("share (REQ-017)", () => {
  it("blocks per attempt + solve, spoiler-safe", () => {
    let a = initAttempt(puzzle, "2024-04-01");
    a = submit(a, puzzle, "scandal", dict).state;
    a = submit(a, puzzle, "scan", dict).state;
    const text = buildShareText(a, "2024-04-01");
    expect(text).toContain("Hidden Middle 2024-04-01 2/6");
    expect(isSpoilerSafe(text, puzzle)).toBe(true);
    expect(text.toUpperCase()).not.toContain("SCAN");
    expect(text.toUpperCase()).not.toContain("SCANDALOUS");
  });

  it("isSpoilerSafe flags leaks", () => {
    expect(isSpoilerSafe("answer SCAN", puzzle)).toBe(false);
    expect(isSpoilerSafe("carrier SCANDALOUS", puzzle)).toBe(false);
    expect(isSpoilerSafe("a quick look", puzzle)).toBe(false);
  });
});
