import { describe, it, expect } from "vitest";
import {
  isAdjacent,
  sameCoord,
  spelledText,
  canExtend,
  extend,
  undo,
  clearPath,
  isShoreToShore,
  classify,
  submit,
  initAttempt,
} from "../src/games/isthmus/engine.ts";
import type { Puzzle } from "../src/games/isthmus/types.ts";

// 3x3 grid; solution CAT down the diagonal-ish path (0,0)->(1,1)->(2,2)
const grid = [
  ["C", "X", "Z"],
  ["Q", "A", "Y"],
  ["W", "M", "T"],
];
const dict = new Set(["CAT", "CMT"]);
const puzzle: Puzzle = { puzzleId: "puz-0000", rows: 3, cols: 3, grid, solution: [ { row: 0, col: 0 }, { row: 1, col: 1 }, { row: 2, col: 2 } ] };

describe("adjacency", () => {
  it("8-way adjacency incl diagonals", () => {
    expect(isAdjacent({ row: 0, col: 0 }, { row: 1, col: 1 })).toBe(true);
    expect(isAdjacent({ row: 0, col: 0 }, { row: 0, col: 1 })).toBe(true);
    expect(isAdjacent({ row: 0, col: 0 }, { row: 2, col: 0 })).toBe(false);
    expect(isAdjacent({ row: 0, col: 0 }, { row: 0, col: 0 })).toBe(false);
  });
});

describe("path building", () => {
  it("canExtend enforces bounds, adjacency, no-reuse", () => {
    expect(canExtend([], { row: 0, col: 0 }, 3, 3)).toBe(true);
    expect(canExtend([{ row: 0, col: 0 }], { row: 1, col: 1 }, 3, 3)).toBe(true);
    expect(canExtend([{ row: 0, col: 0 }], { row: 2, col: 2 }, 3, 3)).toBe(false); // not adjacent
    expect(canExtend([{ row: 0, col: 0 }], { row: 0, col: 0 }, 3, 3)).toBe(false); // reuse
    expect(canExtend([{ row: 0, col: 0 }], { row: 5, col: 5 }, 3, 3)).toBe(false); // OOB
  });
  it("extend appends only legal tiles", () => {
    let s = initAttempt(puzzle, "d");
    s = extend(s, { row: 0, col: 0 }, puzzle);
    s = extend(s, { row: 2, col: 2 }, puzzle); // not adjacent -> ignored
    expect(s.path.length).toBe(1);
    s = extend(s, { row: 1, col: 1 }, puzzle);
    expect(s.path.length).toBe(2);
  });
  it("undo/clear work", () => {
    let s = initAttempt(puzzle, "d");
    s = extend(s, { row: 0, col: 0 }, puzzle);
    s = extend(s, { row: 1, col: 1 }, puzzle);
    expect(undo(s).path.length).toBe(1);
    expect(clearPath(s).path.length).toBe(0);
  });
  it("spelledText concatenates letters", () => {
    expect(spelledText([{ row: 0, col: 0 }, { row: 1, col: 1 }, { row: 2, col: 2 }], grid)).toBe("CAT");
  });
});

describe("shore-to-shore", () => {
  it("requires top start + bottom end", () => {
    expect(isShoreToShore([{ row: 0, col: 0 }, { row: 2, col: 2 }], 3)).toBe(true);
    expect(isShoreToShore([{ row: 1, col: 0 }, { row: 2, col: 2 }], 3)).toBe(false);
    expect(isShoreToShore([{ row: 0, col: 0 }], 3)).toBe(false);
  });
});

describe("classify + submit", () => {
  const path = [{ row: 0, col: 0 }, { row: 1, col: 1 }, { row: 2, col: 2 }];
  it("classifies a valid solution", () => {
    expect(classify(path, puzzle, dict)).toBe("VALID");
  });
  it("flags empty / not-shore / not-a-word", () => {
    expect(classify([], puzzle, dict)).toBe("EMPTY");
    expect(classify([{ row: 1, col: 1 }, { row: 2, col: 2 }], puzzle, dict)).toBe("NOT_SHORE_TO_SHORE");
    expect(classify([{ row: 0, col: 1 }, { row: 1, col: 1 }, { row: 2, col: 1 }], puzzle, dict)).toBe("NOT_A_WORD");
  });
  it("submit solves on VALID and counts attempts", () => {
    let s = initAttempt(puzzle, "d");
    s = { ...s, path };
    const out = submit(s, puzzle, dict);
    expect(out.status).toBe("VALID");
    expect(out.state.isSolved).toBe(true);
    expect(out.state.attempts).toBe(1);
    expect(out.word).toBe("CAT");
  });
  it("submit on invalid does not solve", () => {
    let s = initAttempt(puzzle, "d");
    s = { ...s, path: [{ row: 1, col: 1 }] };
    const out = submit(s, puzzle, dict);
    expect(out.state.isSolved).toBe(false);
    expect(out.status).not.toBe("VALID");
  });
});

describe("sameCoord", () => {
  it("compares coords", () => {
    expect(sameCoord({ row: 1, col: 2 }, { row: 1, col: 2 })).toBe(true);
    expect(sameCoord({ row: 1, col: 2 }, { row: 2, col: 1 })).toBe(false);
  });
});
