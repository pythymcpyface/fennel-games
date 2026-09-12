import { describe, it, expect } from "vitest";
import {
  letterDiff,
  isValidLadder,
  isFairPath,
  buildPuzzle,
  assertPuzzleValid,
  findLadders,
} from "../src/games/driftword/content-build.ts";
import { buildShareText, isSpoilerSafe } from "../src/games/driftword/share.ts";
import type { AttemptState } from "../src/games/driftword/types.ts";

const dict = new Set(["CRANE", "CRATE", "GRATE", "GRACE", "TRACE", "TRICE", "SLATE", "PLATE", "PLANE"]);

describe("ladder validation", () => {
  it("letterDiff counts differing positions", () => {
    expect(letterDiff("CRANE", "CRATE")).toBe(1);
    expect(letterDiff("CRANE", "GRACE")).toBe(2);
  });
  it("isValidLadder requires one-letter steps", () => {
    expect(isValidLadder(["CRANE", "CRATE", "GRATE"])).toBe(true);
    expect(isValidLadder(["CRANE", "GRACE"])).toBe(false); // 2-letter jump
    expect(isValidLadder(["CRANE"])).toBe(false); // too short
  });
  it("isFairPath also requires dictionary membership", () => {
    expect(isFairPath(["CRANE", "CRATE"], dict)).toBe(true);
    expect(isFairPath(["CRANE", "CRAZE"], dict)).toBe(false); // CRAZE not in dict
  });
});

describe("buildPuzzle + gate", () => {
  it("builds a valid ladder puzzle", () => {
    const p = buildPuzzle(["CRANE", "CRATE", "GRATE"], dict, "puz-0000");
    expect(p).not.toBeNull();
    expect(() => assertPuzzleValid(p!, dict)).not.toThrow();
  });
  it("rejects an invalid ladder", () => {
    expect(buildPuzzle(["CRANE", "GRACE"], dict, "puz-0001")).toBeNull();
  });
});

describe("findLadders", () => {
  it("discovers a valid ladder of the requested length", () => {
    const ladders = findLadders([...dict], dict, 4, 5);
    expect(ladders.length).toBeGreaterThan(0);
    for (const path of ladders) {
      expect(path.length).toBe(4);
      expect(isFairPath(path, dict)).toBe(true);
    }
  });
});

describe("share (spoiler-safe)", () => {
  const state: AttemptState = {
    puzzleId: "puz-0000",
    dayId: "2026-07-25",
    rows: [
      { guess: "SLATE", marks: ["X", "X", "G", "X", "G"], targetIndex: 0 },
      { guess: "CRANE", marks: ["G", "G", "G", "G", "G"], targetIndex: 1 },
    ],
    isSolved: true,
    isFailed: false,
  };
  it("never contains any guess or path word", () => {
    const text = buildShareText(state, "2026-07-25");
    expect(isSpoilerSafe(text, ["SLATE", "CRANE", "CRATE"])).toBe(true);
    expect(text).not.toContain("SLATE");
    expect(text).not.toContain("CRANE");
  });
  it("shows day id and score", () => {
    const text = buildShareText(state, "2026-07-25");
    expect(text).toContain("Driftword 2026-07-25");
    expect(text).toContain("2/6");
  });
});
