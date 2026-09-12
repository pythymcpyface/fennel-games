import { describe, it, expect } from "vitest";
import {
  normalizeSubmission,
  hammingDistance,
  validateMove,
  buildAdjacency,
  computeComponents,
  shortestPath,
  loadDataset,
  selectDailyPair,
  createInitialState,
  currentWord,
  moveCount,
  submit,
  undo,
  reset,
  SEED_VERSION,
} from "../src/games/word-morph/engine.ts";
import { computeHintNextWord } from "../src/games/word-morph/hint.ts";
import { buildShareText } from "../src/games/word-morph/share.ts";
import type { LengthDataset } from "../src/games/word-morph/types.ts";

const words = ["cold", "cord", "card", "ward", "warm", "cot"];
const dictionary = new Set(words);

describe("validation", () => {
  it("normalizeSubmission enforces length and charset", () => {
    expect(normalizeSubmission(" Cold ", 4)).toEqual({ ok: true, word: "cold" });
    expect(normalizeSubmission("col", 4)).toEqual({ ok: false, result: "INVALID_LENGTH" });
    expect(normalizeSubmission("co1d", 4)).toEqual({ ok: false, result: "INVALID_CHARS" });
  });
  it("hammingDistance counts mismatches, throws on length mismatch", () => {
    expect(hammingDistance("cold", "cord")).toBe(1);
    expect(hammingDistance("cold", "warm")).toBe(4);
    expect(() => hammingDistance("cold", "col")).toThrow();
  });
  it("validateMove enforces dictionary + one-letter change", () => {
    expect(validateMove("cord", "cold", dictionary)).toBe("VALID");
    expect(validateMove("cold", "cold", dictionary)).toBe("SAME_AS_CURRENT");
    expect(validateMove("cxrd", "cold", dictionary)).toBe("NOT_IN_DICTIONARY");
    expect(validateMove("warm", "cold", dictionary)).toBe("NOT_ONE_LETTER");
  });
});

describe("graph", () => {
  const adjacency = buildAdjacency(words);
  it("connects one-letter neighbours", () => {
    const cold = words.indexOf("cold");
    const cord = words.indexOf("cord");
    expect(adjacency[cold]).toContain(cord);
  });
  it("computes components", () => {
    const { componentCount, componentIdByWordIndex } = computeComponents(adjacency);
    expect(componentCount).toBeGreaterThanOrEqual(1);
    // cold and warm share a component (cold-cord-card-ward-warm)
    expect(componentIdByWordIndex[words.indexOf("cold")]).toBe(componentIdByWordIndex[words.indexOf("warm")]);
  });
  it("finds the shortest path cold -> warm (par 4)", () => {
    const path = shortestPath(adjacency, words.indexOf("cold"), words.indexOf("warm"));
    expect(path).not.toBeNull();
    expect((path as number[]).length - 1).toBe(4);
  });
});

function makeDataset(): LengthDataset {
  const adjacency = buildAdjacency(words);
  const { componentIdByWordIndex, componentCount } = computeComponents(adjacency);
  return {
    wordLength: 4,
    dictionaryId: "words-4-v1",
    dictionaryWords: words,
    adjacency: [],
    componentIdByWordIndex,
    componentCount,
    candidatePairs: [
      { startWordIndex: words.indexOf("cold"), targetWordIndex: words.indexOf("warm"), par: 4, componentId: componentIdByWordIndex[0] },
    ],
  };
}

describe("dataset load", () => {
  it("rebuilds adjacency when shipped empty", () => {
    const ds = loadDataset(makeDataset());
    expect(ds.adjacency.length).toBe(words.length);
  });
  it("throws on a malformed dataset", () => {
    expect(() => loadDataset({})).toThrow();
  });
});

describe("daily selection", () => {
  it("is deterministic for a given day", () => {
    const ds = loadDataset(makeDataset());
    const a = selectDailyPair(ds, "2026-01-01");
    const b = selectDailyPair(ds, "2026-01-01");
    expect(a).toEqual(b);
    expect(a.startWordText).toBe("cold");
    expect(a.targetWordText).toBe("warm");
    expect(SEED_VERSION).toBe("seed-v1");
  });
});

describe("puzzle state", () => {
  it("plays a full winning ladder", () => {
    let s = createInitialState("cold", "warm", 4);
    expect(moveCount(s)).toBe(0);
    for (const w of ["cord", "card", "ward", "warm"]) {
      s = submit(s, w, dictionary, 4).state;
    }
    expect(s.gameStatus).toBe("WON");
    expect(currentWord(s)).toBe("warm");
    expect(moveCount(s)).toBe(4);
  });
  it("rejects an invalid move without mutating state", () => {
    const s = createInitialState("cold", "warm", 4);
    const out = submit(s, "warm", dictionary, 4);
    expect(out.result).toBe("NOT_ONE_LETTER");
    expect(out.state).toBe(s);
  });
  it("undo and reset", () => {
    let s = createInitialState("cold", "warm", 4);
    s = submit(s, "cord", dictionary, 4).state;
    expect(moveCount(s)).toBe(1);
    s = undo(s);
    expect(moveCount(s)).toBe(0);
    s = submit(s, "cord", dictionary, 4).state;
    s = reset(s);
    expect(moveCount(s)).toBe(0);
    expect(currentWord(s)).toBe("cold");
  });
});

describe("hint", () => {
  it("suggests the lexicographically smallest next word on a shortest path", () => {
    const ds = loadDataset(makeDataset());
    const s = createInitialState("cold", "warm", 4);
    const h = computeHintNextWord(ds, s);
    expect(h.hintStatus).toBe("OK");
    expect(h.hintNextWordText).toBe("cord");
  });
  it("reports ALREADY_SOLVED at the target", () => {
    const ds = loadDataset(makeDataset());
    const s = createInitialState("warm", "warm", 0);
    expect(computeHintNextWord(ds, s).hintStatus).toBe("ALREADY_SOLVED");
  });
});

describe("share", () => {
  it("is spoiler-free and marks beating par", () => {
    const text = buildShareText("2026-01-01", 4, 4);
    expect(text).toContain("Word Morph 2026-01-01");
    expect(text).toContain("4/4");
    expect(text).toContain("✨");
    expect(text).not.toContain("cold");
    expect(text).not.toContain("warm");
  });
});
