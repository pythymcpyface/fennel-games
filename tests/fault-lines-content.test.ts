import { describe, it, expect } from "vitest";
import {
  validate,
  buildPuzzle,
  assertPuzzleValid,
  trueGridConflict,
  norm,
  type RawPuzzle,
} from "../src/games/fault-lines/content-build.ts";
import { buildShareText, isSpoilerSafe } from "../src/games/fault-lines/share.ts";
import { initAttempt, toggleFlag, scoreAudit } from "../src/games/fault-lines/engine.ts";

const DICT = new Set(["OCEAN", "MAPLE", "APPLE", "THRONE", "DAY", "ICE", "MELON", "LEMON"]);

// Two independent rows (no crossings): row0 OCEAN (ok), row1 MAPLE shown as APPLE (fault).
function raw(): RawPuzzle {
  return {
    rows: 2,
    cols: 5,
    blocks: [],
    entries: [
      { entryId: "A-1", number: 1, direction: "ACROSS", clue: "sea", trueAnswer: "OCEAN", displayedAnswer: "OCEAN", cells: [0, 1, 2, 3, 4], isFaulty: false },
      { entryId: "A-2", number: 2, direction: "ACROSS", clue: "syrup tree", trueAnswer: "MAPLE", displayedAnswer: "APPLE", cells: [5, 6, 7, 8, 9], isFaulty: true },
    ],
  };
}

describe("fault-lines content-build — fairness gate", () => {
  it("accepts a well-formed puzzle with one fault", () => {
    expect(validate(raw(), DICT)).toEqual([]);
    const p = buildPuzzle("puz-0000", raw(), DICT)!;
    expect(p).not.toBeNull();
    expect(p.faultCount).toBe(1);
    expect(p.letters[5]).toBe("A"); // displayed APPLE laid into the grid
    expect(() => assertPuzzleValid(raw(), DICT)).not.toThrow();
  });

  it("rejects a fault whose displayed word equals the true word (REQ-023)", () => {
    const r = raw();
    r.entries[1].displayedAnswer = "MAPLE"; // no longer a deviation
    expect(validate(r, DICT)).toContain("A-2: marked faulty but displayed == true");
  });

  it("rejects a fault whose displayed word is not in the dictionary (REQ-024)", () => {
    const r = raw();
    r.entries[1].displayedAnswer = "XPPLE";
    const reasons = validate(r, DICT);
    expect(reasons.some((x) => x.includes("not in dictionary"))).toBe(true);
  });

  it("rejects mismatched answer length vs cell count (REQ-020/021)", () => {
    const r = raw();
    r.entries[0].displayedAnswer = "SEA"; // 3 chars into a 5-cell slot
    const reasons = validate(r, DICT);
    expect(reasons.some((x) => x.includes("displayed length != cell count"))).toBe(true);
  });

  it("rejects a puzzle with no faults or all faults (REQ-025)", () => {
    const none = raw();
    none.entries[1].displayedAnswer = "MAPLE";
    none.entries[1].isFaulty = false;
    expect(validate(none, DICT)).toContain("puzzle has no faults");

    const all = raw();
    all.entries[0].displayedAnswer = "APPLE"; // deviate row0 too
    all.entries[0].isFaulty = true;
    all.entries[0].trueAnswer = "OCEAN";
    expect(validate(all, DICT)).toContain("puzzle is entirely faults");
  });

  it("detects true-grid crossing conflicts (REQ-022)", () => {
    // Two crossing entries whose true letters disagree at the shared cell 2.
    const crossing: RawPuzzle = {
      rows: 1,
      cols: 5,
      blocks: [],
      entries: [
        { entryId: "A-1", number: 1, direction: "ACROSS", clue: "x", trueAnswer: "OCEAN", displayedAnswer: "OCEAN", cells: [0, 1, 2, 3, 4], isFaulty: false },
        { entryId: "D-1", number: 1, direction: "DOWN", clue: "y", trueAnswer: "MAP", displayedAnswer: "MAP", cells: [2, 3, 4], isFaulty: false }, // cell2: 'E' vs 'M'
      ],
    };
    expect(trueGridConflict(crossing)).toBe(2);
    expect(validate(crossing, DICT).some((x) => x.includes("crossing conflict"))).toBe(true);
  });

  it("norm uppercases and trims", () => {
    expect(norm("  ocean ")).toBe("OCEAN");
  });
});

describe("fault-lines share — spoiler safety", () => {
  it("emits a correctness grid + score with no answers", () => {
    const p = buildPuzzle("puz-0000", raw(), DICT)!;
    let s = initAttempt(p, "2026-01-01");
    s = toggleFlag(s, p, 1).state; // correctly flag the fault
    const r = scoreAudit(s, p);
    const text = buildShareText(r, p, "2026-01-01");
    expect(text).toContain("Fault Lines 2026-01-01");
    expect(text).toContain("🟩");
    expect(isSpoilerSafe(text, p)).toBe(true);
    for (const e of p.entries) expect(text.toUpperCase()).not.toContain(e.displayedAnswer);
  });

  it("isSpoilerSafe flags text containing a displayed answer", () => {
    const p = buildPuzzle("puz-0000", raw(), DICT)!;
    expect(isSpoilerSafe("Fault Lines APPLE", p)).toBe(false);
  });
});
