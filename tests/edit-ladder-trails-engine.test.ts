import { describe, it, expect } from "vitest";
import {
  areAdjacent, isValidPath, matchAnswer, initAttempt, submitTrace, isWon,
  hintTarget, canSpendHint, spendHint, rowOf, colOf,
} from "../src/games/edit-ladder-trails/engine.ts";
import type { Puzzle } from "../src/games/edit-ladder-trails/types.ts";

// A tiny hand-built valid puzzle is heavy to author by hand (perfect cover), so we
// test engine behaviour on a synthetic puzzle whose answers use disjoint straight
// runs (still valid 8-neighbour paths). Grid is 6x6 = 36 cells.
// spangram: column 0 top->bottom (cells 0,6,12,18,24,30) — spans rows 0..5.
// rung r0: row 0 cols 1..5 (1,2,3,4,5); r1: row1 1..5; r2: row2 1..5; r3: row3 1..5.
// fillers: row4 cols1..4 (25,26,27,28) and row5 cols1..4 (31,32,33,34). Remaining
// cells 29,35 unused -> not a perfect cover, but engine tests don't need cover.
const puzzle: Puzzle = {
  puzzleId: "puz-0000",
  letters: Array.from({ length: 36 }, (_, i) => "ABCDEFGHIJKLMNOPQRSTUVWXYZ"[i % 26]),
  answers: [
    { id: "spangram", type: "spangram", word: "agmsya".slice(0, 6) + "zz", path: [0, 6, 12, 18, 24, 30, 31, 32] },
    { id: "rung-0", type: "rung", word: "bcdef", path: [1, 2, 3, 4, 5] },
    { id: "rung-1", type: "rung", word: "hijkl", path: [7, 8, 9, 10, 11] },
    { id: "rung-2", type: "rung", word: "nopqr", path: [13, 14, 15, 16, 17] },
    { id: "rung-3", type: "rung", word: "tuvwx", path: [19, 20, 21, 22, 23] },
    { id: "filler-0", type: "filler", word: "zabc", path: [25, 26, 27, 28] },
    { id: "filler-1", type: "filler", word: "fghi", path: [33, 34, 35, 29] },
  ],
  ladder: ["bcdef", "hijkl", "nopqr", "tuvwx"],
  spangram: "agmsyazz",
};

describe("geometry + adjacency (REQ-006)", () => {
  it("maps cell to row/col", () => { expect(rowOf(7)).toBe(1); expect(colOf(7)).toBe(1); });
  it("8-neighbour adjacency incl diagonals", () => {
    expect(areAdjacent(7, 0)).toBe(true);   // (1,1)->(0,0) diagonal up-left
    expect(areAdjacent(7, 8)).toBe(true);   // (1,1)->(1,2) right
    expect(areAdjacent(7, 21)).toBe(false); // (1,1)->(3,3) two+ rows away
    expect(areAdjacent(5, 6)).toBe(false);  // (0,5)->(1,0) wraps row edge
    expect(areAdjacent(7, 7)).toBe(false);  // same cell
  });
});

describe("isValidPath (REQ-006/007)", () => {
  it("accepts a contiguous distinct chain", () => expect(isValidPath([1, 2, 3, 4, 5])).toBe(true));
  it("rejects a duplicate cell (REQ-007)", () => expect(isValidPath([1, 2, 2, 3])).toBe(false));
  it("rejects a non-adjacent jump (REQ-006)", () => expect(isValidPath([1, 3])).toBe(false));
  it("rejects empty", () => expect(isValidPath([])).toBe(false));
});

describe("matchAnswer (REQ-009, ADR-003 fwd/rev)", () => {
  it("matches forward", () => expect(matchAnswer([1, 2, 3, 4, 5], puzzle)?.id).toBe("rung-0"));
  it("matches reversed", () => expect(matchAnswer([5, 4, 3, 2, 1], puzzle)?.id).toBe("rung-0"));
  it("returns null for a non-answer path", () => expect(matchAnswer([13, 14], puzzle)).toBeNull());
});

describe("submitTrace discovery (REQ-009/010/011)", () => {
  it("records a rung find without penalty", () => {
    const out = submitTrace(initAttempt(puzzle, "d"), puzzle, [1, 2, 3, 4, 5]);
    expect(out.found?.id).toBe("rung-0");
    expect(out.state.foundIds).toEqual(["rung-0"]);
  });
  it("awards a hint on filler discovery (REQ-011)", () => {
    const out = submitTrace(initAttempt(puzzle, "d"), puzzle, [25, 26, 27, 28]);
    expect(out.found?.type).toBe("filler");
    expect(out.state.hintBalance).toBe(1);
  });
  it("does not re-add an already-found answer (REQ-010)", () => {
    let st = submitTrace(initAttempt(puzzle, "d"), puzzle, [1, 2, 3, 4, 5]).state;
    const again = submitTrace(st, puzzle, [1, 2, 3, 4, 5]);
    expect(again.error).toBe("already_found");
    expect(again.state.foundIds).toEqual(["rung-0"]);
  });
  it("reports not_an_answer with no penalty (ERROR-004)", () => {
    const out = submitTrace(initAttempt(puzzle, "d"), puzzle, [13, 14]);
    expect(out.error).toBe("not_an_answer");
    expect(out.state.foundIds).toEqual([]);
  });
});

describe("win detection (REQ-015)", () => {
  it("wins on all rungs + spangram, ignoring fillers", () => {
    let st = initAttempt(puzzle, "d");
    for (const p of [[0, 6, 12, 18, 24, 30, 31, 32], [1, 2, 3, 4, 5], [7, 8, 9, 10, 11], [13, 14, 15, 16, 17], [19, 20, 21, 22, 23]]) {
      st = submitTrace(st, puzzle, p).state;
    }
    expect(isWon(st, puzzle)).toBe(true);
    expect(st.status).toBe("won");
  });
  it("is not won with a filler but a missing rung", () => {
    let st = initAttempt(puzzle, "d");
    st = submitTrace(st, puzzle, [25, 26, 27, 28]).state; // filler only
    expect(st.status).toBe("in_progress");
  });
});

describe("hints (REQ-012/013/014)", () => {
  it("cannot spend at zero balance (REQ-012)", () => {
    expect(canSpendHint(initAttempt(puzzle, "d"))).toBe(false);
  });
  it("prefers theme (spangram) target first (REQ-014)", () => {
    expect(hintTarget(initAttempt(puzzle, "d"), puzzle)?.id).toBe("spangram");
  });
  it("spends a hint and reveals a target deterministically (REQ-013/014)", () => {
    let st = submitTrace(initAttempt(puzzle, "d"), puzzle, [25, 26, 27, 28]).state; // +1 hint
    expect(st.hintBalance).toBe(1);
    const out = spendHint(st, puzzle);
    expect(out.revealed?.id).toBe("spangram");
    expect(out.state.hintBalance).toBe(0);
    expect(out.state.revealedIds).toContain("spangram");
  });
});
