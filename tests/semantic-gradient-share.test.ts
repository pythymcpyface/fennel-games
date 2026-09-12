import { describe, it, expect } from "vitest";
import { buildShareText, isSpoilerSafe, SHARE_ENCODING_VERSION } from "../src/games/semantic-gradient/share.ts";
import type { AttemptState, Puzzle } from "../src/games/semantic-gradient/types.ts";

const puzzle: Puzzle = {
  puzzleId: "puz-0000",
  letters: Array.from({ length: 36 }, () => "A"),
  anchor: "jazz",
  answers: [
    { id: "spangram", type: "spangram", word: "musician", path: [0, 6, 12, 18, 24, 30, 31, 32] },
    { id: "theme-0", type: "theme", word: "music", path: [1, 2, 3, 4, 5], band: "hot" },
    { id: "theme-1", type: "theme", word: "bands", path: [7, 8, 9, 10, 11], band: "warm" },
    { id: "theme-2", type: "theme", word: "flute", path: [13, 14, 15, 16, 17], band: "cool" },
    { id: "theme-3", type: "theme", word: "magic", path: [19, 20, 21, 22, 23], band: "cold" },
    { id: "filler-0", type: "filler", word: "oxen", path: [25, 26, 27, 28] },
    { id: "filler-1", type: "filler", word: "reds", path: [33, 34, 35, 29] },
  ],
};

function wonState(): AttemptState {
  return {
    puzzleId: "puz-0000", dayId: "2026-07-25",
    foundIds: ["theme-0", "filler-0", "spangram", "theme-1", "theme-2", "theme-3"],
    hintBalance: 0, hintsSpent: 1, revealedIds: ["spangram"],
    log: [
      { type: "found_theme", order: 1, band: "hot" }, { type: "found_filler", order: 2 },
      { type: "spend_hint", order: 3 }, { type: "found_spangram", order: 4 },
      { type: "found_theme", order: 5, band: "warm" }, { type: "found_theme", order: 6, band: "cool" },
      { type: "found_theme", order: 7, band: "cold" },
    ],
    status: "won",
  };
}

describe("buildShareText", () => {
  it("carries the version and a spoiler-free band ribbon", () => {
    const text = buildShareText(wonState(), "2026-07-25");
    expect(text).toContain(`v${SHARE_ENCODING_VERSION}`);
    expect(text).toContain("2026-07-25");
    expect(text).toContain("🔴"); // hot band square
    expect(text).toContain("💡"); // hint spend
  });
});

describe("isSpoilerSafe", () => {
  it("passes a normal share (no A-Z in ribbon body)", () => {
    expect(isSpoilerSafe(buildShareText(wonState(), "2026-07-25"), puzzle)).toBe(true);
  });
  it("flags A-Z leaking into the ribbon", () => {
    expect(isSpoilerSafe("Semantic Gradient x\nMUSIC🔴", puzzle)).toBe(false);
  });
  it("flags the anchor appearing anywhere", () => {
    expect(isSpoilerSafe("Semantic Gradient jazz\n🔴", puzzle)).toBe(false);
  });
});
