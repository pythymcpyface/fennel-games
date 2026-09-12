import { describe, it, expect } from "vitest";
import { initAttempt, applyGuess, canGuess } from "../src/games/overlap/engine.ts";
import { applyHint } from "../src/games/overlap/hint.ts";
import { buildShareText, isSpoilerSafe } from "../src/games/overlap/share.ts";
import type { Puzzle } from "../src/games/overlap/types.ts";

const puzzle: Puzzle = {
  puzzleId: "puz-0001",
  anchorA: "FIRE",
  anchorB: "CREAM",
  bridgeWord: "CRACKER",
  bridgeLength: 7,
};

describe("engine attempt reducer (REQ-004/010..014)", () => {
  it("initAttempt gives a full allowance and empty grid", () => {
    const a = initAttempt("puz-0001", "2024-04-01");
    expect(a.remainingGuesses).toBe(6);
    expect(a.revealGrid).toHaveLength(0);
    expect(canGuess(a)).toBe(true);
  });

  it("applyGuess appends a row and decrements on a wrong guess", () => {
    const a = initAttempt("puz-0001", "2024-04-01");
    const r = applyGuess(a, "CRACKED", puzzle);
    expect(r.won).toBe(false);
    expect(r.state.revealGrid).toHaveLength(1);
    expect(r.state.remainingGuesses).toBe(5);
    expect(r.state.isSolved).toBe(false);
  });

  it("TEST-014: winning guess solves without decrementing", () => {
    const a = initAttempt("puz-0001", "2024-04-01");
    const r = applyGuess(a, "CRACKER", puzzle);
    expect(r.won).toBe(true);
    expect(r.state.isSolved).toBe(true);
    expect(r.state.remainingGuesses).toBe(6);
  });

  it("TEST-015: failure after exhausting allowance", () => {
    let a = initAttempt("puz-0001", "2024-04-01");
    for (let i = 0; i < 6; i++) a = applyGuess(a, "CRACKED", puzzle).state;
    expect(a.isFailed).toBe(true);
    expect(a.remainingGuesses).toBe(0);
    expect(canGuess(a)).toBe(false);
  });

  it("is a pure reducer (prev unchanged)", () => {
    const a = initAttempt("puz-0001", "2024-04-01");
    applyGuess(a, "CRACKED", puzzle);
    expect(a.revealGrid).toHaveLength(0);
  });
});

describe("hint (REQ-018)", () => {
  it("TEST-019: reveals leftmost unhinted correct letter and increments count", () => {
    const a = initAttempt("puz-0001", "2024-04-01");
    const h1 = applyHint(a, puzzle)!;
    expect(h1.position).toBe(0);
    expect(h1.letter).toBe("C");
    expect(h1.state.hintCountUsed).toBe(1);
    const h2 = applyHint(h1.state, puzzle)!;
    expect(h2.position).toBe(1);
    expect(h2.letter).toBe("R");
  });

  it("is deterministic across reloads (same positions)", () => {
    const a = initAttempt("puz-0001", "2024-04-01");
    expect(applyHint(a, puzzle)!.position).toBe(applyHint(a, puzzle)!.position);
  });

  it("returns null when puzzle solved", () => {
    let a = initAttempt("puz-0001", "2024-04-01");
    a = applyGuess(a, "CRACKER", puzzle).state;
    expect(applyHint(a, puzzle)).toBeNull();
  });

  it("returns null when all positions hinted", () => {
    let a = initAttempt("puz-0001", "2024-04-01");
    for (let i = 0; i < puzzle.bridgeLength; i++) {
      const h = applyHint(a, puzzle);
      expect(h).not.toBeNull();
      a = h!.state;
    }
    expect(applyHint(a, puzzle)).toBeNull();
  });
});

describe("share (REQ-019)", () => {
  it("TEST-020: emoji grid, no bridge word, star-free header on solve", () => {
    let a = initAttempt("puz-0001", "2024-04-01");
    a = applyGuess(a, "CRACKED", puzzle).state;
    a = applyGuess(a, "CRACKER", puzzle).state;
    const text = buildShareText(a, "2024-04-01");
    expect(text).toContain("Overlap 2024-04-01 2/6");
    expect(text).toMatch(/[🟩🟨⬛]/u);
    expect(isSpoilerSafe(text, "CRACKER")).toBe(true);
    expect(text.toUpperCase()).not.toContain("CRACKER");
  });

  it("failed puzzle shows X/6", () => {
    let a = initAttempt("puz-0001", "2024-04-01");
    for (let i = 0; i < 6; i++) a = applyGuess(a, "CRACKED", puzzle).state;
    expect(buildShareText(a, "2024-04-01")).toContain("X/6");
  });

  it("isSpoilerSafe flags a leak", () => {
    expect(isSpoilerSafe("the answer is CRACKER", "CRACKER")).toBe(false);
  });

  it("includes hint count when hints used", () => {
    let a = initAttempt("puz-0001", "2024-04-01");
    a = applyHint(a, puzzle)!.state;
    a = applyGuess(a, "CRACKER", puzzle).state;
    expect(buildShareText(a, "2024-04-01")).toContain("1 hints");
  });
});
