import { describe, it, expect } from "vitest";
import { validateGuess } from "../src/games/ladderless/validate.ts";
import { selectHint } from "../src/games/ladderless/hint.ts";
import { buildShareText, isSpoilerSafe } from "../src/games/ladderless/share.ts";
import { initGameState, evaluateGuess, reduceGameState } from "../src/games/ladderless/engine.ts";
import type { RankTable, GameState } from "../src/games/ladderless/types.ts";

const table: RankTable = {
  targetWord: "ocean",
  vocabSize: 6,
  ranks: { ocean: 1, sea: 2, wave: 3, river: 4, cloud: 5, rock: 6 },
  tierCutoffs: [2, 4],
};
const dictionary = new Set(Object.keys(table.ranks));

describe("validateGuess (REQ-006/007)", () => {
  const state = initGameState("puz-0001", "2024-04-01", table.vocabSize);

  it("AC-TEST-011: rejects a non-dictionary word", () => {
    const r = validateGuess("banana", dictionary, state.guessHistory);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("not_in_dictionary");
  });

  it("AC-TEST-012: accepts a dictionary word", () => {
    expect(validateGuess("wave", dictionary, state.guessHistory).ok).toBe(true);
  });

  it("AC-TEST-013: rejects a duplicate guess", () => {
    const ev = evaluateGuess("wave", table, state.bestRank);
    const s1 = reduceGameState(state, ev, "wave", 1000);
    const r = validateGuess("wave", dictionary, s1.guessHistory);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("duplicate");
  });
});

describe("selectHint (REQ-013/014)", () => {
  it("AC-TEST-023: returns an unguessed word strictly better than bestRank", () => {
    const state: GameState = { ...initGameState("p", "d", 6), bestRank: 4 };
    const hint = selectHint(state, table);
    expect(hint).not.toBeNull();
    expect(table.ranks[hint!]).toBeLessThan(4);
  });

  it("AC-TEST-025: excludes already-guessed words, picks best remaining by rank", () => {
    // best=4, "sea"(2) already guessed => next best improving is "wave"(3)
    const ev = evaluateGuess("sea", table, 6);
    let state = reduceGameState(initGameState("p", "d", 6), ev, "sea", 1);
    state = { ...state, bestRank: 4 }; // pretend best is 4 (river) but sea guessed
    const hint = selectHint(state, table);
    expect(hint).toBe("wave");
  });

  it("AC-TEST-024: returns null when bestRank is already 1", () => {
    const state: GameState = { ...initGameState("p", "d", 6), bestRank: 1 };
    expect(selectHint(state, table)).toBeNull();
  });

  it("is deterministic (lexicographic tie-break at equal rank not needed here, but stable)", () => {
    const state: GameState = { ...initGameState("p", "d", 6), bestRank: 5 };
    expect(selectHint(state, table)).toBe(selectHint(state, table));
  });

  it("excludes previously-suggested words so repeats yield a distinct, warmer hint", () => {
    const state: GameState = { ...initGameState("p", "d", 6), bestRank: 5 };
    const first = selectHint(state, table);
    expect(first).not.toBeNull();
    const next = selectHint({ ...state, suggestedHints: [first!] }, table);
    expect(next).not.toBe(first);
    expect(table.ranks[next!]).toBeLessThan(table.ranks[first!]);
  });
});

describe("share (REQ-015/016)", () => {
  function wonState(): GameState {
    let s = initGameState("puz-0001", "2024-04-01", table.vocabSize);
    for (const [w, ts] of [["rock", 1], ["sea", 2], ["ocean", 3]] as const) {
      s = reduceGameState(s, evaluateGuess(w, table, s.bestRank), w, ts);
    }
    return s;
  }

  it("AC-TEST-026: won share ends with a star marker and includes the day + score", () => {
    const text = buildShareText(wonState(), 3, "2024-04-01");
    expect(text).toContain("Ladderless");
    expect(text).toContain("2024-04-01");
    expect(text.trimEnd().endsWith("⭐")).toBe(true);
  });

  it("AC-TEST-028 / RISK-009: share text never contains target or start word", () => {
    const text = buildShareText(wonState(), 3, "2024-04-01");
    expect(isSpoilerSafe(text, "ocean", "rock")).toBe(true);
    expect(text.toLowerCase()).not.toContain("ocean");
  });

  it("isSpoilerSafe flags leakage of target or start", () => {
    expect(isSpoilerSafe("today the answer was ocean", "ocean", "rock")).toBe(false);
    expect(isSpoilerSafe("start was rock", "ocean", "rock")).toBe(false);
    expect(isSpoilerSafe("🟦🟥⭐", "ocean", "rock")).toBe(true);
  });
});
