// Tests for multiplayer share text — REQ-032
// Share text must contain rank + total but no answer words.

import { describe, it, expect } from "vitest";
import { buildMpShareText, isMpShareSpoilerSafe } from "../src/games/lowball/share.ts";
import type { MpLeaderboardEntry } from "../src/games/lowball/multiplayer-client.ts";
import type { Puzzle } from "../src/games/lowball/types.ts";

const puzzle: Puzzle = {
  puzzleId: "puz-0000",
  affixType: "suffix",
  affixValue: "ugh",
  categoryLabel: 'Words ending in "ugh"',
  parValue: 21,
  categoryDomain: "words",
  answers: [
    { word: "though", panelScore: 100, isFindable: true },
    { word: "tough", panelScore: 81, isFindable: true },
    { word: "rough", panelScore: 43, isFindable: true },
    { word: "bough", panelScore: 1, isFindable: true },
    { word: "hiccough", panelScore: 0, isFindable: true },
  ],
};

const board: MpLeaderboardEntry[] = [
  { slotIndex: 0, displayName: "Alice", roundTotal: 15, rank: 1, isJointWinner: false },
  { slotIndex: 1, displayName: "Bob", roundTotal: 45, rank: 2, isJointWinner: false },
];

describe("buildMpShareText — REQ-032", () => {
  it("TEST-044: share text contains the player's rank and round total", () => {
    const text = buildMpShareText(board, 0, "2026-09-11");
    expect(text).toContain("1");
    expect(text).toContain("15");
  });

  it("share text includes the day ID", () => {
    const text = buildMpShareText(board, 0, "2026-09-11");
    expect(text).toContain("2026-09-11");
  });

  it("share text contains 'Lowball'", () => {
    const text = buildMpShareText(board, 0, "2026-09-11");
    expect(text.toLowerCase()).toContain("lowball");
  });

  it("uses the supplied game title instead of the 'Lowball' default", () => {
    const text = buildMpShareText(board, 0, "2026-09-11", "Lowball: Countries");
    expect(text).toContain("Lowball: Countries");
  });
});

describe("isMpShareSpoilerSafe — REQ-032", () => {
  it("TEST-044: share text with no answer words is spoiler-safe", () => {
    const text = buildMpShareText(board, 0, "2026-09-11");
    expect(isMpShareSpoilerSafe(text, puzzle)).toBe(true);
  });

  it("share text containing an answer word is not safe", () => {
    const unsafe = "Lowball 2026-09-11 — I played 'rough' and scored 43!";
    expect(isMpShareSpoilerSafe(unsafe, puzzle)).toBe(false);
  });
});
