import { describe, it, expect } from "vitest";
import {
  normalize,
  assignTiles,
  rackUsedExactly,
  evaluate,
  initAttempt,
  submit,
  imbalanceBand,
} from "../src/games/tare/engine.ts";
import { rackFromLetters } from "../src/games/tare/content-build.ts";
import type { Puzzle } from "../src/games/tare/types.ts";

// CAT (C3 A1 T1 = 5) + DOG (D2 O1 G2 = 5) → perfectly balanced. Rack = CATDOG.
const dict = new Set(["CAT", "DOG", "GOD", "ACT", "TAD", "GO"]);
const puzzle: Puzzle = { puzzleId: "puz-0000", rack: rackFromLetters("CATDOG"), tolerance: 0 };

describe("tare engine — tile assignment & rack equality", () => {
  it("assignTiles consumes exactly the letters of a word", () => {
    const out = assignTiles(puzzle.rack, "CAT")!;
    expect(out).not.toBeNull();
    expect(out.tiles.map((t) => t.letter).sort()).toEqual(["A", "C", "T"]);
    expect(out.remaining.map((t) => t.letter).sort()).toEqual(["D", "G", "O"]);
  });

  it("assignTiles returns null when the rack lacks letters", () => {
    expect(assignTiles(puzzle.rack, "ZZZ")).toBeNull();
  });

  it("rackUsedExactly checks multiset equality of rack vs both words", () => {
    expect(rackUsedExactly(puzzle.rack, "CAT", "DOG")).toBe(true);
    expect(rackUsedExactly(puzzle.rack, "CAT", "DO")).toBe(false); // missing G
    expect(rackUsedExactly(puzzle.rack, "CAT", "DOGG")).toBe(false); // extra G
  });

  it("normalize trims + uppercases", () => {
    expect(normalize("  cat ")).toBe("CAT");
  });
});

describe("tare engine — evaluation", () => {
  it("solves a perfectly balanced valid split", () => {
    const ev = evaluate(puzzle, "CAT", "DOG", dict);
    expect(ev.leftWeight).toBe(5);
    expect(ev.rightWeight).toBe(5);
    expect(ev.imbalance).toBe(0);
    expect(ev.isSolved).toBe(true);
    expect(ev.code).toBe("OK");
  });

  it("reports NOT_IN_DICTIONARY_LEFT for a non-word left", () => {
    const ev = evaluate(puzzle, "CTA", "DOG", dict);
    expect(ev.isLeftValid).toBe(false);
    expect(ev.code).toBe("NOT_IN_DICTIONARY_LEFT");
    expect(ev.isSolved).toBe(false);
  });

  it("reports RACK_MISMATCH when not all tiles used", () => {
    const ev = evaluate(puzzle, "CAT", "GOD", dict); // GOD uses G,O,D — but leaves nothing? CAT+GOD = C A T G O D = rack. valid actually
    expect(ev.isRackExact).toBe(true);
    const ev2 = evaluate(puzzle, "CAT", "GO", dict); // leaves D unused
    expect(ev2.isRackExact).toBe(false);
    expect(ev2.code).toBe("RACK_MISMATCH");
  });

  it("reports NOT_BALANCED when imbalance exceeds tolerance", () => {
    // Rack ACT+TAD: ACT=A1 C3 T1=5, TAD=T1 A1 D2=4 → imbalance 1 > tol 0.
    const p2: Puzzle = { puzzleId: "p", rack: rackFromLetters("ACTTAD"), tolerance: 0 };
    const d2 = new Set(["ACT", "TAD"]);
    const ev = evaluate(p2, "ACT", "TAD", d2);
    expect(ev.isRackExact).toBe(true);
    expect(ev.imbalance).toBe(1);
    expect(ev.isBalanced).toBe(false);
    expect(ev.code).toBe("NOT_BALANCED");
  });

  it("reports EMPTY_WORD when a pan is empty", () => {
    const ev = evaluate(puzzle, "CAT", "", dict);
    expect(ev.code).toBe("EMPTY_WORD");
  });
});

describe("tare engine — submit & share band", () => {
  it("locks on a solved submit and records imbalance", () => {
    let s = initAttempt(puzzle, "2026-01-01");
    const out = submit(s, puzzle, "CAT", "DOG", dict);
    expect(out.accepted).toBe(true);
    s = out.state;
    expect(s.isComplete).toBe(true);
    expect(s.imbalance).toBe(0);
    // second submit rejected
    expect(submit(s, puzzle, "CAT", "DOG", dict).accepted).toBe(false);
  });

  it("does not lock on an invalid submit", () => {
    const s = initAttempt(puzzle, "2026-01-01");
    const out = submit(s, puzzle, "CTA", "DOG", dict);
    expect(out.accepted).toBe(false);
    expect(out.state.isComplete).toBe(false);
  });

  it("imbalanceBand maps solved states", () => {
    const perfect = evaluate(puzzle, "CAT", "DOG", dict);
    expect(imbalanceBand(perfect)).toBe("PERFECT");
    expect(imbalanceBand(null)).toBe("UNSOLVED");
    const unsolved = evaluate(puzzle, "CTA", "DOG", dict);
    expect(imbalanceBand(unsolved)).toBe("UNSOLVED");
  });
});
