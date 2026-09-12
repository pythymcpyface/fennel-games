import { describe, it, expect } from "vitest";
import { assignBands, toPuzzle, validatePuzzle, type CandidatePuzzle, type ThemePick } from "../src/games/semantic-gradient/content-build.ts";

describe("assignBands", () => {
  it("assigns four distinct bands hot->cold by ascending rank when decisive", () => {
    const picks: ThemePick[] = [
      { word: "aaaaa", rank: 3 }, { word: "bbbbb", rank: 14 }, { word: "ccccc", rank: 40 }, { word: "ddddd", rank: 90 },
    ];
    const bands = assignBands(picks)!;
    expect(bands["aaaaa"]).toBe("hot");
    expect(bands["ddddd"]).toBe("cold");
    expect(new Set(Object.values(bands)).size).toBe(4);
  });
  it("rejects non-decisive (too-close) ranks", () => {
    const picks: ThemePick[] = [
      { word: "a", rank: 3 }, { word: "b", rank: 5 }, { word: "c", rank: 40 }, { word: "d", rank: 90 },
    ];
    expect(assignBands(picks)).toBeNull();
  });
  it("requires exactly four picks", () => {
    expect(assignBands([{ word: "a", rank: 1 }])).toBeNull();
  });
});

// A hand-built placement set covering a 6x6 (straight rows) to exercise the gate.
function candidate(): CandidatePuzzle {
  const placements = [
    { word: "musician", type: "spangram" as const, path: [0, 6, 12, 18, 24, 30, 31, 32] },
    { word: "music", type: "theme" as const, path: [1, 2, 3, 4, 5] },
    { word: "bands", type: "theme" as const, path: [7, 8, 9, 10, 11] },
    { word: "flute", type: "theme" as const, path: [13, 14, 15, 16, 17] },
    { word: "magic", type: "theme" as const, path: [19, 20, 21, 22, 23] },
    { word: "oxen", type: "filler" as const, path: [25, 26, 27, 28] },
    { word: "jazz", type: "filler" as const, path: [33, 34, 35, 29] },
  ];
  const letters = new Array(36).fill("");
  for (const p of placements) p.path.forEach((c, i) => { letters[c] = p.word[i].toUpperCase(); });
  return {
    anchor: "song",
    spangram: "musician",
    themes: [{ word: "music", rank: 3 }, { word: "bands", rank: 14 }, { word: "flute", rank: 40 }, { word: "magic", rank: 90 }],
    fillers: ["oxen", "jazz"],
    placements,
    letters,
  };
}

describe("toPuzzle + validatePuzzle", () => {
  it("shapes a fair puzzle that passes the gate", () => {
    const p = toPuzzle(candidate(), "puz-0000")!;
    expect(p).not.toBeNull();
    expect(p.answers.filter((a) => a.type === "theme").every((a) => a.band)).toBe(true);
    expect(validatePuzzle(p)).toBeNull();
  });
  it("rejects when theme bands are not distinct (via non-decisive ranks)", () => {
    const c = candidate();
    c.themes = [{ word: "music", rank: 3 }, { word: "bands", rank: 4 }, { word: "flute", rank: 40 }, { word: "magic", rank: 90 }];
    expect(toPuzzle(c, "puz-0000")).toBeNull();
  });
  it("rejects a puzzle whose spangram misses the bottom row", () => {
    const p = toPuzzle(candidate(), "puz-0000")!;
    const span = p.answers.find((a) => a.type === "spangram")!;
    span.path = [0, 1, 2, 3, 4, 5, 6, 7]; // all rows 0..1 (breaks cover + spanning)
    expect(validatePuzzle(p)).not.toBeNull();
  });
});
