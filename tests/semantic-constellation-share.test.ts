import { describe, it, expect } from "vitest";
import { buildShareText, isSpoilerSafe, SHARE_ENCODING_VERSION } from "../src/games/semantic-constellation/share.ts";
import type { AttemptState, Puzzle } from "../src/games/semantic-constellation/types.ts";

const puzzle: Puzzle = {
  puzzleId: "puz-0000",
  letters: Array.from({ length: 36 }, () => "A"),
  anchorA: "music", anchorB: "sport",
  answers: [
    { id: "spangram", type: "spangram", word: "showcase", path: [0, 6, 12, 18, 24, 30, 31, 32] },
    { id: "theme-0", type: "theme", word: "duets", path: [1, 2, 3, 4, 5], cluster: "A" },
    { id: "theme-1", type: "theme", word: "poets", path: [7, 8, 9, 10, 11], cluster: "A" },
    { id: "theme-2", type: "theme", word: "bikes", path: [13, 14, 15, 16, 17], cluster: "B" },
    { id: "theme-3", type: "theme", word: "macho", path: [19, 20, 21, 22, 23], cluster: "B" },
    { id: "filler-0", type: "filler", word: "oxen", path: [25, 26, 27, 28] },
    { id: "filler-1", type: "filler", word: "reds", path: [33, 34, 35, 29] },
  ],
};

function wonState(): AttemptState {
  return {
    puzzleId: "puz-0000", dayId: "2026-07-25",
    foundIds: ["theme-0", "filler-0", "spangram", "theme-2", "theme-1", "theme-3"],
    hintBalance: 0, hintsSpent: 1, revealedIds: ["spangram"],
    log: [
      { type: "found_theme", order: 1, cluster: "A" }, { type: "found_filler", order: 2 },
      { type: "spend_hint", order: 3 }, { type: "found_spangram", order: 4 },
      { type: "found_theme", order: 5, cluster: "B" }, { type: "found_theme", order: 6, cluster: "A" },
      { type: "found_theme", order: 7, cluster: "B" },
    ],
    status: "won",
  };
}

describe("buildShareText", () => {
  it("carries the version and a spoiler-free cluster ribbon", () => {
    const text = buildShareText(wonState(), "2026-07-25");
    expect(text).toContain(`v${SHARE_ENCODING_VERSION}`);
    expect(text).toContain("🔵"); // cluster A
    expect(text).toContain("🟣"); // cluster B
    expect(text).toContain("💡");
  });
});

describe("isSpoilerSafe", () => {
  it("passes a normal share", () => expect(isSpoilerSafe(buildShareText(wonState(), "2026-07-25"), puzzle)).toBe(true));
  it("flags A-Z in the ribbon", () => expect(isSpoilerSafe("Semantic Constellation x\nDUETS🔵", puzzle)).toBe(false));
  it("flags an anchor appearing anywhere", () => expect(isSpoilerSafe("Semantic Constellation music\n🔵", puzzle)).toBe(false));
});
