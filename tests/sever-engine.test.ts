import { describe, it, expect } from "vitest";
import {
  phraseToBreaks,
  segmentToTokens,
  isExactMatch,
  correctBreakCount,
  allTokensValid,
  initAttempt,
  toggleBreak,
  submit,
  canSubmit,
} from "../src/games/sever/engine.ts";
import { applyHint } from "../src/games/sever/hint.ts";
import { buildShareText, isSpoilerSafe } from "../src/games/sever/share.ts";
import type { Puzzle } from "../src/games/sever/types.ts";

// THE RAPIST FINISHED garden-path; use a clean example: "THERAPIST FINISHED"
const { puzzleString, intendedBreaks } = phraseToBreaks("THERAPIST FINISHED");
const puzzle: Puzzle = { puzzleId: "puz-0001", puzzleString, intendedBreaks };
const dictionary = new Set(["THERAPIST", "FINISHED", "THE", "RAPIST", "THERAPISTS"]);

describe("phraseToBreaks (REQ-003)", () => {
  it("TEST-005: strips spaces and marks the boundary", () => {
    expect(puzzleString).toBe("THERAPISTFINISHED");
    // boundary after THERAPIST (9 letters) => gap index 8 true
    expect(intendedBreaks[8]).toBe(true);
    expect(intendedBreaks.filter(Boolean)).toHaveLength(1);
    expect(intendedBreaks.length).toBe(puzzleString.length - 1);
  });

  it("handles three tokens", () => {
    const r = phraseToBreaks("A B C");
    expect(r.puzzleString).toBe("ABC");
    expect(r.intendedBreaks).toEqual([true, true]);
  });
});

describe("segmentToTokens", () => {
  it("splits on true gaps", () => {
    expect(segmentToTokens("ABC", [true, false])).toEqual(["A", "BC"]);
    expect(segmentToTokens(puzzleString, intendedBreaks)).toEqual(["THERAPIST", "FINISHED"]);
  });
});

describe("isExactMatch / correctBreakCount (REQ-008/011)", () => {
  it("exact match true only when identical", () => {
    expect(isExactMatch(intendedBreaks, intendedBreaks)).toBe(true);
    const wrong = [...intendedBreaks];
    wrong[2] = true;
    expect(isExactMatch(wrong, intendedBreaks)).toBe(false);
  });

  it("TEST-014: counts only true∧true positions", () => {
    const intended = [false, true, false, false, true, false, false];
    const candidate = [false, false, false, false, true, false, true];
    expect(correctBreakCount(candidate, intended)).toBe(1);
  });
});

describe("allTokensValid (REQ-012)", () => {
  it("TEST-015: true when all tokens are words", () => {
    expect(allTokensValid(puzzleString, intendedBreaks, dictionary)).toBe(true);
  });
  it("TEST-016: false when a token is not a word", () => {
    const breaks = new Array(intendedBreaks.length).fill(false);
    breaks[2] = true; // THE|RAPISTFINISHED
    expect(allTokensValid(puzzleString, breaks, dictionary)).toBe(false);
  });
});

describe("toggle + submit (REQ-006/009/010/017)", () => {
  it("toggles a gap", () => {
    const a = initAttempt(puzzle, "2024-04-01");
    const b = toggleBreak(a, 8);
    expect(b.breaks[8]).toBe(true);
    expect(a.breaks[8]).toBe(false); // pure
  });

  it("TEST-013: correct submission solves", () => {
    let a = initAttempt(puzzle, "2024-04-01");
    a = { ...a, breaks: [...intendedBreaks] };
    const out = submit(a, puzzle, dictionary);
    expect(out.solved).toBe(true);
    expect(out.state.isSolved).toBe(true);
    expect(out.state.attemptsUsed).toBe(0);
  });

  it("TEST-012: incorrect submission increments attempts + returns feedback", () => {
    const a = initAttempt(puzzle, "2024-04-01");
    const out = submit(a, puzzle, dictionary);
    expect(out.solved).toBe(false);
    expect(out.state.attemptsUsed).toBe(1);
    expect(out.feedback).toBeDefined();
    expect(out.feedback!.correctBreakCount).toBe(0);
  });

  it("TEST-021: fails after attempt limit and blocks further submits", () => {
    let a = initAttempt(puzzle, "2024-04-01");
    for (let i = 0; i < 6; i++) a = submit(a, puzzle, dictionary).state;
    expect(a.isFailed).toBe(true);
    expect(canSubmit(a)).toBe(false);
    const after = submit(a, puzzle, dictionary);
    expect(after.state.attemptsUsed).toBe(6);
  });
});

describe("hint (REQ-014/015)", () => {
  it("TEST-018: reveals the lowest unrevealed correct break, sets + locks it", () => {
    const a = initAttempt(puzzle, "2024-04-01");
    const h = applyHint(a, puzzle)!;
    expect(h.gapIndex).toBe(8);
    expect(h.state.breaks[8]).toBe(true);
    expect(h.state.revealedBreaks).toEqual([8]);
    expect(h.state.hintUsedCount).toBe(1);
    // locked: toggling it off is a no-op
    expect(toggleBreak(h.state, 8).breaks[8]).toBe(true);
  });

  it("returns null when no correct breaks remain", () => {
    const a = { ...initAttempt(puzzle, "2024-04-01"), revealedBreaks: [8] };
    expect(applyHint(a, puzzle)).toBeNull();
  });
});

describe("share (REQ-018)", () => {
  it("TEST-022/023: rows per attempt + solve, spoiler-safe", () => {
    let a = initAttempt(puzzle, "2024-04-01");
    a = submit(a, puzzle, dictionary).state; // 1 wrong
    a = { ...a, breaks: [...intendedBreaks] };
    a = submit(a, puzzle, dictionary).state; // solve
    const text = buildShareText(a, "2024-04-01");
    expect(text).toContain("Sever 2024-04-01 2/6");
    expect(text.split("\n")[1].length).toBeGreaterThanOrEqual(2); // rows
    expect(isSpoilerSafe(text, puzzleString)).toBe(true);
    expect(text.toUpperCase()).not.toContain("THERAPIST");
  });

  it("isSpoilerSafe flags a leak", () => {
    expect(isSpoilerSafe("answer THERAPISTFINISHED", puzzleString)).toBe(false);
  });
});
