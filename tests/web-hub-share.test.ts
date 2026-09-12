import { describe, it, expect } from "vitest";
import { degreeBlock, buildShareText, isSpoilerSafe } from "../src/games/web-hub/share.ts";
import { initAttempt, submit } from "../src/games/web-hub/engine.ts";
import type { Puzzle } from "../src/games/web-hub/types.ts";

const puzzle: Puzzle = {
  puzzleId: "puz-0000",
  board: ["aced", "aces", "acid", "awed", "iced", "lewd", "nits", "vend"],
  hub: "aced",
  degrees: { aced: 4, aces: 1, acid: 1, awed: 1, iced: 1, lewd: 0, nits: 0, vend: 0 },
  adjacency: { aced: ["aces", "acid", "awed", "iced"], aces: ["aced"], acid: ["aced"], awed: ["aced"], iced: ["aced"], lewd: [], nits: [], vend: [] },
};

describe("degreeBlock", () => {
  it("returns green for the hub", () => expect(degreeBlock(4, true, 4)).toBe("🟩"));
  it("returns a cool block for a low-degree miss", () => expect(degreeBlock(0, false, 4)).toBe("🟦"));
});

describe("buildShareText / isSpoilerSafe", () => {
  it("summarises a win without leaking words", () => {
    const st = submit(initAttempt(puzzle, "2026-01-01"), puzzle, "aced").state;
    const text = buildShareText(st, "2026-01-01", 4);
    expect(text).toContain("Web Hub 2026-01-01");
    expect(text).toContain("1/3");
    expect(isSpoilerSafe(text, puzzle)).toBe(true);
  });

  it("flags a board-word leak", () => {
    expect(isSpoilerSafe("Web Hub x aced", puzzle)).toBe(false);
  });

  it("marks a loss with X", () => {
    let st = initAttempt(puzzle, "2026-01-01");
    for (const w of ["aces", "acid", "awed"]) st = submit(st, puzzle, w).state;
    expect(buildShareText(st, "2026-01-01", 4)).toContain("X/3");
  });
});
