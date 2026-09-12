import { describe, it, expect } from "vitest";
import { phraseToMask, segmentToTokens, isExactMatch, correctBreakCount, initAttempt, toggleGap, submit, applyHint, canSubmit } from "../src/games/kerning/engine.ts";
import { buildShareText, isSpoilerSafe } from "../src/games/kerning/share.ts";
import { isValidPair, buildPuzzles, assertPuzzlesValid, enumerateSegmentations, type CandidatePair } from "../src/games/kerning/content-build.ts";
import type { Puzzle } from "../src/games/kerning/types.ts";

// NOWHERE: "NOW HERE" (A) vs "NO WHERE" (B)
const a = phraseToMask("NOW HERE");
const b = phraseToMask("NO WHERE");
const puzzle: Puzzle = { puzzleId: "puz-0001", letterRun: a.letterRun, shownMask: a.mask, targetMask: b.mask };
const dict = new Set(["NOW", "HERE", "NO", "WHERE", "NOWHERE"]);

describe("phraseToMask + segment", () => {
  it("NOW HERE -> NOWHERE with break after index 2", () => {
    expect(a.letterRun).toBe("NOWHERE");
    expect(a.mask[2]).toBe(true); // after 'NOW'
    expect(segmentToTokens("NOWHERE", a.mask)).toEqual(["NOW", "HERE"]);
  });
  it("NO WHERE breaks after index 1", () => {
    expect(b.mask[1]).toBe(true);
    expect(segmentToTokens("NOWHERE", b.mask)).toEqual(["NO", "WHERE"]);
  });
});

describe("submit (REQ-011..016)", () => {
  it("exact reading B wins", () => {
    const s = { ...initAttempt(puzzle, "2024-04-01"), mask: [...b.mask] };
    const out = submit(s, puzzle, dict);
    expect(out.solved).toBe(true);
    expect(out.state.status).toBe("won");
  });
  it("wrong (reading A) consumes attempt + feedback", () => {
    const s = initAttempt(puzzle, "2024-04-01"); // starts at reading A
    const out = submit(s, puzzle, dict);
    expect(out.solved).toBe(false);
    expect(out.feedback!.allTokensAreDictionaryWords).toBe(true); // NOW/HERE are words
    expect(out.state.attemptsUsed).toBe(1);
  });
  it("counts correct breaks (true∧true)", () => {
    expect(correctBreakCount(a.mask, b.mask)).toBe(0); // different positions
    expect(correctBreakCount(b.mask, b.mask)).toBe(1);
  });
  it("fails after 6 wrong", () => {
    let s = initAttempt(puzzle, "2024-04-01");
    for (let i = 0; i < 6; i++) s = submit(s, puzzle, dict).state;
    expect(s.status).toBe("lost");
    expect(canSubmit(s)).toBe(false);
  });
});

describe("toggle + hint", () => {
  it("toggles a gap", () => {
    const s = initAttempt(puzzle, "2024-04-01");
    const t = toggleGap(s, 1);
    expect(t.mask[1]).toBe(true);
  });
  it("hint reveals lowest target break and locks it", () => {
    const s = initAttempt(puzzle, "2024-04-01");
    const h = applyHint(s, puzzle)!;
    expect(h.gapIndex).toBe(1); // NO|WHERE break at index 1
    expect(h.state.mask[1]).toBe(true);
    expect(toggleGap(h.state, 1).mask[1]).toBe(true); // locked
  });
});

describe("content gate (isValidPair)", () => {
  it("NOWHERE has exactly two multi-token segmentations", () => {
    const segs = enumerateSegmentations("NOWHERE", dict).filter((s) => s.length >= 2).map((s) => s.join(" "));
    expect(new Set(segs)).toEqual(new Set(["NOW HERE", "NO WHERE"]));
  });
  it("accepts a valid A/B pair (both multi-token, differing)", () => {
    expect(isValidPair({ readingA: "NOW HERE", readingB: "NO WHERE" }, dict)).toBe(true);
  });
  it("rejects when a reading has a non-dictionary token", () => {
    expect(isValidPair({ readingA: "NOW HERE", readingB: "NOW HXRE" }, dict)).toBe(false);
  });
  it("rejects when A equals B", () => {
    expect(isValidPair({ readingA: "NOW HERE", readingB: "NOW HERE" }, dict)).toBe(false);
  });
  it("buildPuzzles emits valid pairs", () => {
    const cands: CandidatePair[] = [{ readingA: "NOW HERE", readingB: "NO WHERE" }];
    const puzzles = buildPuzzles(cands, dict);
    expect(puzzles).toHaveLength(1);
    expect(() => assertPuzzlesValid(puzzles)).not.toThrow();
  });
});

describe("share", () => {
  it("spoiler-safe", () => {
    let s = initAttempt(puzzle, "2024-04-01");
    s = submit(s, puzzle, dict).state;
    s = { ...s, mask: [...b.mask] };
    s = submit(s, puzzle, dict).state;
    const text = buildShareText(s, "2024-04-01");
    expect(text).toContain("Kerning 2024-04-01");
    expect(isSpoilerSafe(text, puzzle)).toBe(true);
    expect(text.toUpperCase()).not.toContain("NOWHERE");
  });
  it("flags leak", () => {
    expect(isSpoilerSafe("run NOWHERE", puzzle)).toBe(false);
  });
});

// silence unused
void isExactMatch;
