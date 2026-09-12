import { describe, it, expect } from "vitest";
import { maxReachableScore, reachableSubgraph, buildPuzzle, buildPuzzles, assertPuzzlesValid } from "../src/games/tradeoff/content-build.ts";
import { SCRABBLE_VALUES } from "../src/games/tradeoff/engine.ts";

const neighbors: Record<string, string[]> = {
  CAT: ["BAT", "CAB", "COT"],
  BAT: ["CAT", "BAY"],
  CAB: ["CAT", "CAY"],
  COT: ["CAT", "COY"],
  CAY: ["CAB"],
  COY: ["COT"],
  BAY: ["BAT"],
};

describe("BFS par gate (REQ-023)", () => {
  it("computes max reachable score within budget", () => {
    // from CAT (5), reachable in 1: BAT(5),CAB(7),COT(5) -> max 7
    expect(maxReachableScore("CAT", 1, neighbors, SCRABBLE_VALUES)).toBe(7);
  });
  it("respects the budget bound", () => {
    // budget 0 -> just the start word
    expect(maxReachableScore("CAT", 0, neighbors, SCRABBLE_VALUES)).toBe(5);
  });
});

describe("reachableSubgraph", () => {
  it("only includes words reachable within budget", () => {
    const sub = reachableSubgraph("CAT", 1, neighbors);
    expect(Object.keys(sub).sort()).toEqual(["BAT", "CAB", "CAT", "COT"]);
    // edges are restricted to the reachable set
    expect(sub["CAB"]).toEqual(["CAT"]);
  });
});

describe("buildPuzzle + gate", () => {
  it("sets par to the optimum and keeps the subgraph", () => {
    const p = buildPuzzle({ startWord: "CAT", swapBudget: 1 }, neighbors, SCRABBLE_VALUES, "puz-0000")!;
    expect(p.parScore).toBe(7);
    expect(p.neighbors["CAT"]).toContain("CAB");
  });
  it("rejects a puzzle with no climb (par <= start score)", () => {
    const flat: Record<string, string[]> = { CAT: ["BAT"], BAT: ["CAT"] }; // both score 5
    expect(buildPuzzle({ startWord: "CAT", swapBudget: 2 }, flat, SCRABBLE_VALUES, "x")).toBeNull();
  });
  it("buildPuzzles emits valid puzzles that pass the assertion", () => {
    const puzzles = buildPuzzles([{ startWord: "CAT", swapBudget: 2 }], neighbors, SCRABBLE_VALUES);
    expect(puzzles).toHaveLength(1);
    expect(() => assertPuzzlesValid(puzzles)).not.toThrow();
  });
});
