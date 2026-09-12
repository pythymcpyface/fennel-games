import { describe, it, expect } from "vitest";
import {
  neighbours,
  dijkstraParCost,
  buildPuzzle,
  assertPuzzleValid,
} from "../src/games/tollgate/content-build.ts";
import { buildShareText, isSpoilerSafe } from "../src/games/tollgate/share.ts";
import type { AttemptState, Puzzle } from "../src/games/tollgate/types.ts";

const tolls = new Array(26).fill(2);
tolls[0] = 1; // A cheap
tolls[17] = 5; // R pricey
const wordSet = new Set(["COLD", "CORD", "CARD", "WORD", "WARD", "WARM", "WARE", "CARE"]);

describe("graph + dijkstra", () => {
  it("neighbours are one-letter changes present in the set", () => {
    const nb = neighbours("COLD", wordSet);
    expect(nb).toContain("CORD");
    expect(nb).not.toContain("CARD"); // 2 letters away
  });
  it("dijkstra finds the min-COST path (not min steps)", () => {
    // COLD->CORD(introduce R=5)->CARD(introduce A=1) = 6
    // COLD->CORD->WORD(introduce W=2)->WARD(A=1)->CARD(C=2) = 5+2+1+2 = 10 (longer & pricier)
    const par = dijkstraParCost("COLD", "CARD", tolls, wordSet);
    expect(par).toBe(6);
  });
  it("returns Infinity when unreachable", () => {
    const isolated = new Set(["COLD", "ZZZZ"]);
    expect(dijkstraParCost("COLD", "ZZZZ", tolls, isolated)).toBe(Infinity);
  });
});

describe("buildPuzzle + gate", () => {
  it("builds a puzzle with correct par", () => {
    const p = buildPuzzle("COLD", "CARD", tolls, wordSet, "puz-0000");
    expect(p).not.toBeNull();
    expect(p!.par).toBe(6);
    expect(() => assertPuzzleValid(p!, wordSet)).not.toThrow();
  });
  it("rejects identical or unreachable pairs", () => {
    expect(buildPuzzle("COLD", "COLD", tolls, wordSet, "x")).toBeNull();
    const isolated = new Set(["COLD", "ZZZZ"]);
    expect(buildPuzzle("COLD", "ZZZZ", tolls, isolated, "x")).toBeNull();
  });
});

describe("share (spoiler-safe)", () => {
  const puzzle: Puzzle = { puzzleId: "puz-0000", start: "COLD", target: "CARD", tolls, par: 6 };
  it("never contains start/target/path words; shows cost vs par when solved", () => {
    const state: AttemptState = { puzzleId: "puz-0000", dayId: "2026-07-25", path: ["COLD", "CORD", "CARD"], totalCost: 6, isSolved: true };
    const text = buildShareText(state, puzzle, "2026-07-25");
    expect(isSpoilerSafe(text, ["COLD", "CORD", "CARD"])).toBe(true);
    expect(text).toContain("Tollgate 2026-07-25");
    expect(text).toContain("par");
    expect(text).toContain("6");
  });
  it("shows unsolved state", () => {
    const state: AttemptState = { puzzleId: "puz-0000", dayId: "2026-07-25", path: ["COLD"], totalCost: 0, isSolved: false };
    expect(buildShareText(state, puzzle, "2026-07-25")).toContain("unsolved");
  });
});
