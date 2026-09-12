import { describe, it, expect } from "vitest";
import { normalize, areHomophones, initAttempt, submit, attemptsRemaining, hintLetter, canSubmit } from "../src/games/homophone-heist/engine.ts";
import { buildShareText, isSpoilerSafe } from "../src/games/homophone-heist/share.ts";
import { isValid, buildPuzzles, assertPuzzlesValid, type CandidatePuzzle } from "../src/games/homophone-heist/content-build.ts";
import type { Puzzle } from "../src/games/homophone-heist/types.ts";

// EYE SCREAM FOUR -> I SCREAM FOR (homophones)
const homophones: Record<string, string[]> = {
  EYE: ["I", "AYE"], I: ["EYE", "AYE"], FOUR: ["FOR", "FORE"], FOR: ["FOUR", "FORE"], SCREAM: ["SCREAM"],
};
const puzzle: Puzzle = { puzzleId: "puz-0001", shownTokens: ["EYE", "SCREAM", "FOUR"], answers: ["I", "SCREAM", "FOR"] };

describe("engine", () => {
  it("normalize + homophone check", () => {
    expect(normalize(" for! ")).toBe("FOR");
    expect(areHomophones("EYE", "I", homophones)).toBe(true);
    expect(areHomophones("EYE", "FOR", homophones)).toBe(false);
  });
  it("correct guess solves a slot", () => {
    const a = initAttempt(puzzle, "2024-04-01");
    const out = submit(a, puzzle, 0, "i", homophones);
    expect(out.correct).toBe(true);
    expect(out.state.solved[0]).toBe(true);
  });
  it("solving all wins", () => {
    let a = initAttempt(puzzle, "2024-04-01");
    puzzle.answers.forEach((w, i) => { a = submit(a, puzzle, i, w, homophones).state; });
    expect(a.status).toBe("won");
  });
  it("wrong consumes attempt + homophone feedback", () => {
    const a = initAttempt(puzzle, "2024-04-01");
    const out = submit(a, puzzle, 0, "aye", homophones); // homophone of EYE but not the answer I
    expect(out.correct).toBe(false);
    expect(out.feedback?.isHomophone).toBe(true);
    expect(out.state.attemptsUsed).toBe(1);
  });
  it("empty consumes no attempt; already-solved no-op", () => {
    let a = initAttempt(puzzle, "2024-04-01");
    expect(submit(a, puzzle, 0, "  ", homophones).empty).toBe(true);
    a = submit(a, puzzle, 0, "i", homophones).state;
    expect(submit(a, puzzle, 0, "i", homophones).alreadySolved).toBe(true);
  });
  it("loses after 6 wrong", () => {
    let a = initAttempt(puzzle, "2024-04-01");
    for (let i = 0; i < 6; i++) a = submit(a, puzzle, 0, "zzz", homophones).state;
    expect(a.status).toBe("lost");
    expect(attemptsRemaining(a)).toBe(0);
    expect(canSubmit(a)).toBe(false);
  });
  it("hintLetter reveals first letter", () => {
    expect(hintLetter(puzzle, 0)).toBe("I");
  });
  it("is pure", () => {
    const a = initAttempt(puzzle, "2024-04-01");
    submit(a, puzzle, 0, "i", homophones);
    expect(a.solved[0]).toBe(false);
  });
});

describe("content gate", () => {
  it("valid when each shown token is a homophone of the answer", () => {
    expect(isValid({ shownTokens: ["EYE", "SCREAM", "FOUR"], answers: ["I", "SCREAM", "FOR"] }, homophones)).toBe(true);
  });
  it("rejects when a shown token is not a homophone of its answer", () => {
    expect(isValid({ shownTokens: ["EYE", "DOG"], answers: ["I", "FOR"] }, homophones)).toBe(false);
  });
  it("buildPuzzles + assert", () => {
    const cands: CandidatePuzzle[] = [{ shownTokens: ["EYE", "SCREAM", "FOUR"], answers: ["I", "SCREAM", "FOR"] }];
    const puzzles = buildPuzzles(cands, homophones);
    expect(puzzles).toHaveLength(1);
    expect(() => assertPuzzlesValid(puzzles, homophones)).not.toThrow();
  });
});

describe("share", () => {
  it("spoiler-safe", () => {
    let a = initAttempt(puzzle, "2024-04-01");
    a = submit(a, puzzle, 1, "scream", homophones).state;
    const text = buildShareText(a, "2024-04-01");
    expect(text).toContain("Homophone Heist 2024-04-01");
    expect(isSpoilerSafe(text, puzzle)).toBe(true);
    expect(isSpoilerSafe("was SCREAM", puzzle)).toBe(false);
  });
});
