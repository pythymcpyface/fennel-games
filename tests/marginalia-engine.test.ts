import { describe, it, expect } from "vitest";
import { initAttempt, choose, isTerminal, isSolved, fillPrompt, replay, stepsCount, nodeOf } from "../src/games/marginalia/engine.ts";
import type { Puzzle } from "../src/games/marginalia/types.ts";

// s0 -[0]-> s1 -[0]-> gEnd (golden). Wrong choices dead-end at terminals.
const puzzle: Puzzle = {
  puzzleId: "puz-0000",
  startNodeId: "s0",
  goldenNodeId: "gEnd",
  nodes: {
    s0: { id: "s0", prompt: "Pick a [[BLANK]].", choices: [{ word: "key", next: "s1" }, { word: "rock", next: "endA" }, { word: "leaf", next: "endB" }] },
    s1: { id: "s1", prompt: "Open the [[BLANK]].", choices: [{ word: "door", next: "gEnd" }, { word: "trap", next: "endC" }, { word: "void", next: "endD" }] },
    gEnd: { id: "gEnd", prompt: "You [[BLANK]] escape!", choices: [] },
    endA: { id: "endA", prompt: "A dull [[BLANK]].", choices: [] },
    endB: { id: "endB", prompt: "A dull [[BLANK]].", choices: [] },
    endC: { id: "endC", prompt: "A dull [[BLANK]].", choices: [] },
    endD: { id: "endD", prompt: "A dull [[BLANK]].", choices: [] },
  },
};

describe("marginalia engine — traversal", () => {
  it("starts at the start node with it in history", () => {
    const s = initAttempt(puzzle, "2026-01-01");
    expect(s.currentNodeId).toBe("s0");
    expect(s.visited).toEqual(["s0"]);
    expect(s.isComplete).toBe(false);
  });

  it("isTerminal detects nodes without choices", () => {
    expect(isTerminal(nodeOf(puzzle, "gEnd"))).toBe(true);
    expect(isTerminal(nodeOf(puzzle, "s0"))).toBe(false);
  });

  it("choosing advances to the mapped next node and records history", () => {
    let s = initAttempt(puzzle, "2026-01-01");
    s = choose(s, puzzle, 0).state;
    expect(s.currentNodeId).toBe("s1");
    expect(s.visited).toEqual(["s0", "s1"]);
    expect(s.choices).toEqual([0]);
    expect(s.isComplete).toBe(false);
  });

  it("rejects out-of-range choices", () => {
    const s = initAttempt(puzzle, "2026-01-01");
    expect(choose(s, puzzle, 5).reason).toBe("out-of-range");
    expect(choose(s, puzzle, -1).reason).toBe("out-of-range");
  });

  it("ends the run on reaching a terminal node", () => {
    let s = initAttempt(puzzle, "2026-01-01");
    s = choose(s, puzzle, 1).state; // -> endA (terminal)
    expect(s.isComplete).toBe(true);
    expect(choose(s, puzzle, 0).accepted).toBe(false); // locked
  });
});

describe("marginalia engine — solve & helpers", () => {
  it("solved only when ending at the golden node", () => {
    let s = initAttempt(puzzle, "2026-01-01");
    s = choose(s, puzzle, 0).state; // s1
    s = choose(s, puzzle, 0).state; // gEnd
    expect(isSolved(s, puzzle)).toBe(true);
    expect(stepsCount(s)).toBe(2);
  });

  it("a lesser ending completes but is not solved", () => {
    let s = initAttempt(puzzle, "2026-01-01");
    s = choose(s, puzzle, 0).state; // s1
    s = choose(s, puzzle, 1).state; // endC (lesser)
    expect(s.isComplete).toBe(true);
    expect(isSolved(s, puzzle)).toBe(false);
  });

  it("fillPrompt substitutes the chosen word or shows a blank", () => {
    expect(fillPrompt("Pick a [[BLANK]].", "key")).toBe("Pick a key.");
    expect(fillPrompt("Pick a [[BLANK]].", null)).toBe("Pick a _____.");
  });

  it("replay resets to the start", () => {
    let s = initAttempt(puzzle, "2026-01-01");
    s = choose(s, puzzle, 0).state;
    const r = replay(puzzle, "2026-01-01");
    expect(r.currentNodeId).toBe("s0");
    expect(r.choices).toEqual([]);
  });
});
