import { describe, it, expect } from "vitest";
import {
  isFairPair,
  sharedPositions,
  distinctLetters,
  buildPuzzles,
  assertPuzzlesValid,
} from "../src/games/mirrorle/content-build.ts";
import { buildShareText, isSpoilerSafe } from "../src/games/mirrorle/share.ts";
import type { AttemptState } from "../src/games/mirrorle/types.ts";

describe("content-build fairness gate", () => {
  it("computes shared positions", () => {
    expect(sharedPositions("CRANE", "CRATE")).toBe(4); // C R A _ E
    expect(sharedPositions("CRANE", "MOIST")).toBe(0);
  });
  it("computes distinct-letter symmetric difference", () => {
    expect(distinctLetters("CRANE", "MOIST")).toBe(10);
  });
  it("rejects identical, malformed, too-similar pairs", () => {
    expect(isFairPair("CRANE", "CRANE")).toBe(false); // identical
    expect(isFairPair("CRANE", "CRATE")).toBe(false); // 4 shared positions
    expect(isFairPair("CRAN", "MOIST")).toBe(false); // malformed
  });
  it("accepts a well-separated pair", () => {
    expect(isFairPair("CRANE", "MOIST")).toBe(true);
  });
  it("buildPuzzles emits only fair, in-list, deduped pairs with stable ids", () => {
    const answers = new Set(["CRANE", "MOIST", "PLANT", "STONE"]);
    const puzzles = buildPuzzles(
      [
        ["CRANE", "MOIST"],
        ["MOIST", "CRANE"], // reverse dup -> dropped
        ["CRANE", "CRATE"], // unfair -> dropped
        ["PLANT", "MOIST"],
      ],
      answers,
    );
    expect(puzzles.length).toBe(2);
    expect(puzzles[0].puzzleId).toBe("puz-0000");
    expect(() => assertPuzzlesValid(puzzles, answers)).not.toThrow();
  });
});

describe("share (spoiler-safe)", () => {
  const state: AttemptState = {
    puzzleId: "puz-0000",
    dayId: "2026-07-25",
    rows: [
      { guess: "CRATE", green: 4, yellow: 2 },
      { guess: "MOUSE", green: 3, yellow: 1 },
    ],
    isSolved: false,
    isFailed: false,
  };
  it("never contains the guesses or secrets", () => {
    const text = buildShareText(state, "2026-07-25");
    expect(isSpoilerSafe(text, ["CRANE", "MOIST"], ["CRATE", "MOUSE"])).toBe(true);
    expect(text).not.toContain("CRATE");
    expect(text).not.toContain("MOIST");
  });
  it("includes the day id and a score marker", () => {
    const text = buildShareText(state, "2026-07-25");
    expect(text).toContain("Mirrorle 2026-07-25");
    expect(text).toContain("X/9"); // unsolved
  });
  it("marks solved with the guess count", () => {
    const solved = { ...state, isSolved: true };
    expect(buildShareText(solved, "2026-07-25")).toContain("2/9");
  });
});
