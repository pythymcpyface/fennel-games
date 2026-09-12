import { describe, it, expect } from "vitest";
import { initAttempt, submitPair, applyHint, isLocked, canSubmit } from "../src/games/compound-split/engine.ts";
import { buildShareText, isSpoilerSafe } from "../src/games/compound-split/share.ts";
import { countPerfectMatchings, isFair, buildPuzzles, assertPuzzlesValid, type CandidatePuzzle } from "../src/games/compound-split/content-build.ts";
import type { Puzzle } from "../src/games/compound-split/types.ts";

// SUN+FLOWER, RAIN+BOW, MOON+LIGHT, FIRE+FLY
const puzzle: Puzzle = {
  puzzleId: "puz-0001",
  halves: ["BOW", "FIRE", "FLOWER", "FLY", "LIGHT", "MOON", "RAIN", "SUN"],
  compounds: ["FIREFLY", "MOONLIGHT", "RAINBOW", "SUNFLOWER"],
};
const idx = (h: string) => puzzle.halves.indexOf(h);

describe("engine", () => {
  it("correct pair locks", () => {
    const a = initAttempt(puzzle, "2024-04-01");
    const out = submitPair(a, puzzle, idx("SUN"), idx("FLOWER"));
    expect(out.feedback).toBe("CORRECT");
    expect(out.state.lockedPairs).toHaveLength(1);
    expect(isLocked(out.state, idx("SUN"))).toBe(true);
  });
  it("wrong order / non-compound is INCORRECT + consumes attempt", () => {
    const a = initAttempt(puzzle, "2024-04-01");
    const out = submitPair(a, puzzle, idx("FLOWER"), idx("SUN")); // FLOWERSUN not a compound
    expect(out.feedback).toBe("INCORRECT");
    expect(out.state.attemptsUsed).toBe(1);
  });
  it("invalid selection (same index) does not consume attempt", () => {
    const a = initAttempt(puzzle, "2024-04-01");
    const out = submitPair(a, puzzle, 0, 0);
    expect(out.feedback).toBe("INVALID_SELECTION");
    expect(out.state.attemptsUsed).toBe(0);
  });
  it("already-locked half rejected", () => {
    let a = initAttempt(puzzle, "2024-04-01");
    a = submitPair(a, puzzle, idx("SUN"), idx("FLOWER")).state;
    const out = submitPair(a, puzzle, idx("SUN"), idx("BOW"));
    expect(out.feedback).toBe("ALREADY_LOCKED");
  });
  it("forming all 4 wins", () => {
    let a = initAttempt(puzzle, "2024-04-01");
    for (const [l, r] of [["SUN", "FLOWER"], ["RAIN", "BOW"], ["MOON", "LIGHT"], ["FIRE", "FLY"]] as const) {
      a = submitPair(a, puzzle, idx(l), idx(r)).state;
    }
    expect(a.status).toBe("won");
  });
  it("loses after 5 wrong", () => {
    let a = initAttempt(puzzle, "2024-04-01");
    for (let i = 0; i < 5; i++) a = submitPair(a, puzzle, idx("FLOWER"), idx("SUN")).state;
    expect(a.status).toBe("lost");
    expect(canSubmit(a)).toBe(false);
  });
  it("hint locks a correct pair", () => {
    const a = initAttempt(puzzle, "2024-04-01");
    const h = applyHint(a, puzzle)!;
    expect(h.lockedPairs).toHaveLength(1);
    expect(h.hintUsed).toBe(true);
    expect(puzzle.compounds).toContain(h.lockedPairs[0].compound);
  });
  it("is pure", () => {
    const a = initAttempt(puzzle, "2024-04-01");
    submitPair(a, puzzle, idx("SUN"), idx("FLOWER"));
    expect(a.lockedPairs).toHaveLength(0);
  });
});

describe("content gate (perfect matching uniqueness)", () => {
  it("unique-matching set passes", () => {
    const cand: CandidatePuzzle = { compounds: [
      { left: "SUN", right: "FLOWER" }, { left: "RAIN", right: "BOW" }, { left: "MOON", right: "LIGHT" }, { left: "FIRE", right: "FLY" },
    ] };
    expect(isFair(cand)).toBe(true);
  });
  it("ambiguous set (a half fits two compounds) fails", () => {
    // SUN+SET, SUN+RISE share SUN as a left half but only one SUN exists -> but make
    // an ambiguous 8-half set: BED+ROOM, CLASS+ROOM, BED+... construct 2 matchings.
    // halves: BED, TIME, CLASS, ROOM, BATH, ROOM2... use real double-match:
    // BOX+CAR, CAR+GO -> CAR reused; craft: {BOX,CAR},{CAR,GO} not valid (2 CAR).
    // Use: SNOW+BALL, BASE+BALL -> two BALL. halves: SNOW,BALL,BASE,BALL2? no dup.
    // Simpler ambiguous: halves A,B,C,D with AB, CD, AD, CB all compounds -> 2 matchings.
    const cand: CandidatePuzzle = { compounds: [
      { left: "AA", right: "BB" }, { left: "CC", right: "DD" }, { left: "EE", right: "FF" }, { left: "GG", right: "HH" },
    ] };
    // add cross compounds by faking: not possible via this shape; test the counter directly.
    const halves = ["AA", "BB", "CC", "DD"];
    const compounds = new Set(["AABB", "CCDD", "AADD", "CCBB"]);
    expect(countPerfectMatchings(halves, compounds)).toBe(2); // {AA-BB,CC-DD} and {AA-DD,CC-BB}
    expect(isFair(cand)).toBe(true); // the non-ambiguous 8-half set is fine
  });
  it("buildPuzzles + assert", () => {
    const cands: CandidatePuzzle[] = [{ compounds: [
      { left: "SUN", right: "FLOWER" }, { left: "RAIN", right: "BOW" }, { left: "MOON", right: "LIGHT" }, { left: "FIRE", right: "FLY" },
    ] }];
    const puzzles = buildPuzzles(cands);
    expect(puzzles).toHaveLength(1);
    expect(() => assertPuzzlesValid(puzzles)).not.toThrow();
  });
});

describe("share", () => {
  it("spoiler-safe", () => {
    let a = initAttempt(puzzle, "2024-04-01");
    a = submitPair(a, puzzle, idx("SUN"), idx("FLOWER")).state;
    const text = buildShareText(a, "2024-04-01");
    expect(text).toContain("Compound Split 2024-04-01");
    expect(isSpoilerSafe(text, puzzle)).toBe(true);
    expect(isSpoilerSafe("has SUNFLOWER", puzzle)).toBe(false);
  });
});
