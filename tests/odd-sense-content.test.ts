import { describe, it, expect } from "vitest";
import { isFairSet, hintIndexFor, buildPuzzle, buildPuzzles, assertPuzzlesValid, type Lexicon } from "../src/games/odd-sense/content-build.ts";

const lexicon: Lexicon = {
  BAT: ["baseball", "animal"],
  GLOVE: ["baseball", "clothing"],
  PITCH: ["baseball", "music", "sports-field"],
  DIAMOND: ["baseball", "gem", "shape"],
  MOLE: ["animal", "spy", "skin"],
  CAT: ["animal"],
  DOG: ["animal"],
  FOX: ["animal"],
  OWL: ["animal"],
  DESK: ["furniture"],
};

describe("isFairSet (REQ-023/024)", () => {
  it("accepts a clean set: 4 baseball + 1 odd", () => {
    expect(isFairSet({ words: ["BAT", "GLOVE", "PITCH", "DIAMOND", "MOLE"], themeCategory: "baseball", oddWord: "MOLE" }, lexicon)).toBe(true);
  });

  it("rejects when the odd word also has the theme category", () => {
    expect(isFairSet({ words: ["BAT", "GLOVE", "PITCH", "DIAMOND", "CAT"], themeCategory: "baseball", oddWord: "BAT" }, lexicon)).toBe(false);
  });

  it("rejects an ambiguous set where another category covers 4+ words", () => {
    // BAT+MOLE+CAT+DOG+FOX: theme could be 'animal' for many => ambiguous odd
    expect(isFairSet({ words: ["CAT", "DOG", "FOX", "OWL", "BAT"], themeCategory: "animal", oddWord: "BAT" }, lexicon)).toBe(false);
  });

  it("rejects duplicates or wrong length", () => {
    expect(isFairSet({ words: ["BAT", "BAT", "PITCH", "DIAMOND", "MOLE"], themeCategory: "baseball", oddWord: "MOLE" }, lexicon)).toBe(false);
    expect(isFairSet({ words: ["BAT", "GLOVE", "PITCH"], themeCategory: "baseball", oddWord: "BAT" }, lexicon)).toBe(false);
  });
});

describe("hintIndexFor + buildPuzzle", () => {
  it("hint is the lowest non-odd index", () => {
    expect(hintIndexFor(["BAT", "GLOVE", "PITCH", "DIAMOND", "MOLE"], 4)).toBe(0);
    expect(hintIndexFor(["MOLE", "BAT", "GLOVE", "PITCH", "DIAMOND"], 0)).toBe(1);
  });

  it("buildPuzzle sets odd index + hint + uppercases", () => {
    const p = buildPuzzle("puz-0000", { words: ["bat", "glove", "pitch", "diamond", "mole"], themeCategory: "baseball", oddWord: "mole" }, "Baseball", "Animal");
    expect(p.words).toEqual(["BAT", "GLOVE", "PITCH", "DIAMOND", "MOLE"]);
    expect(p.oddWordIndex).toBe(4);
    expect(p.hintEliminationIndex).toBe(0);
  });
});

describe("buildPuzzles + gate", () => {
  it("emits only fair sets with sequential ids", () => {
    const puzzles = buildPuzzles(
      [
        { cand: { words: ["BAT", "GLOVE", "PITCH", "DIAMOND", "MOLE"], themeCategory: "baseball", oddWord: "MOLE" }, themeLabel: "Baseball", oddCategoryLabel: "Animal" },
        { cand: { words: ["CAT", "DOG", "FOX", "OWL", "BAT"], themeCategory: "animal", oddWord: "BAT" }, themeLabel: "Animal", oddCategoryLabel: "x" },
      ],
      lexicon,
    );
    expect(puzzles).toHaveLength(1); // second is ambiguous, rejected
    expect(puzzles[0].puzzleId).toBe("puz-0000");
    expect(() => assertPuzzlesValid(puzzles)).not.toThrow();
  });

  it("is deterministic", () => {
    const c = [{ cand: { words: ["BAT", "GLOVE", "PITCH", "DIAMOND", "MOLE"], themeCategory: "baseball", oddWord: "MOLE" }, themeLabel: "Baseball", oddCategoryLabel: "Animal" }];
    expect(buildPuzzles(c, lexicon)).toEqual(buildPuzzles(c, lexicon));
  });
});
