import { describe, it, expect } from "vitest";
import { buildShareText, isSpoilerSafe, edgeBlock } from "../src/games/edit-clusters/share.ts";
import { initAttempt, submit } from "../src/games/edit-clusters/engine.ts";
import type { Puzzle } from "../src/games/edit-clusters/types.ts";

const adjacency: Record<string, string[]> = {
  bare: ["care", "dare", "fare"], care: ["bare", "dare", "fare"], dare: ["bare", "care", "fare"], fare: ["bare", "care", "dare"],
  airy: [], lies: [], offs: [], tame: [], wist: [],
};
const puzzle: Puzzle = {
  puzzleId: "puz-0000",
  board: ["airy", "bare", "care", "dare", "fare", "lies", "offs", "tame", "wist"],
  cluster: ["bare", "care", "dare", "fare"],
  maxEdges: 6,
  adjacency,
};

describe("edgeBlock", () => {
  it("returns the solved block when correct", () => {
    expect(edgeBlock(3, true)).toBe("🟩");
  });
  it("maps low edge counts to darker blocks", () => {
    expect(edgeBlock(0, false)).toBe("⬛");
  });
});

describe("buildShareText / isSpoilerSafe", () => {
  it("summarises a win without leaking words", () => {
    let st = initAttempt(puzzle, "2026-01-01");
    st = submit(st, puzzle, ["bare", "care", "dare", "airy"]).state;
    st = submit(st, puzzle, ["bare", "care", "dare", "fare"]).state;
    const text = buildShareText(st, "2026-01-01");
    expect(text).toContain("Edit Clusters 2026-01-01");
    expect(text).toContain("2/4");
    expect(isSpoilerSafe(text, puzzle)).toBe(true);
  });

  it("flags a share string that leaks a board word", () => {
    expect(isSpoilerSafe("Edit Clusters 2026-01-01 fare", puzzle)).toBe(false);
  });

  it("marks a loss with X", () => {
    let st = initAttempt(puzzle, "2026-01-01");
    for (const d of ["airy", "lies", "offs", "tame"]) st = submit(st, puzzle, ["bare", "care", "dare", d]).state;
    expect(buildShareText(st, "2026-01-01")).toContain("X/4");
  });
});
