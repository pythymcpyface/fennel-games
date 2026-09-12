import { describe, it, expect } from "vitest";
import { normalizeWord, areAntonyms, initAttempt, submitMove, findHint, canMove, bfsDistances } from "../src/games/antonym-bridge/engine.ts";
import { buildShareText, isSpoilerSafe } from "../src/games/antonym-bridge/share.ts";
import { isValid, buildPuzzles, assertPuzzlesValid } from "../src/games/antonym-bridge/content-build.ts";
import type { Puzzle } from "../src/games/antonym-bridge/types.ts";

// GIANT -> (big) -> SMALL -> (small) -> TINY chain via antonyms.
// antonyms: HOT/COLD, BIG/SMALL, GIANT/TINY, and bridges via shared words.
const antonyms: Record<string, string[]> = {
  HOT: ["COLD"],
  BIG: ["SMALL", "LITTLE"],
  GIANT: ["TINY"],
  FAST: ["SLOW"],
  HAPPY: ["SAD"],
  // chain: LOUD -> QUIET -> LOUD... make a 2-hop: WET->DRY, DRY->ARID? keep simple
  WET: ["DRY"],
  DRY: ["WET", "MOIST"],
  MOIST: ["DRY"],
};
const puzzle: Puzzle = { puzzleId: "puz-0001", startWord: "WET", targetWord: "MOIST", moveBudget: 3, antonyms };
// WET -antonym- DRY -antonym- MOIST : 2 hops

describe("engine", () => {
  it("normalize + antonym check", () => {
    expect(normalizeWord(" dry! ")).toBe("DRY");
    expect(areAntonyms("WET", "DRY", antonyms)).toBe(true);
    expect(areAntonyms("WET", "MOIST", antonyms)).toBe(false);
  });
  it("chain WET -> DRY -> MOIST wins", () => {
    let a = initAttempt(puzzle, "2024-04-01");
    a = submitMove(a, puzzle, "DRY").state;
    const out = submitMove(a, puzzle, "MOIST");
    expect(out.ok).toBe(true);
    expect(out.state.status).toBe("won");
    expect(out.state.path).toEqual(["WET", "DRY", "MOIST"]);
  });
  it("errors: not a word / not an antonym", () => {
    const a = initAttempt(puzzle, "2024-04-01");
    expect(submitMove(a, puzzle, "ZZZZ").error).toBe("NOT_A_WORD");
    expect(submitMove(a, puzzle, "MOIST").error).toBe("NOT_AN_ANTONYM"); // WET not antonym of MOIST
  });
  it("loses when out of moves", () => {
    const p2: Puzzle = { ...puzzle, moveBudget: 1 };
    let a = initAttempt(p2, "2024-04-01");
    a = submitMove(a, p2, "DRY").state; // 1 hop, not target
    expect(a.status).toBe("lost");
    expect(canMove(a)).toBe(false);
  });
  it("hint moves toward the target", () => {
    const a = initAttempt(puzzle, "2024-04-01");
    expect(findHint(a, puzzle)).toBe("DRY");
  });
  it("bfsDistances treats graph as undirected", () => {
    const dist = bfsDistances("WET", antonyms);
    expect(dist.get("DRY")).toBe(1);
    expect(dist.get("MOIST")).toBe(2);
  });
  it("is pure", () => {
    const a = initAttempt(puzzle, "2024-04-01");
    submitMove(a, puzzle, "DRY");
    expect(a.currentWord).toBe("WET");
  });
});

describe("content gate", () => {
  it("valid when target reachable within budget", () => {
    expect(isValid({ startWord: "WET", targetWord: "MOIST", moveBudget: 3 }, antonyms)).toBe(true);
  });
  it("invalid when unreachable / same word / over budget", () => {
    expect(isValid({ startWord: "WET", targetWord: "WET", moveBudget: 3 }, antonyms)).toBe(false);
    expect(isValid({ startWord: "WET", targetWord: "HAPPY", moveBudget: 3 }, antonyms)).toBe(false);
    expect(isValid({ startWord: "WET", targetWord: "MOIST", moveBudget: 1 }, antonyms)).toBe(false);
  });
  it("buildPuzzles + assert", () => {
    const puzzles = buildPuzzles([{ startWord: "WET", targetWord: "MOIST", moveBudget: 3 }], antonyms);
    expect(puzzles).toHaveLength(1);
    expect(() => assertPuzzlesValid(puzzles)).not.toThrow();
  });
});

describe("share", () => {
  it("spoiler-safe", () => {
    let a = initAttempt(puzzle, "2024-04-01");
    a = submitMove(a, puzzle, "DRY").state;
    a = submitMove(a, puzzle, "MOIST").state;
    const text = buildShareText(a, puzzle, "2024-04-01");
    expect(text).toContain("Antonym Bridge 2024-04-01");
    expect(isSpoilerSafe(text, a.path, puzzle.targetWord)).toBe(true);
    expect(isSpoilerSafe("got MOIST", a.path, puzzle.targetWord)).toBe(false);
  });
});
