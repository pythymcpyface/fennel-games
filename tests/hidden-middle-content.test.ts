import { describe, it, expect } from "vitest";
import { dictionarySubstrings, isFair, buildPuzzles, assertPuzzlesValid, type CandidatePuzzle } from "../src/games/hidden-middle/content-build.ts";

const dict = new Set(["SCAN", "SCANDAL", "CAN", "LOUS", "STAR", "START", "TART", "ART", "CAT", "CATS"]);

describe("dictionarySubstrings", () => {
  it("finds all dictionary substrings length>=2", () => {
    const subs = dictionarySubstrings("SCANDALOUS", dict);
    expect(subs).toContain("SCAN");
    expect(subs).toContain("SCANDAL");
    expect(subs).toContain("CAN");
    expect(subs).toContain("LOUS");
  });
});

describe("isFair (uniqueness gate)", () => {
  it("accepts a carrier where the clue maps to exactly one dictionary substring", () => {
    const clueIndex = { "a quick look": ["SCAN"] };
    expect(isFair({ carrierWord: "SCANDALOUS", clue: "a quick look", answerWord: "SCAN" }, dict, clueIndex)).toBe(true);
  });

  it("rejects when the clue maps to >1 dictionary substring of the carrier", () => {
    // START contains START, TART, ART, STAR — if clue lists two that are both substrings, reject
    const clueIndex = { "ambiguous": ["TART", "ART"] };
    expect(isFair({ carrierWord: "START", clue: "ambiguous", answerWord: "TART" }, dict, clueIndex)).toBe(false);
  });

  it("rejects when answer is not a substring of the carrier", () => {
    const clueIndex = { "x": ["STAR"] };
    expect(isFair({ carrierWord: "SCANDALOUS", clue: "x", answerWord: "STAR" }, dict, clueIndex)).toBe(false);
  });

  it("rejects when answer is not a dictionary word", () => {
    const clueIndex = { "x": ["SCANDXX"] };
    expect(isFair({ carrierWord: "SCANDXXER", clue: "x", answerWord: "SCANDXX" }, dict, clueIndex)).toBe(false);
  });
});

describe("buildPuzzles + gate", () => {
  it("emits only fair puzzles with sequential ids", () => {
    const clueIndex = { "a quick look": ["SCAN"], "ambiguous": ["TART", "ART"] };
    const cands: CandidatePuzzle[] = [
      { carrierWord: "SCANDALOUS", clue: "a quick look", answerWord: "SCAN" },
      { carrierWord: "START", clue: "ambiguous", answerWord: "TART" },
    ];
    const puzzles = buildPuzzles(cands, dict, clueIndex);
    expect(puzzles).toHaveLength(1);
    expect(puzzles[0].answerWord).toBe("SCAN");
    expect(() => assertPuzzlesValid(puzzles, dict, clueIndex)).not.toThrow();
  });

  it("is deterministic", () => {
    const clueIndex = { "a quick look": ["SCAN"] };
    const c: CandidatePuzzle[] = [{ carrierWord: "SCANDALOUS", clue: "a quick look", answerWord: "SCAN" }];
    expect(buildPuzzles(c, dict, clueIndex)).toEqual(buildPuzzles(c, dict, clueIndex));
  });
});
