import { describe, it, expect } from "vitest";
import { validate, buildPuzzle, assertPuzzleValid, norm, type RawPuzzle } from "../src/games/undertow/content-build.ts";
import { buildShareText, isSpoilerSafe } from "../src/games/undertow/share.ts";
import { initAttempt, applySelection } from "../src/games/undertow/engine.ts";

// OCEAN reversed = NAECO on row0; decoy WAVE forward on row1.
function raw(): RawPuzzle {
  return {
    rows: 3,
    cols: 5,
    grid: ["NAECO", "WAVEX", "QRSTU"],
    targets: [{ id: "T0", word: "OCEAN", start: { row: 0, col: 0 }, end: { row: 0, col: 4 } }],
    decoys: [{ id: "D0", word: "WAVE", start: { row: 1, col: 0 }, end: { row: 1, col: 3 } }],
    mistakeBudget: 0,
  };
}

describe("undertow content-build — fairness gate", () => {
  it("accepts a valid puzzle (target reversed, decoy forward)", () => {
    expect(validate(raw())).toEqual([]);
    const p = buildPuzzle("puz-0000", raw())!;
    expect(p).not.toBeNull();
    expect(p.targets[0].word).toBe("OCEAN");
    expect(() => assertPuzzleValid(raw())).not.toThrow();
  });

  it("rejects a target that does not read reversed along its line (REQ-021)", () => {
    const r = raw();
    r.grid[0] = "OCEAN"; // now reads OCEAN forward, reverse = NAECO != target
    expect(validate(r).some((x) => x.includes("does not read reversed"))).toBe(true);
  });

  it("rejects a decoy that does not read forward along its line (REQ-022)", () => {
    const r = raw();
    r.grid[1] = "EVAWX"; // WAVE reversed; forward read != WAVE
    expect(validate(r).some((x) => x.includes("does not read forward"))).toBe(true);
  });

  it("rejects grid dimension mismatches (REQ-024)", () => {
    const r = raw();
    r.cols = 6;
    expect(validate(r).some((x) => x.includes("cols"))).toBe(true);
  });

  it("rejects a word length not matching its line span (REQ-025)", () => {
    const r = raw();
    r.targets[0].end = { row: 0, col: 3 }; // 4 cells for a 5-letter word
    expect(validate(r).some((x) => x.includes("line spans"))).toBe(true);
  });

  it("rejects a target line identical to a decoy line (REQ-023)", () => {
    const r = raw();
    // Put decoy on the same line as the target (swapped endpoints = identical line).
    r.decoys[0] = { id: "D0", word: "NAECO", start: { row: 0, col: 4 }, end: { row: 0, col: 0 } };
    expect(validate(r).some((x) => x.includes("shares a line"))).toBe(true);
  });

  it("rejects duplicate placement ids", () => {
    const r = raw();
    r.decoys[0].id = "T0";
    expect(validate(r)).toContain("duplicate placement id");
  });

  it("norm uppercases + trims", () => {
    expect(norm("  ocean ")).toBe("OCEAN");
  });
});

describe("undertow share — spoiler safety", () => {
  it("emits a found/missed grid + mistakes with no words", () => {
    const p = buildPuzzle("puz-0000", raw())!;
    let s = initAttempt(p, "2026-01-01");
    s = applySelection(s, p, { row: 0, col: 0 }, { row: 0, col: 4 }).state; // find OCEAN
    const text = buildShareText(s, p, "2026-01-01");
    expect(text).toContain("Undertow 2026-01-01 1/1");
    expect(text).toContain("🟩");
    expect(isSpoilerSafe(text, p)).toBe(true);
    expect(text.toUpperCase()).not.toContain("OCEAN");
    expect(text.toUpperCase()).not.toContain("WAVE");
  });

  it("isSpoilerSafe flags text containing a target or decoy word", () => {
    const p = buildPuzzle("puz-0000", raw())!;
    expect(isSpoilerSafe("Undertow OCEAN", p)).toBe(false);
    expect(isSpoilerSafe("Undertow WAVE", p)).toBe(false);
  });
});
