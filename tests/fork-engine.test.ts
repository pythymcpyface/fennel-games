import { describe, it, expect } from "vitest";
import {
  hamming,
  isOneLetterChange,
  isValidStep,
  initAttempt,
  addTrunk,
  setFork,
  addBranch,
  branchReaches,
  totalSteps,
  undo,
} from "../src/games/fork/engine.ts";
import type { Puzzle } from "../src/games/fork/types.ts";

const puzzle: Puzzle = { puzzleId: "puz-0000", start: "COLD", targetA: "CORE", targetB: "WARM", wordLength: 4, par: 6 };
const dict = new Set(["COLD", "CORD", "CORE", "WORD", "WARD", "WARM", "CARD", "CARE", "WARE"]);

describe("step helpers", () => {
  it("hamming + one-letter change", () => {
    expect(hamming("COLD", "CORD")).toBe(1);
    expect(hamming("COLD", "WARM")).toBe(4);
    expect(isOneLetterChange("COLD", "CORD")).toBe(true);
  });
  it("isValidStep needs dictionary + one change", () => {
    expect(isValidStep("COLD", "CORD", dict)).toBe(true);
    expect(isValidStep("COLD", "CARD", dict)).toBe(false); // 2 changes
    expect(isValidStep("COLD", "COLX", dict)).toBe(false); // not a word
  });
});

describe("trunk building", () => {
  it("adds valid trunk words", () => {
    const s0 = initAttempt(puzzle, "d");
    const out = addTrunk(s0, puzzle, "CORD", dict);
    expect(out.accepted).toBe(true);
    expect(out.state.trunk).toEqual(["COLD", "CORD"]);
  });
  it("rejects invalid trunk steps", () => {
    const s0 = initAttempt(puzzle, "d");
    expect(addTrunk(s0, puzzle, "CARD", dict).reason).toBe("not-one-change");
    expect(addTrunk(s0, puzzle, "COLX", dict).reason).toBe("dictionary");
    expect(addTrunk(s0, puzzle, "CO", dict).reason).toBe("length");
  });
});

describe("fork + branches", () => {
  it("setFork initialises both branches at the fork word", () => {
    let s = initAttempt(puzzle, "d");
    s = addTrunk(s, puzzle, "CORD", dict).state;
    s = setFork(s, 1); // fork at CORD
    expect(s.forkIndex).toBe(1);
    expect(s.branchA).toEqual(["CORD"]);
    expect(s.branchB).toEqual(["CORD"]);
  });
  it("solves when both branches reach both targets (unordered)", () => {
    let s = initAttempt(puzzle, "d");
    s = setFork(s, 0); // fork at start COLD
    // Branch A: COLD->CORD->CORE (target A)
    s = addBranch(s, puzzle, "A", "CORD", dict).state;
    s = addBranch(s, puzzle, "A", "CORE", dict).state;
    // Branch B: COLD->CORD->WORD->WARD->WARM (target B); CORD->WORD is one change
    s = addBranch(s, puzzle, "B", "CORD", dict).state;
    s = addBranch(s, puzzle, "B", "WORD", dict).state;
    s = addBranch(s, puzzle, "B", "WARD", dict).state;
    s = addBranch(s, puzzle, "B", "WARM", dict).state;
    expect(branchReaches(s, puzzle)).toBe(true);
    expect(s.isComplete).toBe(true);
  });
  it("totalSteps counts trunk-to-fork + both branches", () => {
    let s = initAttempt(puzzle, "d");
    s = addTrunk(s, puzzle, "CORD", dict).state; // trunk COLD,CORD
    s = setFork(s, 1); // fork at index 1 -> 1 trunk step
    s = addBranch(s, puzzle, "A", "CORE", dict).state; // 1 step
    s = addBranch(s, puzzle, "B", "WORD", dict).state; // 1 step
    expect(totalSteps(s)).toBe(3);
  });
  it("undo removes last branch word", () => {
    let s = initAttempt(puzzle, "d");
    s = setFork(s, 0);
    s = addBranch(s, puzzle, "A", "CORD", dict).state;
    s = undo(s, "A");
    expect(s.branchA).toEqual(["COLD"]);
  });
});
