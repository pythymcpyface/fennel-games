import { describe, it, expect } from "vitest";
import { normalizeWord, isOneLetterChange, reverse, initAttempt, submitMove, findHint, canMove } from "../src/games/palindial/engine.ts";
import { buildShareText, isSpoilerSafe } from "../src/games/palindial/share.ts";
import { reachableSubgraph, buildPuzzle, buildPuzzles, assertPuzzlesValid } from "../src/games/palindial/content-build.ts";
import type { Puzzle } from "../src/games/palindial/types.ts";

// DEER <-> REED. Path: DEER -> DEED -> REED (one-letter changes).
const neighbors: Record<string, string[]> = {
  DEER: ["DEED", "BEER", "DEAR"],
  DEED: ["DEER", "REED", "FEED"],
  REED: ["DEED", "REEF", "FEED"],
  BEER: ["DEER"], DEAR: ["DEER"], FEED: ["DEED", "REED"], REEF: ["REED"],
};
const dict = new Set(Object.keys(neighbors));
const puzzle: Puzzle = { puzzleId: "puz-0001", startWord: "DEER", targetWord: "REED", moveBudget: 4, neighbors };

describe("engine", () => {
  it("reverse + one-letter-change", () => {
    expect(reverse("DEER")).toBe("REED");
    expect(isOneLetterChange("DEER", "DEED")).toBe(true);
    expect(isOneLetterChange("DEER", "REED")).toBe(false);
    expect(normalizeWord(" deed! ")).toBe("DEED");
  });
  it("valid move path to the reverse twin wins", () => {
    let a = initAttempt(puzzle, "2024-04-01");
    a = submitMove(a, puzzle, "DEED").state;
    const out = submitMove(a, puzzle, "REED");
    expect(out.ok).toBe(true);
    expect(out.state.status).toBe("won");
    expect(out.state.path).toEqual(["DEER", "DEED", "REED"]);
  });
  it("errors: wrong length / not one change / not a word", () => {
    const a = initAttempt(puzzle, "2024-04-01");
    expect(submitMove(a, puzzle, "DEEDS").error).toBe("WRONG_LENGTH");
    expect(submitMove(a, puzzle, "REED").error).toBe("NOT_ONE_LETTER_CHANGE");
    expect(submitMove(a, puzzle, "DXXR").error).toBe("NOT_ONE_LETTER_CHANGE");
  });
  it("loses when out of moves", () => {
    const p2: Puzzle = { ...puzzle, moveBudget: 1 };
    let a = initAttempt(p2, "2024-04-01");
    a = submitMove(a, p2, "BEER").state; // 1 move, not target
    expect(a.status).toBe("lost");
    expect(canMove(a)).toBe(false);
  });
  it("hint moves toward the target", () => {
    const a = initAttempt(puzzle, "2024-04-01");
    expect(findHint(a, puzzle)).toBe("DEED"); // DEER->DEED is on the shortest path to REED
  });
  it("is pure", () => {
    const a = initAttempt(puzzle, "2024-04-01");
    submitMove(a, puzzle, "DEED");
    expect(a.currentWord).toBe("DEER");
  });
});

describe("content gate", () => {
  it("reachableSubgraph bounds by budget", () => {
    const sub = reachableSubgraph("DEER", 1, neighbors);
    expect(Object.keys(sub).sort()).toEqual(["BEER", "DEAR", "DEED", "DEER"]);
  });
  it("buildPuzzle: reverse target reachable => valid", () => {
    const p = buildPuzzle({ startWord: "DEER", moveBudget: 4 }, neighbors, dict, "puz-0000")!;
    expect(p.targetWord).toBe("REED");
    expect(p.neighbors["REED"]).toBeDefined();
  });
  it("rejects palindrome / unreachable / non-word reverse", () => {
    expect(buildPuzzle({ startWord: "DEED", moveBudget: 4 }, neighbors, dict, "x")).toBeNull(); // DEED reversed is DEED
    expect(buildPuzzle({ startWord: "DEER", moveBudget: 1 }, neighbors, dict, "x")).toBeNull(); // REED not reachable in 1
  });
  it("buildPuzzles + assert", () => {
    const puzzles = buildPuzzles([{ startWord: "DEER", moveBudget: 4 }], neighbors, dict);
    expect(puzzles).toHaveLength(1);
    expect(() => assertPuzzlesValid(puzzles)).not.toThrow();
  });
});

describe("share", () => {
  it("spoiler-safe (no path words or target)", () => {
    let a = initAttempt(puzzle, "2024-04-01");
    a = submitMove(a, puzzle, "DEED").state;
    a = submitMove(a, puzzle, "REED").state;
    const text = buildShareText(a, puzzle, "2024-04-01");
    expect(text).toContain("Palindial 2024-04-01");
    expect(isSpoilerSafe(text, a.path, puzzle.targetWord)).toBe(true);
    expect(isSpoilerSafe("got REED", a.path, puzzle.targetWord)).toBe(false);
  });
});
