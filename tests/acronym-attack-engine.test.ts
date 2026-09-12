import { describe, it, expect } from "vitest";
import { normalizeWord, initAttempt, setWord, validate, submit, canSubmit } from "../src/games/acronym-attack/engine.ts";
import { buildShareText, isSpoilerSafe } from "../src/games/acronym-attack/share.ts";
import { isSolvable, buildPuzzles, assertPuzzlesValid, type CandidatePuzzle } from "../src/games/acronym-attack/content-build.ts";
import type { Puzzle } from "../src/games/acronym-attack/types.ts";

const puzzle: Puzzle = { puzzleId: "puz-0001", acronym: "MOON", theme: "Space" };
const dict = new Set(["MASSIVE", "ORBITING", "OBSERVATION", "NODE", "MOON", "OWL", "NAP"]);

describe("engine", () => {
  it("normalizeWord uppercases + strips", () => { expect(normalizeWord(" massive! ")).toBe("MASSIVE"); });
  it("setWord places a word at an index", () => {
    let a = initAttempt(puzzle, "2024-04-01");
    a = setWord(a, 0, "massive");
    expect(a.words[0]).toBe("MASSIVE");
  });
  it("validate: all letters start right + all dictionary => valid with score", () => {
    let a = initAttempt(puzzle, "2024-04-01");
    a = setWord(a, 0, "massive"); a = setWord(a, 1, "orbiting"); a = setWord(a, 2, "observation"); a = setWord(a, 3, "node");
    const r = validate(a, puzzle, dict);
    expect(r.valid).toBe(true);
    expect(r.score).toBe("MASSIVE".length + "ORBITING".length + "OBSERVATION".length + "NODE".length);
  });
  it("invalid when a word starts with the wrong letter", () => {
    let a = initAttempt(puzzle, "2024-04-01");
    a = setWord(a, 0, "owl"); // O, not M
    a = setWord(a, 1, "orbiting"); a = setWord(a, 2, "observation"); a = setWord(a, 3, "node");
    const r = validate(a, puzzle, dict);
    expect(r.valid).toBe(false);
    expect(r.perLetterOk[0]).toBe(false);
    expect(r.score).toBe(0);
  });
  it("invalid when a word is not in the dictionary", () => {
    let a = initAttempt(puzzle, "2024-04-01");
    a = setWord(a, 0, "mxyzptlk");
    const r = validate(a, puzzle, dict);
    expect(r.allDictionary).toBe(false);
    expect(r.valid).toBe(false);
  });
  it("submit sets won on a valid expansion", () => {
    let a = initAttempt(puzzle, "2024-04-01");
    a = setWord(a, 0, "massive"); a = setWord(a, 1, "orbiting"); a = setWord(a, 2, "observation"); a = setWord(a, 3, "node");
    const out = submit(a, puzzle, dict);
    expect(out.result.valid).toBe(true);
    expect(out.state.status).toBe("won");
    expect(canSubmit(out.state)).toBe(false);
  });
  it("is pure", () => {
    const a = initAttempt(puzzle, "2024-04-01");
    setWord(a, 0, "massive");
    expect(a.words[0]).toBe("");
  });
});

describe("content gate", () => {
  const wordsByInitial: Record<string, string[]> = { M: ["MASSIVE"], O: ["ORBITING"], N: ["NODE"] };
  it("solvable when each letter has a dictionary word", () => {
    expect(isSolvable({ acronym: "MOON", theme: "Space" }, wordsByInitial)).toBe(true);
  });
  it("unsolvable when a letter has no word", () => {
    expect(isSolvable({ acronym: "MOZ", theme: "x" }, wordsByInitial)).toBe(false);
  });
  it("rejects bad acronym / empty theme", () => {
    expect(isSolvable({ acronym: "M", theme: "x" }, wordsByInitial)).toBe(false);
    expect(isSolvable({ acronym: "MOON", theme: "" }, wordsByInitial)).toBe(false);
  });
  it("buildPuzzles emits solvable puzzles", () => {
    const cands: CandidatePuzzle[] = [{ acronym: "MOON", theme: "Space" }, { acronym: "MOZ", theme: "x" }];
    const puzzles = buildPuzzles(cands, wordsByInitial);
    expect(puzzles).toHaveLength(1);
    expect(() => assertPuzzlesValid(puzzles, wordsByInitial)).not.toThrow();
  });
});

describe("share", () => {
  it("spoiler-safe (excludes player words)", () => {
    let a = initAttempt(puzzle, "2024-04-01");
    a = setWord(a, 0, "massive");
    const text = buildShareText(a, puzzle, "2024-04-01", 0);
    expect(text).toContain("Acronym Attack 2024-04-01");
    expect(isSpoilerSafe(text, a.words)).toBe(true);
    expect(isSpoilerSafe("used MASSIVE", a.words)).toBe(false);
  });
});
