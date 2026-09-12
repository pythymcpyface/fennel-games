import { describe, it, expect } from "vitest";
import { buildShareText, isSpoilerSafe, SHARE_ENCODING_VERSION } from "../src/games/edit-ladder-trails/share.ts";
import type { AttemptState, Puzzle } from "../src/games/edit-ladder-trails/types.ts";

const puzzle: Puzzle = {
  puzzleId: "puz-0000",
  letters: Array.from({ length: 36 }, () => "A"),
  answers: [
    { id: "spangram", type: "spangram", word: "daughter", path: [0, 6, 12, 18, 24, 30, 31, 32] },
    { id: "rung-0", type: "rung", word: "repel", path: [1, 2, 3, 4, 5] },
    { id: "rung-1", type: "rung", word: "rebel", path: [7, 8, 9, 10, 11] },
    { id: "rung-2", type: "rung", word: "revel", path: [13, 14, 15, 16, 17] },
    { id: "rung-3", type: "rung", word: "level", path: [19, 20, 21, 22, 23] },
    { id: "filler-0", type: "filler", word: "oxen", path: [25, 26, 27, 28] },
    { id: "filler-1", type: "filler", word: "jazz", path: [29, 35, 34, 33] },
  ],
  ladder: ["repel", "rebel", "revel", "level"],
  spangram: "daughter",
};

function wonState(): AttemptState {
  return {
    puzzleId: "puz-0000", dayId: "2026-07-25",
    foundIds: ["rung-0", "filler-0", "rung-1", "spangram", "rung-2", "rung-3"],
    hintBalance: 0, hintsSpent: 1,
    revealedIds: ["spangram"],
    log: [
      { type: "found_rung", order: 1 }, { type: "found_filler", order: 2 },
      { type: "found_rung", order: 3 }, { type: "spend_hint", order: 4 },
      { type: "found_spangram", order: 5 }, { type: "found_rung", order: 6 },
      { type: "found_rung", order: 7 },
    ],
    status: "won",
  };
}

describe("buildShareText (REQ-017, NFR-007)", () => {
  it("includes the semver encoding version and a spoiler-free ribbon", () => {
    const text = buildShareText(wonState(), "2026-07-25");
    expect(text).toContain(`v${SHARE_ENCODING_VERSION}`);
    expect(/\d+\.\d+\.\d+/.test(text)).toBe(true);
    expect(text).toContain("2026-07-25");
    expect(text).toContain("💡"); // hint spend encoded
  });
});

describe("isSpoilerSafe (REQ-018, RISK-003)", () => {
  it("passes a normal share (no letters in the ribbon body)", () => {
    expect(isSpoilerSafe(buildShareText(wonState(), "2026-07-25"), puzzle)).toBe(true);
  });
  it("flags any A-Z leaking into the ribbon body", () => {
    const leaked = "Edit-Ladder Trails 2026-07-25 v1.0.0 solved\nREPEL🔵🔵";
    expect(isSpoilerSafe(leaked, puzzle)).toBe(false);
  });
  it("flags an answer word appearing anywhere", () => {
    expect(isSpoilerSafe("Edit-Ladder Trails daughter\n🔵", puzzle)).toBe(false);
  });
});
