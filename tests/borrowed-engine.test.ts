import { describe, it, expect } from "vitest";
import { initAttempt, setChoice, correctCount, submit, applyHint, canSubmit } from "../src/games/borrowed/engine.ts";
import { buildShareText, isSpoilerSafe } from "../src/games/borrowed/share.ts";
import { isValidSet, buildPuzzles, assertPuzzlesValid, type CandidateSet } from "../src/games/borrowed/content-build.ts";
import type { Puzzle } from "../src/games/borrowed/types.ts";

const puzzle: Puzzle = {
  puzzleId: "puz-0001",
  words: ["TSUNAMI", "SAFARI", "KETCHUP", "ROBOT", "PIANO"],
  answers: ["Japanese", "Swahili", "Hokkien", "Czech", "Italian"],
  options: ["Czech", "Hokkien", "Italian", "Japanese", "Swahili", "German"],
};

describe("engine", () => {
  it("setChoice assigns an option", () => {
    let a = initAttempt(puzzle, "2024-04-01");
    a = setChoice(a, 0, "Japanese");
    expect(a.choices[0]).toBe("Japanese");
  });
  it("correctCount counts matches", () => {
    expect(correctCount(["Japanese", "Swahili", "", "", ""], puzzle.answers)).toBe(2);
  });
  it("submit locks correct + counts + wins at all 5", () => {
    let a = initAttempt(puzzle, "2024-04-01");
    puzzle.answers.forEach((ans, i) => { a = setChoice(a, i, ans); });
    const out = submit(a, puzzle);
    expect(out.solved).toBe(true);
    expect(out.state.status).toBe("solved");
    expect(out.state.locked.every(Boolean)).toBe(true);
  });
  it("wrong submit consumes an attempt + locks the correct ones", () => {
    let a = initAttempt(puzzle, "2024-04-01");
    a = setChoice(a, 0, "Japanese"); a = setChoice(a, 1, "German"); // 1 correct
    const out = submit(a, puzzle);
    expect(out.correct).toBe(1);
    expect(out.state.attemptsUsed).toBe(1);
    expect(out.state.locked[0]).toBe(true);
    expect(out.state.locked[1]).toBe(false);
  });
  it("locked choice cannot be changed", () => {
    let a = initAttempt(puzzle, "2024-04-01");
    a = setChoice(a, 0, "Japanese");
    a = submit(a, puzzle).state; // locks 0
    a = setChoice(a, 0, "German");
    expect(a.choices[0]).toBe("Japanese");
  });
  it("fails after 4 wrong", () => {
    let a = initAttempt(puzzle, "2024-04-01");
    a = setChoice(a, 0, "German");
    for (let i = 0; i < 4; i++) a = submit(a, puzzle).state;
    expect(a.status).toBe("failed");
    expect(canSubmit(a)).toBe(false);
  });
  it("hint locks first unlocked correct", () => {
    const a = initAttempt(puzzle, "2024-04-01");
    const h = applyHint(a, puzzle)!;
    expect(h.choices[0]).toBe("Japanese");
    expect(h.locked[0]).toBe(true);
  });
  it("is pure", () => {
    const a = initAttempt(puzzle, "2024-04-01");
    setChoice(a, 0, "Japanese");
    expect(a.choices[0]).toBe("");
  });
});

describe("content gate", () => {
  it("valid set", () => {
    expect(isValidSet({ words: puzzle.words, answers: puzzle.answers })).toBe(true);
  });
  it("rejects wrong length / duplicate words", () => {
    expect(isValidSet({ words: ["A"], answers: ["x"] })).toBe(false);
  });
  it("buildPuzzles builds options incl. answers + distractors", () => {
    const cands: CandidateSet[] = [{ words: puzzle.words, answers: puzzle.answers, extraOptions: ["German"] }];
    const puzzles = buildPuzzles(cands);
    expect(puzzles).toHaveLength(1);
    expect(puzzles[0].options).toContain("German");
    expect(() => assertPuzzlesValid(puzzles)).not.toThrow();
  });
});

describe("share", () => {
  it("spoiler-safe", () => {
    let a = initAttempt(puzzle, "2024-04-01");
    a = setChoice(a, 0, "German");
    a = submit(a, puzzle).state;
    const text = buildShareText(a, "2024-04-01");
    expect(text).toContain("Borrowed 2024-04-01");
    expect(isSpoilerSafe(text, puzzle)).toBe(true);
    expect(isSpoilerSafe("word TSUNAMI", puzzle)).toBe(false);
    expect(isSpoilerSafe("from Japanese", puzzle)).toBe(false);
  });
});
