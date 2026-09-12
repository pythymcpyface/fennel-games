import { describe, it, expect } from "vitest";
import {
  singleDiffIndex,
  tollOf,
  moveCost,
  initAttempt,
  currentWord,
  move,
  undo,
  recomputeCost,
} from "../src/games/tollgate/engine.ts";
import type { Puzzle } from "../src/games/tollgate/types.ts";

// tolls: A=1 else 2, R=5 for testing
const tolls = new Array(26).fill(2);
tolls[0] = 1; // A
tolls[17] = 5; // R
const puzzle: Puzzle = { puzzleId: "puz-0000", start: "COLD", target: "CARD", tolls, par: 7 };
const dict = new Set(["COLD", "CORD", "CARD", "WORD", "WARD", "CARE"]);

describe("core helpers", () => {
  it("singleDiffIndex finds the one changed position", () => {
    expect(singleDiffIndex("COLD", "CORD")).toBe(2);
    expect(singleDiffIndex("COLD", "CARD")).toBe(-1); // 2 diffs
    expect(singleDiffIndex("COLD", "COLD")).toBe(-1); // identical
  });
  it("tollOf reads the letter toll", () => {
    expect(tollOf("A", tolls)).toBe(1);
    expect(tollOf("R", tolls)).toBe(5);
    expect(tollOf("B", tolls)).toBe(2);
  });
  it("moveCost = toll of introduced letter", () => {
    expect(moveCost("COLD", "CORD", tolls)).toBe(5); // introduces R
    expect(moveCost("CORD", "CARD", tolls)).toBe(1); // introduces A
    expect(moveCost("COLD", "CARD", tolls)).toBe(Infinity); // not one change
  });
});

describe("move + state", () => {
  it("accepts a valid one-letter dictionary move and accrues cost", () => {
    const s0 = initAttempt(puzzle, "d");
    const out = move(s0, puzzle, dict, "CORD");
    expect(out.accepted).toBe(true);
    expect(out.cost).toBe(5);
    expect(out.state.totalCost).toBe(5);
    expect(currentWord(out.state)).toBe("CORD");
  });
  it("rejects non-dictionary / multi-change / wrong length", () => {
    const s0 = initAttempt(puzzle, "d");
    expect(move(s0, puzzle, dict, "COLX").reason).toBe("dictionary");
    expect(move(s0, puzzle, dict, "CARD").reason).toBe("not-one-change");
    expect(move(s0, puzzle, dict, "CO").reason).toBe("length");
  });
  it("solves on reaching the target", () => {
    let s = initAttempt(puzzle, "d");
    s = move(s, puzzle, dict, "CORD").state;
    const out = move(s, puzzle, dict, "CARD");
    expect(out.solved).toBe(true);
    expect(out.state.isSolved).toBe(true);
    expect(out.state.totalCost).toBe(6); // R(5) + A(1)
  });
  it("blocks moves after solve", () => {
    let s = initAttempt(puzzle, "d");
    s = move(s, puzzle, dict, "CORD").state;
    s = move(s, puzzle, dict, "CARD").state;
    expect(move(s, puzzle, dict, "CARE").reason).toBe("terminal");
  });
});

describe("undo", () => {
  it("reverts last move and recomputes cost", () => {
    let s = initAttempt(puzzle, "d");
    s = move(s, puzzle, dict, "CORD").state;
    expect(s.totalCost).toBe(5);
    s = undo(s, puzzle);
    expect(s.path).toEqual(["COLD"]);
    expect(s.totalCost).toBe(0);
  });
  it("recomputeCost sums move costs of a path", () => {
    expect(recomputeCost(["COLD", "CORD", "CARD"], tolls)).toBe(6);
  });
  it("undo at start is a no-op", () => {
    const s = initAttempt(puzzle, "d");
    expect(undo(s, puzzle).path).toEqual(["COLD"]);
  });
});
