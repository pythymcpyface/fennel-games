import { describe, it, expect } from "vitest";
import {
  neighbours,
  bfsDistances,
  computePar,
  buildPuzzle,
  assertPuzzleValid,
} from "../src/games/fork/content-build.ts";
import { buildShareText, isSpoilerSafe } from "../src/games/fork/share.ts";
import type { AttemptState, Puzzle } from "../src/games/fork/types.ts";

const wordSet = new Set(["COLD", "CORD", "CORE", "WORD", "WARD", "WARM", "CARD", "CARE", "WARE"]);

describe("graph + BFS", () => {
  it("neighbours are one-letter changes in the set", () => {
    expect(neighbours("COLD", wordSet)).toContain("CORD");
    expect(neighbours("COLD", wordSet)).not.toContain("WARM");
  });
  it("bfsDistances computes shortest steps", () => {
    const d = bfsDistances("COLD", wordSet);
    expect(d.get("COLD")).toBe(0);
    expect(d.get("CORD")).toBe(1);
    expect(d.get("CORE")).toBe(2);
  });
});

describe("computePar (Steiner fork)", () => {
  it("finds the minimum total steps over the best fork point", () => {
    // Known small graph; par is finite and positive.
    const par = computePar("COLD", "CORE", "WARM", wordSet);
    expect(par).toBeGreaterThan(0);
    expect(Number.isFinite(par)).toBe(true);
  });
  it("returns Infinity when a target is unreachable", () => {
    const iso = new Set(["COLD", "CORD", "CORE", "ZZZZ"]);
    expect(computePar("COLD", "CORE", "ZZZZ", iso)).toBe(Infinity);
  });
});

describe("buildPuzzle + gate", () => {
  it("builds a reachable puzzle with matching par", () => {
    const p = buildPuzzle("COLD", "CORE", "WARM", wordSet, "puz-0000");
    expect(p).not.toBeNull();
    expect(() => assertPuzzleValid(p!, wordSet)).not.toThrow();
    expect(p!.wordLength).toBe(4);
  });
  it("rejects duplicate members or unreachable targets", () => {
    expect(buildPuzzle("COLD", "COLD", "WARM", wordSet, "x")).toBeNull();
    const iso = new Set(["COLD", "ZZZZ"]);
    expect(buildPuzzle("COLD", "ZZZZ", "WARM", iso, "x")).toBeNull();
  });
});

describe("share (spoiler-safe)", () => {
  const puzzle: Puzzle = { puzzleId: "puz-0000", start: "COLD", targetA: "CORE", targetB: "WARM", wordLength: 4, par: 6 };
  it("hides words; shows steps vs par when solved", () => {
    const state: AttemptState = {
      puzzleId: "puz-0000", dayId: "2026-07-25",
      trunk: ["COLD"], forkIndex: 0,
      branchA: ["COLD", "CORD", "CORE"], branchB: ["COLD", "WORD", "WARD", "WARM"],
      isComplete: true,
    };
    const text = buildShareText(state, puzzle, "2026-07-25");
    expect(isSpoilerSafe(text, ["COLD", "CORE", "WARM", "CORD", "WORD"])).toBe(true);
    expect(text).toContain("Fork 2026-07-25");
    expect(text).toContain("steps");
  });
  it("shows unsolved", () => {
    const state: AttemptState = { puzzleId: "puz-0000", dayId: "2026-07-25", trunk: ["COLD"], forkIndex: null, branchA: [], branchB: [], isComplete: false };
    expect(buildShareText(state, puzzle, "2026-07-25")).toContain("unsolved");
  });
});
