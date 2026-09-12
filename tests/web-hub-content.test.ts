import { describe, it, expect } from "vitest";
import { degrees, pickHub, isFairBoard, buildPuzzles, assertPuzzlesValid, type CandidateBoard } from "../src/games/web-hub/content-build.ts";

const fair: CandidateBoard = {
  board: ["aced", "aces", "acid", "awed", "iced", "lewd", "nits", "vend"],
  adjacency: {
    aced: ["aces", "acid", "awed", "iced"],
    aces: ["aced"], acid: ["aced"], awed: ["aced"], iced: ["aced"],
    lewd: [], nits: [], vend: [],
  },
};

describe("degrees / pickHub", () => {
  it("computes degrees and picks the max", () => {
    expect(degrees(fair).aced).toBe(4);
    expect(pickHub(fair)).toBe("aced");
  });
});

describe("isFairBoard", () => {
  it("accepts a unique high-degree hub", () => {
    expect(isFairBoard(fair)).toBe(true);
  });

  it("rejects a near-tie for most-connected", () => {
    const tie: CandidateBoard = {
      board: ["aced", "aces", "acid", "awed", "iced", "lewd", "nits", "vend"],
      adjacency: {
        aced: ["aces", "acid", "awed", "iced"],
        aces: ["aced", "acid", "awed", "iced"], // now also degree 4
        acid: ["aced", "aces"], awed: ["aced", "aces"], iced: ["aced", "aces"],
        lewd: [], nits: [], vend: [],
      },
    };
    expect(isFairBoard(tie)).toBe(false);
  });

  it("rejects when no real hub exists (max degree < 3)", () => {
    const flat: CandidateBoard = {
      board: ["aced", "aces", "acid", "awed", "iced", "lewd", "nits", "vend"],
      adjacency: { aced: ["aces"], aces: ["aced"], acid: [], awed: [], iced: [], lewd: [], nits: [], vend: [] },
    };
    expect(isFairBoard(flat)).toBe(false);
  });
});

describe("buildPuzzles + gate", () => {
  it("emits fair boards and passes assert", () => {
    const puzzles = buildPuzzles([fair]);
    expect(puzzles).toHaveLength(1);
    expect(puzzles[0].hub).toBe("aced");
    expect(puzzles[0].puzzleId).toBe("puz-0000");
    expect(() => assertPuzzlesValid(puzzles)).not.toThrow();
  });
});
