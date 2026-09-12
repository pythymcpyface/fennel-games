import { describe, it, expect } from "vitest";
import { initAttempt, setChoice, correctCount, submit, applyHint, canSubmit } from "../src/games/stress-test/engine.ts";
import { buildShareText, isSpoilerSafe } from "../src/games/stress-test/share.ts";
import { isValidSet, buildPuzzles, assertPuzzlesValid, type CandidateSet } from "../src/games/stress-test/content-build.ts";
import type { Puzzle } from "../src/games/stress-test/types.ts";

const items = [
  { word: "RECORD", syllables: ["RE", "CORD"], stressedIndex: 0, sense: "a disc/document" },
  { word: "PRESENT", syllables: ["PRE", "SENT"], stressedIndex: 0, sense: "a gift" },
  { word: "OBJECT", syllables: ["OB", "JECT"], stressedIndex: 0, sense: "a thing" },
  { word: "CONTEST", syllables: ["CON", "TEST"], stressedIndex: 0, sense: "a competition" },
  { word: "PERMIT", syllables: ["PER", "MIT"], stressedIndex: 0, sense: "a licence" },
];
const puzzle: Puzzle = { puzzleId: "puz-0001", items };

describe("engine", () => {
  it("setChoice + correctCount", () => {
    let a = initAttempt(puzzle, "2024-04-01");
    a = setChoice(a, 0, 0);
    expect(correctCount(a.choices, puzzle)).toBe(1);
  });
  it("submit solves when all correct", () => {
    let a = initAttempt(puzzle, "2024-04-01");
    items.forEach((it, i) => { a = setChoice(a, i, it.stressedIndex); });
    const out = submit(a, puzzle);
    expect(out.solved).toBe(true);
    expect(out.state.status).toBe("solved");
  });
  it("wrong consumes attempt, locks correct", () => {
    let a = initAttempt(puzzle, "2024-04-01");
    a = setChoice(a, 0, 0); a = setChoice(a, 1, 1);
    const out = submit(a, puzzle);
    expect(out.correct).toBe(1);
    expect(out.state.locked[0]).toBe(true);
  });
  it("fails after 4 wrong", () => {
    let a = initAttempt(puzzle, "2024-04-01");
    a = setChoice(a, 0, 1);
    for (let i = 0; i < 4; i++) a = submit(a, puzzle).state;
    expect(a.status).toBe("failed");
    expect(canSubmit(a)).toBe(false);
  });
  it("hint locks first unlocked", () => {
    const a = initAttempt(puzzle, "2024-04-01");
    const h = applyHint(a, puzzle)!;
    expect(h.choices[0]).toBe(0);
    expect(h.locked[0]).toBe(true);
  });
});

describe("content gate", () => {
  it("valid set", () => { expect(isValidSet({ items })).toBe(true); });
  it("rejects syllables that don't reconstruct the word", () => {
    expect(isValidSet({ items: [{ word: "RECORD", syllables: ["RE", "CARD"], stressedIndex: 0 }, ...items.slice(1)] })).toBe(false);
  });
  it("rejects stressedIndex out of range", () => {
    expect(isValidSet({ items: [{ word: "RECORD", syllables: ["RE", "CORD"], stressedIndex: 5 }, ...items.slice(1)] })).toBe(false);
  });
  it("buildPuzzles + assert", () => {
    const cands: CandidateSet[] = [{ items }];
    const puzzles = buildPuzzles(cands);
    expect(puzzles).toHaveLength(1);
    expect(() => assertPuzzlesValid(puzzles)).not.toThrow();
  });
});

describe("share", () => {
  it("spoiler-safe", () => {
    let a = initAttempt(puzzle, "2024-04-01");
    a = setChoice(a, 0, 1);
    a = submit(a, puzzle).state;
    const text = buildShareText(a, "2024-04-01");
    expect(text).toContain("Stress Test 2024-04-01");
    expect(isSpoilerSafe(text, puzzle)).toBe(true);
    expect(isSpoilerSafe("word RECORD", puzzle)).toBe(false);
  });
});
