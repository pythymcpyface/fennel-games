import { describe, it, expect } from "vitest";
import { areAdjacent, isValidPath, matchAnswer, initAttempt, submitTrace, isWon, hintTarget, canSpendHint, spendHint } from "../src/games/semantic-gradient/engine.ts";
import type { Puzzle } from "../src/games/semantic-gradient/types.ts";

const puzzle: Puzzle = {
  puzzleId: "puz-0000",
  letters: Array.from({ length: 36 }, (_, i) => "ABCDEFGHIJKLMNOPQRSTUVWXYZ"[i % 26]),
  anchor: "jazz",
  answers: [
    { id: "spangram", type: "spangram", word: "musician", path: [0, 6, 12, 18, 24, 30, 31, 32] },
    { id: "theme-0", type: "theme", word: "music", path: [1, 2, 3, 4, 5], band: "hot" },
    { id: "theme-1", type: "theme", word: "hijkl", path: [7, 8, 9, 10, 11], band: "warm" },
    { id: "theme-2", type: "theme", word: "nopqr", path: [13, 14, 15, 16, 17], band: "cool" },
    { id: "theme-3", type: "theme", word: "tuvwx", path: [19, 20, 21, 22, 23], band: "cold" },
    { id: "filler-0", type: "filler", word: "zabc", path: [25, 26, 27, 28] },
    { id: "filler-1", type: "filler", word: "fghi", path: [33, 34, 35, 29] },
  ],
};

describe("adjacency + path validity", () => {
  it("accepts diagonals, rejects jumps and dupes", () => {
    expect(areAdjacent(7, 0)).toBe(true);
    expect(areAdjacent(7, 21)).toBe(false);
    expect(isValidPath([1, 2, 3, 4, 5])).toBe(true);
    expect(isValidPath([1, 2, 2])).toBe(false);
    expect(isValidPath([1, 3])).toBe(false);
  });
});

describe("matchAnswer fwd/rev", () => {
  it("matches forward and reversed", () => {
    expect(matchAnswer([1, 2, 3, 4, 5], puzzle)?.id).toBe("theme-0");
    expect(matchAnswer([5, 4, 3, 2, 1], puzzle)?.id).toBe("theme-0");
  });
});

describe("submitTrace + bands", () => {
  it("reveals the band on a theme find", () => {
    const out = submitTrace(initAttempt(puzzle, "d"), puzzle, [1, 2, 3, 4, 5]);
    expect(out.found?.type).toBe("theme");
    expect(out.found?.band).toBe("hot");
    expect(out.state.log[0].band).toBe("hot");
  });
  it("earns a hint on filler", () => {
    const out = submitTrace(initAttempt(puzzle, "d"), puzzle, [25, 26, 27, 28]);
    expect(out.state.hintBalance).toBe(1);
  });
  it("does not re-add an already-found answer", () => {
    let st = submitTrace(initAttempt(puzzle, "d"), puzzle, [1, 2, 3, 4, 5]).state;
    expect(submitTrace(st, puzzle, [1, 2, 3, 4, 5]).error).toBe("already_found");
  });
});

describe("win + hints", () => {
  it("wins on all theme + spangram, ignoring fillers", () => {
    let st = initAttempt(puzzle, "d");
    for (const p of [[0, 6, 12, 18, 24, 30, 31, 32], [1, 2, 3, 4, 5], [7, 8, 9, 10, 11], [13, 14, 15, 16, 17], [19, 20, 21, 22, 23]]) {
      st = submitTrace(st, puzzle, p).state;
    }
    expect(isWon(st, puzzle)).toBe(true);
    expect(st.status).toBe("won");
  });
  it("hint prefers spangram then themes; spends deterministically", () => {
    expect(hintTarget(initAttempt(puzzle, "d"), puzzle)?.id).toBe("spangram");
    let st = submitTrace(initAttempt(puzzle, "d"), puzzle, [25, 26, 27, 28]).state;
    expect(canSpendHint(st)).toBe(true);
    const out = spendHint(st, puzzle);
    expect(out.revealed?.id).toBe("spangram");
    expect(out.state.hintBalance).toBe(0);
  });
});
