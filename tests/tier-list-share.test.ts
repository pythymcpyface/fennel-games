import { describe, it, expect } from "vitest";
import { positionBar, buildShareText, isSpoilerSafe } from "../src/games/tier-list/share.ts";
import { initAttempt, submit } from "../src/games/tier-list/engine.ts";
import type { Puzzle } from "../src/games/tier-list/types.ts";

const puzzle: Puzzle = {
  puzzleId: "puz-0000",
  words: ["absent", "fact", "huckster", "meerkats", "premised"],
  order: ["fact", "absent", "premised", "huckster", "meerkats"],
  tiers: { fact: 10, absent: 20, premised: 35, huckster: 50, meerkats: 70 },
};

describe("positionBar", () => {
  it("fills correct positions", () => expect(positionBar(3)).toBe("🟦🟦🟦⬜⬜"));
});

describe("buildShareText / isSpoilerSafe", () => {
  it("summarises a win without leaking words", () => {
    const st = submit(initAttempt(puzzle, "2026-01-01"), puzzle, puzzle.order).state;
    const text = buildShareText(st, "2026-01-01");
    expect(text).toContain("Tier List 2026-01-01");
    expect(text).toContain("1/4");
    expect(isSpoilerSafe(text, puzzle)).toBe(true);
  });

  it("flags a leak", () => {
    expect(isSpoilerSafe("Tier List x meerkats", puzzle)).toBe(false);
  });

  it("marks a loss with X", () => {
    let st = initAttempt(puzzle, "2026-01-01");
    const wrong = ["meerkats", "huckster", "premised", "absent", "fact"];
    for (let i = 0; i < 4; i++) st = submit(st, puzzle, wrong).state;
    expect(buildShareText(st, "2026-01-01")).toContain("X/4");
  });
});
