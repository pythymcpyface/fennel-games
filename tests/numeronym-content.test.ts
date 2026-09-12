import { describe, it, expect } from "vitest";
import { isFairSet, buildPuzzles, assertPuzzlesValid, type CandidateSet } from "../src/games/numeronym/content-build.ts";

const dict = new Set(["LATER", "GRATE", "BEFORE", "TONIGHT", "CREATE", "WAIT"]);

const goodSet: CandidateSet = {
  items: [
    { clue: "L8R", answer: "LATER" },
    { clue: "GR8", answer: "GRATE" },
    { clue: "BE4E", answer: "BEFORE" },
    { clue: "2NIGHT", answer: "TONIGHT" },
    { clue: "CRE8", answer: "CREATE" },
  ],
  themeLabel: "Texting",
};

describe("isFairSet (REQ-026)", () => {
  it("accepts a set where each clue uniquely encodes its answer", () => {
    expect(isFairSet(goodSet, dict)).toBe(true);
  });
  it("rejects when the clue is not a valid encoding of its answer", () => {
    const bad: CandidateSet = {
      items: [{ clue: "W8", answer: "WAIT" }, ...goodSet.items.slice(1)],
      themeLabel: "Texting",
    };
    expect(isFairSet(bad, dict)).toBe(false);
  });
  it("rejects non-dictionary answer / wrong length", () => {
    expect(isFairSet({ items: [{ clue: "L8R", answer: "ZZZZ" }], themeLabel: "x" }, dict)).toBe(false);
  });
});

describe("buildPuzzles + gate", () => {
  it("emits fair sets", () => {
    const puzzles = buildPuzzles([goodSet], dict);
    expect(puzzles).toHaveLength(1);
    expect(puzzles[0].clues).toContain("L8R");
    expect(() => assertPuzzlesValid(puzzles, dict)).not.toThrow();
  });
});
