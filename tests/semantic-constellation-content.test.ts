import { describe, it, expect } from "vitest";
import { assignClusters, toPuzzle, validatePuzzle, type CandidatePuzzle, type ThemePick } from "../src/games/semantic-constellation/content-build.ts";

describe("assignClusters", () => {
  it("splits decisively 2 A / 2 B by signed margin", () => {
    const picks: ThemePick[] = [
      { word: "aa", margin: 40 }, { word: "bb", margin: 60 }, { word: "cc", margin: -40 }, { word: "dd", margin: -55 },
    ];
    const cl = assignClusters(picks)!;
    expect(cl["aa"]).toBe("A"); expect(cl["cc"]).toBe("B");
  });
  it("rejects a coin-flip (small margin) word", () => {
    expect(assignClusters([{ word: "a", margin: 40 }, { word: "b", margin: 5 }, { word: "c", margin: -40 }, { word: "d", margin: -55 }])).toBeNull();
  });
  it("rejects an unbalanced split (3 A / 1 B)", () => {
    expect(assignClusters([{ word: "a", margin: 40 }, { word: "b", margin: 60 }, { word: "c", margin: 30 }, { word: "d", margin: -55 }])).toBeNull();
  });
});

function candidate(): CandidatePuzzle {
  const placements = [
    { word: "showcase", type: "spangram" as const, path: [0, 6, 12, 18, 24, 30, 31, 32] },
    { word: "duets", type: "theme" as const, path: [1, 2, 3, 4, 5] },
    { word: "poets", type: "theme" as const, path: [7, 8, 9, 10, 11] },
    { word: "bikes", type: "theme" as const, path: [13, 14, 15, 16, 17] },
    { word: "macho", type: "theme" as const, path: [19, 20, 21, 22, 23] },
    { word: "oxen", type: "filler" as const, path: [25, 26, 27, 28] },
    { word: "reds", type: "filler" as const, path: [33, 34, 35, 29] },
  ];
  const letters = new Array(36).fill("");
  for (const p of placements) p.path.forEach((c, i) => { letters[c] = p.word[i].toUpperCase(); });
  return {
    anchorA: "music", anchorB: "sport", spangram: "showcase",
    themes: [{ word: "duets", margin: 50 }, { word: "poets", margin: 40 }, { word: "bikes", margin: -45 }, { word: "macho", margin: -60 }],
    fillers: ["oxen", "reds"], placements, letters,
  };
}

describe("toPuzzle + validatePuzzle", () => {
  it("shapes a fair puzzle that passes the gate", () => {
    const p = toPuzzle(candidate(), "puz-0000")!;
    expect(p.answers.filter((a) => a.type === "theme").every((a) => a.cluster)).toBe(true);
    expect(validatePuzzle(p)).toBeNull();
  });
  it("rejects non-decisive theme margins", () => {
    const c = candidate();
    c.themes = [{ word: "duets", margin: 50 }, { word: "poets", margin: 3 }, { word: "bikes", margin: -45 }, { word: "macho", margin: -60 }];
    expect(toPuzzle(c, "puz-0000")).toBeNull();
  });
  it("rejects a spangram missing the bottom row", () => {
    const p = toPuzzle(candidate(), "puz-0000")!;
    p.answers.find((a) => a.type === "spangram")!.path = [0, 1, 2, 3, 4, 5, 6, 7];
    expect(validatePuzzle(p)).not.toBeNull();
  });
});
