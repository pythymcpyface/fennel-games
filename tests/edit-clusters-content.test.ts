import { describe, it, expect } from "vitest";
import { combinations, isFairBoard, buildPuzzles, assertPuzzlesValid, type CandidateBoard } from "../src/games/edit-clusters/content-build.ts";

const cliqueAdj: Record<string, string[]> = {
  bare: ["care", "dare", "fare"],
  care: ["bare", "dare", "fare"],
  dare: ["bare", "care", "fare"],
  fare: ["bare", "care", "dare"],
  airy: [],
  lies: [],
  offs: [],
  tame: [],
  wist: [],
};
const fair: CandidateBoard = {
  board: ["airy", "bare", "care", "dare", "fare", "lies", "offs", "tame", "wist"],
  cluster: ["bare", "care", "dare", "fare"],
  adjacency: cliqueAdj,
};

describe("combinations", () => {
  it("produces C(9,4) = 126 subsets", () => {
    expect(combinations(fair.board, 4)).toHaveLength(126);
  });
});

describe("isFairBoard", () => {
  it("accepts a board with a unique densest 4-clique", () => {
    expect(isFairBoard(fair)).toBe(true);
  });

  it("rejects when a second clique ties the density", () => {
    // Two disjoint 4-cliques => tie => not unique.
    const adj: Record<string, string[]> = {
      bare: ["care", "dare", "fare"], care: ["bare", "dare", "fare"], dare: ["bare", "care", "fare"], fare: ["bare", "care", "dare"],
      cast: ["fast", "last", "mast"], fast: ["cast", "last", "mast"], last: ["cast", "fast", "mast"], mast: ["cast", "fast", "last"],
      airy: [],
    };
    const cand: CandidateBoard = {
      board: ["airy", "bare", "care", "cast", "dare", "fare", "fast", "last", "mast"],
      cluster: ["bare", "care", "dare", "fare"],
      adjacency: adj,
    };
    expect(isFairBoard(cand)).toBe(false);
  });

  it("rejects wrong board size", () => {
    expect(isFairBoard({ ...fair, board: fair.board.slice(0, 8) })).toBe(false);
  });

  it("rejects a cluster with no internal edges", () => {
    expect(isFairBoard({ ...fair, cluster: ["airy", "lies", "offs", "tame"] })).toBe(false);
  });
});

describe("buildPuzzles + gate", () => {
  it("emits fair boards with computed maxEdges and passes assert", () => {
    const puzzles = buildPuzzles([fair]);
    expect(puzzles).toHaveLength(1);
    expect(puzzles[0].maxEdges).toBe(6);
    expect(puzzles[0].puzzleId).toBe("puz-0000");
    expect(() => assertPuzzlesValid(puzzles)).not.toThrow();
  });

  it("drops unfair candidates", () => {
    const unfair: CandidateBoard = { ...fair, cluster: ["airy", "lies", "offs", "tame"] };
    expect(buildPuzzles([unfair])).toHaveLength(0);
  });
});
