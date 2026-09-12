import { describe, it, expect } from "vitest";
import { initAttempt, setChoice, correctCount, submit, applyHint, canSubmit } from "../src/games/loan-ledger/engine.ts";
import { buildShareText, isSpoilerSafe } from "../src/games/loan-ledger/share.ts";
import { isValidSet, buildPuzzles, assertPuzzlesValid, type CandidateSet } from "../src/games/loan-ledger/content-build.ts";
import type { Puzzle } from "../src/games/loan-ledger/types.ts";

const items = [
  { word: "HYDROPHOBIA", morphemes: [{ part: "HYDRO", gloss: "water" }, { part: "PHOBIA", gloss: "fear" }], answer: "fear of water" },
  { word: "BIBLIOPHILE", morphemes: [{ part: "BIBLIO", gloss: "book" }, { part: "PHILE", gloss: "lover" }], answer: "lover of books" },
  { word: "CHRONOMETER", morphemes: [{ part: "CHRONO", gloss: "time" }, { part: "METER", gloss: "measure" }], answer: "measurer of time" },
  { word: "GEOLOGY", morphemes: [{ part: "GEO", gloss: "earth" }, { part: "LOGY", gloss: "study" }], answer: "study of the earth" },
  { word: "CARDIOLOGY", morphemes: [{ part: "CARDIO", gloss: "heart" }, { part: "LOGY", gloss: "study" }], answer: "study of the heart" },
];
const puzzle: Puzzle = { puzzleId: "puz-0001", items, options: [...items.map((i) => i.answer), "fear of heights"].sort() };

describe("engine", () => {
  it("setChoice + correctCount", () => {
    let a = initAttempt(puzzle, "2024-04-01");
    a = setChoice(a, 0, "fear of water");
    expect(correctCount(a.choices, puzzle)).toBe(1);
  });
  it("submit solves when all correct", () => {
    let a = initAttempt(puzzle, "2024-04-01");
    items.forEach((it, i) => { a = setChoice(a, i, it.answer); });
    const out = submit(a, puzzle);
    expect(out.solved).toBe(true);
    expect(out.state.status).toBe("solved");
  });
  it("wrong submit consumes attempt + locks correct", () => {
    let a = initAttempt(puzzle, "2024-04-01");
    a = setChoice(a, 0, "fear of water"); a = setChoice(a, 1, "fear of heights");
    const out = submit(a, puzzle);
    expect(out.correct).toBe(1);
    expect(out.state.locked[0]).toBe(true);
    expect(out.state.attemptsUsed).toBe(1);
  });
  it("fails after 4 wrong", () => {
    let a = initAttempt(puzzle, "2024-04-01");
    a = setChoice(a, 0, "fear of heights");
    for (let i = 0; i < 4; i++) a = submit(a, puzzle).state;
    expect(a.status).toBe("failed");
    expect(canSubmit(a)).toBe(false);
  });
  it("hint locks first unlocked", () => {
    const a = initAttempt(puzzle, "2024-04-01");
    const h = applyHint(a, puzzle)!;
    expect(h.choices[0]).toBe("fear of water");
    expect(h.locked[0]).toBe(true);
  });
  it("is pure", () => {
    const a = initAttempt(puzzle, "2024-04-01");
    setChoice(a, 0, "fear of water");
    expect(a.choices[0]).toBe("");
  });
});

describe("content gate", () => {
  it("valid set", () => { expect(isValidSet({ items })).toBe(true); });
  it("rejects <2 morphemes or dup words", () => {
    expect(isValidSet({ items: [{ word: "X", morphemes: [{ part: "X", gloss: "y" }], answer: "z" }, ...items.slice(1)] })).toBe(false);
  });
  it("buildPuzzles builds options with distractors", () => {
    const cands: CandidateSet[] = [{ items, extraOptions: ["fear of heights"] }];
    const puzzles = buildPuzzles(cands);
    expect(puzzles).toHaveLength(1);
    expect(puzzles[0].options).toContain("fear of heights");
    expect(() => assertPuzzlesValid(puzzles)).not.toThrow();
  });
});

describe("share", () => {
  it("spoiler-safe", () => {
    let a = initAttempt(puzzle, "2024-04-01");
    a = setChoice(a, 0, "fear of heights");
    a = submit(a, puzzle).state;
    const text = buildShareText(a, "2024-04-01");
    expect(text).toContain("Loan Ledger 2024-04-01");
    expect(isSpoilerSafe(text, puzzle)).toBe(true);
    expect(isSpoilerSafe("word HYDROPHOBIA", puzzle)).toBe(false);
  });
});
