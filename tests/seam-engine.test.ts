import { describe, it, expect } from "vitest";
import {
  solutionLinks,
  linkKey,
  countCorrectLinks,
  isPermutation,
  initAttempt,
  swap,
  move,
  submit,
} from "../src/games/seam/engine.ts";
import type { Puzzle } from "../src/games/seam/types.ts";

// Scrambled display: PAPER FLY BONE FIRE BACK ; solved: FIRE FLY PAPER BACK BONE
// solution (display idx in solved order) = [3,1,0,4,2]
const puzzle: Puzzle = {
  puzzleId: "puz-0000",
  words: ["PAPER", "FLY", "BONE", "FIRE", "BACK"],
  solution: [3, 1, 0, 4, 2],
};

describe("links", () => {
  it("linkKey is order-independent", () => {
    expect(linkKey(3, 1)).toBe(linkKey(1, 3));
  });
  it("solutionLinks are the consecutive solved pairs", () => {
    const links = solutionLinks(puzzle);
    // consecutive pairs of [3,1,0,4,2]: (3,1)(1,0)(0,4)(4,2)
    expect(links.has(linkKey(3, 1))).toBe(true);
    expect(links.has(linkKey(1, 0))).toBe(true);
    expect(links.has(linkKey(0, 4))).toBe(true);
    expect(links.has(linkKey(4, 2))).toBe(true);
    expect(links.size).toBe(4);
  });
});

describe("countCorrectLinks", () => {
  const links = solutionLinks(puzzle);
  it("solution order scores all N-1 links", () => {
    expect(countCorrectLinks(puzzle.solution, links)).toBe(4);
  });
  it("reverse of the solution also scores all links", () => {
    expect(countCorrectLinks([...puzzle.solution].reverse(), links)).toBe(4);
  });
  it("identity display order scores fewer", () => {
    expect(countCorrectLinks([0, 1, 2, 3, 4], links)).toBeLessThan(4);
  });
});

describe("permutation + reorder ops", () => {
  it("isPermutation validates", () => {
    expect(isPermutation([3, 1, 0, 4, 2], 5)).toBe(true);
    expect(isPermutation([0, 0, 1, 2, 3], 5)).toBe(false);
    expect(isPermutation([0, 1, 2], 5)).toBe(false);
  });
  it("swap exchanges two positions", () => {
    const s = initAttempt(puzzle, "2026-07-25");
    const s2 = swap(s, 0, 4);
    expect(s2.order[0]).toBe(s.order[4]);
    expect(s2.order[4]).toBe(s.order[0]);
  });
  it("move relocates an item and preserves permutation", () => {
    const s = initAttempt(puzzle, "2026-07-25");
    const s2 = move(s, 0, 3);
    expect(isPermutation(s2.order, 5)).toBe(true);
    expect(s2.order.length).toBe(5);
  });
  it("initAttempt starts from the scrambled display order (identity indices)", () => {
    const s = initAttempt(puzzle, "2026-07-25");
    expect(s.order).toEqual([0, 1, 2, 3, 4]);
  });
});

describe("submit", () => {
  it("solves when order matches the solution", () => {
    let s = initAttempt(puzzle, "2026-07-25");
    s = { ...s, order: [...puzzle.solution] };
    const out = submit(s, puzzle);
    expect(out.feedback.solved).toBe(true);
    expect(out.feedback.correctLinks).toBe(4);
    expect(out.state.isSolved).toBe(true);
  });
  it("reports partial correctness and consumes an attempt", () => {
    const s = initAttempt(puzzle, "2026-07-25");
    const out = submit(s, puzzle);
    expect(out.feedback.solved).toBe(false);
    expect(out.state.attempts).toBe(1);
    expect(out.state.history.length).toBe(1);
  });
});
