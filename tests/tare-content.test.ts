import { describe, it, expect } from "vitest";
import {
  validate,
  buildPuzzle,
  assertPuzzleValid,
  rackFromLetters,
  weightFor,
  LETTER_WEIGHT,
  type RawPuzzle,
} from "../src/games/tare/content-build.ts";
import { buildShareText, isSpoilerSafe } from "../src/games/tare/share.ts";
import { initAttempt, submit } from "../src/games/tare/engine.ts";

const dict = new Set(["CAT", "DOG", "ACT", "TAD"]);

function raw(): RawPuzzle {
  return { rack: rackFromLetters("CATDOG"), tolerance: 0, guaranteedLeft: "CAT", guaranteedRight: "DOG" };
}

describe("tare content-build — weights & rack", () => {
  it("weightFor uses the letter table with fallback 1", () => {
    expect(weightFor("E")).toBe(LETTER_WEIGHT.E);
    expect(weightFor("Q")).toBe(10);
  });

  it("rackFromLetters builds weighted tiles with unique ids", () => {
    const rack = rackFromLetters("CAT");
    expect(rack).toHaveLength(3);
    expect(new Set(rack.map((t) => t.id)).size).toBe(3);
    expect(rack[0]).toMatchObject({ letter: "C", weight: weightFor("C") });
  });
});

describe("tare content-build — fairness gate", () => {
  it("accepts a valid, balanced, rack-consuming solution", () => {
    expect(validate(raw(), dict)).toEqual([]);
    const p = buildPuzzle("puz-0000", raw(), dict)!;
    expect(p).not.toBeNull();
    expect(p.tolerance).toBe(0);
    expect(() => assertPuzzleValid(raw(), dict)).not.toThrow();
  });

  it("rejects a guaranteed word not in the dictionary", () => {
    const r = raw();
    r.guaranteedLeft = "CTA";
    expect(validate(r, dict).some((x) => x.includes("not in dictionary"))).toBe(true);
  });

  it("rejects a solution that does not consume the rack exactly", () => {
    const r = raw();
    r.guaranteedRight = "GOD"; // GOD uses G,O,D — same as DOG, still consumes rack; use a real mismatch:
    r.rack = rackFromLetters("CATDOGX"); // extra X not used by CAT+DOG
    r.guaranteedRight = "DOG";
    expect(validate(r, dict).some((x) => x.includes("consume the rack exactly"))).toBe(true);
  });

  it("rejects a solution whose imbalance exceeds tolerance", () => {
    // ACT (5) vs TAD (4) → imbalance 1 > tolerance 0.
    const r: RawPuzzle = { rack: rackFromLetters("ACTTAD"), tolerance: 0, guaranteedLeft: "ACT", guaranteedRight: "TAD" };
    expect(validate(r, dict).some((x) => x.includes("imbalance"))).toBe(true);
    // With tolerance 1 it passes.
    const r2: RawPuzzle = { ...r, tolerance: 1 };
    expect(validate(r2, dict)).toEqual([]);
  });
});

describe("tare share — spoiler safety", () => {
  it("emits a band + shape without the words", () => {
    const p = buildPuzzle("puz-0000", raw(), dict)!;
    let s = initAttempt(p, "2026-01-01");
    s = submit(s, p, "CAT", "DOG", dict).state;
    const text = buildShareText(s, "PERFECT", "2026-01-01");
    expect(text).toContain("Tare 2026-01-01 PERFECT");
    expect(text).toContain("3|3");
    expect(isSpoilerSafe(text, s)).toBe(true);
    expect(text.toUpperCase()).not.toContain("CAT");
    expect(text.toUpperCase()).not.toContain("DOG");
  });

  it("isSpoilerSafe flags text containing a word", () => {
    const s = { puzzleId: "p", dayId: "d", leftWord: "CAT", rightWord: "DOG", isComplete: true, imbalance: 0 };
    expect(isSpoilerSafe("Tare CAT", s)).toBe(false);
  });
});
