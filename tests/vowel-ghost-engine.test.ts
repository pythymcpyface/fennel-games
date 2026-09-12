import { describe, it, expect } from "vitest";
import { normalize, stripVowels, firstVowelPosition, initAttempt, submit, applyHint, attemptsRemaining, canSubmit } from "../src/games/vowel-ghost/engine.ts";
import { buildShareText, isSpoilerSafe } from "../src/games/vowel-ghost/share.ts";
import type { Puzzle } from "../src/games/vowel-ghost/types.ts";

const puzzle: Puzzle = {
  puzzleId: "puz-0001",
  words: ["APPLE", "ORANGE", "GRAPE", "LEMON", "PEACH"],
  skeletons: ["PPL", "RNG", "GRP", "LMN", "PCH"],
  themeLabel: "Fruit",
};
const dict = new Set(["APPLE", "ORANGE", "GRAPE", "LEMON", "PEACH", "GRIPE", "PEACHY"]);

describe("string ops", () => {
  it("normalize", () => { expect(normalize(" grape! ")).toBe("GRAPE"); });
  it("stripVowels (REQ-006) — Y not a vowel", () => {
    expect(stripVowels("ORANGE")).toBe("RNG");
    expect(stripVowels("MYTH")).toBe("MYTH");
  });
  it("firstVowelPosition (REQ-019)", () => {
    expect(firstVowelPosition("ORANGE")).toBe(1);
    expect(firstVowelPosition("GRAPE")).toBe(3);
    expect(firstVowelPosition("MYTH")).toBeNull();
  });
});

describe("submit (REQ-005..017)", () => {
  it("correct answer solves that word", () => {
    const a = initAttempt(puzzle, "2024-04-01");
    const out = submit(a, puzzle, 0, "apple", dict);
    expect(out.correct).toBe(true);
    expect(out.state.solved[0]).toBe(true);
  });
  it("solving all 5 wins", () => {
    let a = initAttempt(puzzle, "2024-04-01");
    puzzle.words.forEach((w, i) => { a = submit(a, puzzle, i, w, dict).state; });
    expect(a.status).toBe("won");
  });
  it("wrong answer consumes a shared attempt + feedback", () => {
    const a = initAttempt(puzzle, "2024-04-01");
    const out = submit(a, puzzle, 2, "gripe", dict); // dict word, strips to GRP == skeleton, but not GRAPE
    expect(out.correct).toBe(false);
    expect(out.feedback).toEqual({ isDictionaryWord: true, isSkeletonMatch: true });
    expect(out.state.attemptsUsed).toBe(1);
  });
  it("non-dictionary + skeleton mismatch feedback", () => {
    const a = initAttempt(puzzle, "2024-04-01");
    const out = submit(a, puzzle, 0, "zzzz", dict);
    expect(out.feedback).toEqual({ isDictionaryWord: false, isSkeletonMatch: false });
  });
  it("REQ-011: empty input consumes no attempt", () => {
    const a = initAttempt(puzzle, "2024-04-01");
    const out = submit(a, puzzle, 0, "  ", dict);
    expect(out.empty).toBe(true);
    expect(out.state.attemptsUsed).toBe(0);
  });
  it("already-solved word is a no-op", () => {
    let a = initAttempt(puzzle, "2024-04-01");
    a = submit(a, puzzle, 0, "apple", dict).state;
    expect(submit(a, puzzle, 0, "apple", dict).alreadySolved).toBe(true);
  });
  it("REQ-016: loses after 8 wrong", () => {
    let a = initAttempt(puzzle, "2024-04-01");
    for (let i = 0; i < 8; i++) a = submit(a, puzzle, 0, "zzzz", dict).state;
    expect(a.status).toBe("lost");
    expect(attemptsRemaining(a)).toBe(0);
    expect(canSubmit(a)).toBe(false);
  });
  it("is pure", () => {
    const a = initAttempt(puzzle, "2024-04-01");
    submit(a, puzzle, 0, "apple", dict);
    expect(a.solved[0]).toBe(false);
  });
});

describe("hint (REQ-019/020)", () => {
  it("reveals first vowel position + marks used", () => {
    const a = initAttempt(puzzle, "2024-04-01");
    const h = applyHint(a, puzzle, 1)!; // ORANGE -> pos 1
    expect(h.position).toBe(1);
    expect(h.state.hintUsed[1]).toBe(true);
  });
});

describe("share (REQ-021/022)", () => {
  it("shows solved grid, spoiler-safe", () => {
    let a = initAttempt(puzzle, "2024-04-01");
    a = submit(a, puzzle, 0, "apple", dict).state;
    const text = buildShareText(a, "2024-04-01");
    expect(text).toContain("Vowel Ghost 2024-04-01");
    expect(isSpoilerSafe(text, puzzle, a.status)).toBe(true);
    expect(text.toUpperCase()).not.toContain("APPLE");
    expect(text.toUpperCase()).not.toContain("FRUIT");
  });
  it("flags leaks", () => {
    const a = initAttempt(puzzle, "2024-04-01");
    expect(isSpoilerSafe("has APPLE", puzzle, a.status)).toBe(false);
  });
});
