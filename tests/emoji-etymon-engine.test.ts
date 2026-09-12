import { describe, it, expect } from "vitest";
import { normalize, computeReveal, initAttempt, submit, useHint, canGuess } from "../src/games/emoji-etymon/engine.ts";
import { buildShareText, isSpoilerSafe } from "../src/games/emoji-etymon/share.ts";
import { isValid, buildPuzzles, assertPuzzlesValid, type CandidatePuzzle } from "../src/games/emoji-etymon/content-build.ts";
import type { Puzzle } from "../src/games/emoji-etymon/types.ts";

const puzzle: Puzzle = { puzzleId: "puz-0001", emoji: "🐝🍃", answer: "BELIEF", hintText: "bee + leaf" };

describe("engine", () => {
  it("normalize", () => { expect(normalize(" belief! ")).toBe("BELIEF"); });
  it("computeReveal two-pass duplicates", () => {
    expect(computeReveal("BELIEF", "BELIEF")).toEqual(["EXACT", "EXACT", "EXACT", "EXACT", "EXACT", "EXACT"]);
    expect(computeReveal("ZZZZZZ", "BELIEF")).toEqual(["ABSENT", "ABSENT", "ABSENT", "ABSENT", "ABSENT", "ABSENT"]);
  });
  it("correct guess wins", () => {
    const a = initAttempt(puzzle, "2024-04-01");
    const out = submit(a, puzzle, "belief");
    expect(out.won).toBe(true);
    expect(out.state.status).toBe("won");
  });
  it("wrong-length rejected without a row", () => {
    const a = initAttempt(puzzle, "2024-04-01");
    const out = submit(a, puzzle, "bee");
    expect(out.ok).toBe(false);
    expect(out.error).toBe("WRONG_LENGTH");
    expect(out.state.rows).toHaveLength(0);
  });
  it("duplicate rejected", () => {
    let a = initAttempt(puzzle, "2024-04-01");
    a = submit(a, puzzle, "batter").state;
    expect(submit(a, puzzle, "BATTER").error).toBe("DUPLICATE");
  });
  it("loses after 6 wrong guesses", () => {
    let a = initAttempt(puzzle, "2024-04-01");
    for (const w of ["batter", "bother", "banter", "bitter", "butter", "barter"]) a = submit(a, puzzle, w).state;
    expect(a.status).toBe("lost");
    expect(canGuess(a)).toBe(false);
  });
  it("useHint sets flag", () => {
    expect(useHint(initAttempt(puzzle, "2024-04-01")).hintUsed).toBe(true);
  });
  it("is pure", () => {
    const a = initAttempt(puzzle, "2024-04-01");
    submit(a, puzzle, "batter");
    expect(a.rows).toHaveLength(0);
  });
});

describe("content gate", () => {
  it("valid rebus", () => { expect(isValid({ emoji: "🐝🍃", answer: "BELIEF", hintText: "bee+leaf" })).toBe(true); });
  it("rejects empty emoji / short / no hint", () => {
    expect(isValid({ emoji: "", answer: "BELIEF", hintText: "x" })).toBe(false);
    expect(isValid({ emoji: "🐝", answer: "AB", hintText: "x" })).toBe(false);
    expect(isValid({ emoji: "🐝", answer: "BELIEF", hintText: "" })).toBe(false);
  });
  it("buildPuzzles + assert", () => {
    const cands: CandidatePuzzle[] = [{ emoji: "🐝🍃", answer: "belief", hintText: "bee+leaf" }];
    const puzzles = buildPuzzles(cands);
    expect(puzzles).toHaveLength(1);
    expect(puzzles[0].answer).toBe("BELIEF");
    expect(() => assertPuzzlesValid(puzzles)).not.toThrow();
  });
});

describe("share", () => {
  it("includes emoji + is spoiler-safe (no answer)", () => {
    let a = initAttempt(puzzle, "2024-04-01");
    a = submit(a, puzzle, "batter").state;
    const text = buildShareText(a, puzzle, "2024-04-01");
    expect(text).toContain("🐝🍃");
    expect(isSpoilerSafe(text, puzzle.answer)).toBe(true);
    expect(isSpoilerSafe("it was BELIEF", puzzle.answer)).toBe(false);
  });
});
