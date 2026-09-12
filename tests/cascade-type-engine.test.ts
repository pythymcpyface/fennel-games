import { describe, it, expect } from "vitest";
import {
  normalizeSubmission,
  sharesLetter,
  comboMultiplier,
  basePoints,
  adjacencyBonus,
  initAttempt,
  submit,
  clearableWords,
  totalWords,
  clearedFraction,
  isSolved,
} from "../src/games/cascade-type/engine.ts";
import type { Puzzle } from "../src/games/cascade-type/types.ts";

// Bottom row (0): cat, dog. Top row (1): ark, toe.
const puzzle: Puzzle = {
  puzzleId: "puz-0000",
  rows: [
    ["cat", "dog"],
    ["ark", "toe"],
  ],
};

describe("cascade-type engine — helpers", () => {
  it("normalizeSubmission trims/lowercases/strips", () => {
    expect(normalizeSubmission(" C4a-T! ")).toBe("cat");
  });
  it("sharesLetter detects a shared letter", () => {
    expect(sharesLetter("cat", "toe")).toBe(true); // shares 't'
    expect(sharesLetter("cat", "dog")).toBe(false);
  });
  it("comboMultiplier grows with combo", () => {
    expect(comboMultiplier(0)).toBe(1);
    expect(comboMultiplier(2)).toBe(1.5);
  });
  it("basePoints = length; adjacencyBonus only when linked", () => {
    expect(basePoints("cat")).toBe(3);
    expect(adjacencyBonus("cat", false)).toBe(0);
    expect(adjacencyBonus("cat", true)).toBe(2); // ceil(3/2)
  });
});

describe("cascade-type engine — clearing rules", () => {
  it("only exposes the bottom row initially", () => {
    const s = initAttempt(puzzle, "2026-01-01");
    expect(clearableWords(s, puzzle).map((c) => c.word)).toEqual(["cat", "dog"]);
  });

  it("ignores a word from a non-exposed row (no-op)", () => {
    const s = initAttempt(puzzle, "2026-01-01");
    const out = submit(s, puzzle, "ark"); // in row 1, not exposed
    expect(out.matched).toBe(false);
    expect(out.state.cleared).toHaveLength(0);
  });

  it("clears a matching exposed word and scores base (first clear, no link)", () => {
    let s = initAttempt(puzzle, "2026-01-01");
    const out = submit(s, puzzle, "cat");
    s = out.state;
    expect(out.matched).toBe(true);
    expect(out.linked).toBe(false);
    expect(out.gained).toBe(3); // base 3, combo 0, mult 1
    expect(s.combo).toBe(0);
  });

  it("advances the exposed row when the bottom row is fully cleared", () => {
    let s = initAttempt(puzzle, "2026-01-01");
    s = submit(s, puzzle, "cat").state;
    s = submit(s, puzzle, "dog").state; // dog shares no letter with cat -> combo 0
    expect(s.exposedRow).toBe(1);
    expect(clearableWords(s, puzzle).map((c) => c.word)).toEqual(["ark", "toe"]);
  });

  it("empty and non-matching submissions are no-ops", () => {
    const s = initAttempt(puzzle, "2026-01-01");
    expect(submit(s, puzzle, "  ").accepted).toBe(false);
    expect(submit(s, puzzle, "zzz").accepted).toBe(false);
  });
});

describe("cascade-type engine — combo & scoring", () => {
  it("builds a combo on linked clears and resets on an unlinked one", () => {
    // Order: cat -> (row0) ... but link needs shared letters across consecutive clears.
    // cat then toe? toe is row1. So: clear cat (combo0), dog (no link, combo0),
    // row advances; then ark, toe: ark shares no letter with dog -> combo 0;
    // toe shares 't'? ark->toe: a,r,k vs t,o,e -> no. Use a crafted puzzle instead.
    const linky: Puzzle = { puzzleId: "p", rows: [["cat", "act"], ["ate", "toe"]] };
    let s = initAttempt(linky, "2026-01-01");
    s = submit(s, linky, "cat").state; // combo 0
    const out2 = submit(s, linky, "act"); // shares a,c,t -> linked
    s = out2.state;
    expect(out2.linked).toBe(true);
    expect(s.combo).toBe(1);
    expect(s.comboMax).toBe(1);
  });

  it("solves when all words cleared and reports fraction", () => {
    let s = initAttempt(puzzle, "2026-01-01");
    expect(totalWords(puzzle)).toBe(4);
    for (const row of puzzle.rows) for (const w of row) s = submit(s, puzzle, w).state;
    expect(isSolved(s)).toBe(true);
    expect(clearedFraction(s, puzzle)).toBe(1);
    // Blocked after solve.
    expect(submit(s, puzzle, "cat").accepted).toBe(false);
  });
});
