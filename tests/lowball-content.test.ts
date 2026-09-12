import { describe, it, expect } from "vitest";
import {
  panelScore,
  isFindable,
  buildAnswers,
  computePar,
  gateFailureReason,
  buildPuzzles,
  assertPuzzlesValid,
  categoryLabel,
  matchesAffix,
  type Candidate,
  type ScoredWord,
} from "../src/games/lowball/content-build.ts";
import { FINDABLE_MAX_TIER } from "../src/games/lowball/types.ts";

// ---------------------------------------------------------------------------
// Helpers to build gate fixtures. A passing candidate must satisfy all six
// admission rules, so fixtures are built from a known-good base and mutated to
// violate exactly one rule at a time.
// ---------------------------------------------------------------------------

/** A word at a findable tier with an explicit GloVe rank. */
const w = (word: string, rank: number | null, tier: number): ScoredWord => ({ word, rank, tier });

/**
 * Base candidate: 12 answers, a trap at ~100, six findable answers, one findable
 * zero-scorer, and a graded ladder. Ranks are chosen to land on distinct scores.
 */
function baseCandidate(): Candidate {
  return {
    affixType: "suffix",
    affixValue: "ugh",
    words: [
      w("though", 100, 10), // ~100 trap
      w("enough", 200, 10),
      w("tough", 1500, 20),
      w("rough", 6000, 20),
      w("laugh", 12000, 20),
      w("cough", 30000, 35),
      w("trough", 60000, 40),
      w("plough", 90000, 40),
      w("bough", 150000, 50),
      w("hiccough", null, 50), // findable zero-scorer (out of GloVe vocab)
      w("clough", 250000, 70), // unfindable zero-scorer (specialist tier)
      w("usquebaugh", null, 70), // unfindable zero-scorer
    ],
  };
}

describe("panelScore — REQ-036, REQ-037, REQ-038, REQ-039, REQ-040", () => {
  it("REQ-036 / TEST-063: a very common word scores 100", () => {
    // rank 132 at tier 10 -> log10(132) ~ 2.12, below the 3.0 floor, clamps to 100
    expect(panelScore(132, 10)).toBe(100);
  });

  it("REQ-036 / TEST-064: a mid-frequency word scores on the ladder", () => {
    const score = panelScore(40445, 35);
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThan(20);
  });

  it("REQ-037 / TEST-065: an out-of-vocabulary answer scores exactly 0", () => {
    expect(panelScore(null, 20)).toBe(0);
  });

  it("REQ-038 / TEST-066: a specialist-tier answer scores exactly 0", () => {
    // real GloVe rank, but tier above the findable cutoff
    expect(panelScore(5000, 70)).toBe(0);
    expect(panelScore(5000, FINDABLE_MAX_TIER + 5)).toBe(0);
  });

  it("REQ-039 / TEST-067: rank 1 clamps to the 100 ceiling", () => {
    expect(panelScore(1, 10)).toBe(100);
  });

  it("REQ-039 / TEST-068: a tail-of-vocabulary rank stays at or above 0", () => {
    expect(panelScore(400000, 10)).toBeGreaterThanOrEqual(0);
  });

  it("REQ-040 / TEST-069: a non-finite formula input yields 0, never NaN", () => {
    expect(panelScore(0, 10)).toBe(0);
    expect(panelScore(-1, 10)).toBe(0);
    expect(panelScore(Number.NaN, 10)).toBe(0);
  });

  it("REQ-039: every score across the rank domain stays within 0..100", () => {
    for (const rank of [1, 10, 100, 1000, 10000, 100000, 399999]) {
      const s = panelScore(rank, 10);
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThanOrEqual(100);
      expect(Number.isInteger(s)).toBe(true);
    }
  });

  it("is monotonic: a rarer word never scores higher than a commoner one", () => {
    const ranks = [1, 50, 500, 5000, 50000, 200000];
    const scores = ranks.map((r) => panelScore(r, 10));
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i]).toBeLessThanOrEqual(scores[i - 1]);
    }
  });
});

describe("isFindable — TERM-010", () => {
  it("treats tiers at or below the cutoff as findable", () => {
    expect(isFindable(10)).toBe(true);
    expect(isFindable(FINDABLE_MAX_TIER)).toBe(true);
  });
  it("treats tiers above the cutoff as unfindable", () => {
    expect(isFindable(FINDABLE_MAX_TIER + 1)).toBe(false);
    expect(isFindable(70)).toBe(false);
  });
});

describe("matchesAffix / categoryLabel", () => {
  it("matches a suffix category", () => {
    expect(matchesAffix("though", "suffix", "ugh")).toBe(true);
    expect(matchesAffix("table", "suffix", "ugh")).toBe(false);
  });
  it("matches a prefix category", () => {
    expect(matchesAffix("prevent", "prefix", "pre")).toBe(true);
    expect(matchesAffix("postpone", "prefix", "pre")).toBe(false);
  });
  it("rejects a word equal to the affix itself", () => {
    expect(matchesAffix("ugh", "suffix", "ugh")).toBe(false);
    expect(matchesAffix("pre", "prefix", "pre")).toBe(false);
  });
  it("labels categories readably", () => {
    expect(categoryLabel("suffix", "ugh")).toBe('Words ending in "ugh"');
    expect(categoryLabel("prefix", "pre")).toBe('Words starting with "pre"');
  });
});

describe("buildAnswers", () => {
  it("scores and flags every word, sorted high score first", () => {
    const answers = buildAnswers(baseCandidate());
    expect(answers).toHaveLength(12);
    expect(answers[0].panelScore).toBeGreaterThanOrEqual(answers[1].panelScore);
    const hiccough = answers.find((a) => a.word === "hiccough");
    expect(hiccough).toBeDefined();
    expect(hiccough?.panelScore).toBe(0);
    expect(hiccough?.isFindable).toBe(true);
    const junk = answers.find((a) => a.word === "usquebaugh");
    expect(junk?.panelScore).toBe(0);
    expect(junk?.isFindable).toBe(false);
  });
});

describe("computePar — REQ-041", () => {
  it("TEST-070: par is the median of findable answer scores", () => {
    // findable scores 0, 2, 21, 41, 95 -> median 21
    const answers = [
      { word: "a", panelScore: 95, isFindable: true },
      { word: "b", panelScore: 41, isFindable: true },
      { word: "c", panelScore: 21, isFindable: true },
      { word: "d", panelScore: 2, isFindable: true },
      { word: "e", panelScore: 0, isFindable: true },
      { word: "f", panelScore: 0, isFindable: false }, // excluded from par
    ];
    expect(computePar(answers)).toBe(21);
  });

  it("ignores unfindable answers when computing the median", () => {
    const answers = [
      { word: "a", panelScore: 40, isFindable: true },
      { word: "b", panelScore: 20, isFindable: true },
      { word: "c", panelScore: 0, isFindable: true },
      { word: "x", panelScore: 0, isFindable: false },
      { word: "y", panelScore: 0, isFindable: false },
      { word: "z", panelScore: 0, isFindable: false },
    ];
    expect(computePar(answers)).toBe(20);
  });

  it("returns a non-negative integer", () => {
    const par = computePar(buildAnswers(baseCandidate()));
    expect(Number.isInteger(par)).toBe(true);
    expect(par).toBeGreaterThanOrEqual(0);
  });
});

describe("gateFailureReason — REQ-031..035, REQ-042", () => {
  it("admits a well-formed candidate", () => {
    expect(gateFailureReason(baseCandidate())).toBeNull();
  });

  it("REQ-031 / TEST-053: admits a candidate with exactly 10 answers", () => {
    const c = baseCandidate();
    c.words = c.words.slice(0, 10);
    expect(gateFailureReason(c)).toBeNull();
  });

  it("REQ-031: rejects fewer than 10 answers", () => {
    const c = baseCandidate();
    c.words = c.words.slice(0, 9);
    expect(gateFailureReason(c)).toBe("answer_count");
  });

  it("REQ-031 / TEST-054: rejects more than 36 answers", () => {
    const c = baseCandidate();
    for (let i = 0; i < 30; i++) c.words.push(w(`filler${i}ugh`, 5000 + i * 100, 20));
    expect(gateFailureReason(c)).toBe("answer_count");
  });

  it("REQ-032 / TEST-056: rejects a candidate with no high-scoring trap", () => {
    const c = baseCandidate();
    // drop everything scoring >= 45
    c.words = c.words.filter((x) => panelScore(x.rank, x.tier) < 45);
    while (c.words.length < 10) c.words.push(w(`pad${c.words.length}ugh`, 80000 + c.words.length * 500, 40));
    expect(gateFailureReason(c)).toBe("no_trap");
  });

  it("REQ-033 / TEST-058: rejects fewer than six findable answers", () => {
    const c = baseCandidate();
    // demote all but five findable words to specialist tiers
    let kept = 0;
    c.words = c.words.map((x) => (isFindable(x.tier) && kept++ >= 5 ? { ...x, tier: 70 } : x));
    expect(gateFailureReason(c)).toBe("findable_count");
  });

  it("REQ-034 / TEST-059: rejects when every zero-scorer is unfindable", () => {
    const c = baseCandidate();
    // Every findable word must score above 0. `bough` at rank 150000 already scores
    // 0, so both it and `hiccough` need real, mid-frequency ranks to isolate this rule.
    c.words = c.words.map((x) =>
      x.word === "hiccough" ? { ...x, rank: 8000 } : x.word === "bough" ? { ...x, rank: 20000 } : x,
    );
    expect(gateFailureReason(c)).toBe("no_findable_zero");
  });

  it("REQ-035: rejects a candidate with too few non-zero answers", () => {
    const c = baseCandidate();
    // Keep the trap and a findable zero, flatten everything between into 0 so the
    // ladder collapses to a cliff.
    c.words = c.words.map((x) =>
      ["tough", "rough", "laugh", "cough", "trough", "plough"].includes(x.word)
        ? { ...x, rank: null }
        : x,
    );
    expect(gateFailureReason(c)).toBe("no_ladder");
  });

  it("REQ-035: rejects a ladder with too few distinct non-zero scores", () => {
    const c = baseCandidate();
    // Six non-zero answers, but all sharing one rank -> one distinct value only.
    c.words = c.words.map((x) =>
      ["tough", "rough", "laugh", "cough", "trough", "plough"].includes(x.word)
        ? { ...x, rank: 6000 }
        : x,
    );
    expect(gateFailureReason(c)).toBe("no_ladder");
  });

  it("REQ-042 / TEST-071: rejects a candidate whose par is zero", () => {
    // Par is the median findable score, so a majority of findable answers must
    // score 0 while the ladder still holds 5+ non-zero answers across 4+ distinct
    // values. That needs more findable words than the base fixture carries.
    const c: Candidate = {
      affixType: "suffix",
      affixValue: "ugh",
      words: [
        w("though", 100, 10), // 100 trap
        w("enough", 900, 10),
        w("tough", 3000, 20),
        w("rough", 9000, 20),
        w("laugh", 25000, 35),
        // eight findable zero-scorers drag the median to 0
        w("zeroaugh", null, 20),
        w("zerobugh", null, 20),
        w("zerocugh", null, 20),
        w("zerodugh", null, 20),
        w("zeroeugh", null, 20),
        w("zerofugh", null, 20),
        w("zerogugh", null, 20),
        w("zerohugh", null, 20),
      ],
    };
    expect(gateFailureReason(c)).toBe("par_zero");
  });
});

describe("buildPuzzles + assertPuzzlesValid", () => {
  it("emits a puzzle for an admitted candidate and passes the assert", () => {
    const puzzles = buildPuzzles([baseCandidate()]);
    expect(puzzles).toHaveLength(1);
    expect(puzzles[0].puzzleId).toBe("puz-0000");
    expect(puzzles[0].categoryLabel).toBe('Words ending in "ugh"');
    expect(puzzles[0].parValue).toBeGreaterThan(0);
    expect(() => assertPuzzlesValid(puzzles)).not.toThrow();
  });

  it("drops rejected candidates", () => {
    const bad = baseCandidate();
    bad.words = bad.words.slice(0, 3);
    expect(buildPuzzles([bad])).toHaveLength(0);
  });

  it("numbers puzzle ids sequentially", () => {
    const a = baseCandidate();
    const b: Candidate = { ...baseCandidate(), affixValue: "ough" };
    const puzzles = buildPuzzles([a, b]);
    expect(puzzles.map((p) => p.puzzleId)).toEqual(["puz-0000", "puz-0001"]);
  });

  it("REQ-042 / TEST-072: every emitted puzzle has par above zero", () => {
    for (const p of buildPuzzles([baseCandidate()])) {
      expect(p.parValue).toBeGreaterThan(0);
    }
  });

  it("assertPuzzlesValid rejects a par of zero", () => {
    const puzzles = buildPuzzles([baseCandidate()]);
    const broken = [{ ...puzzles[0], parValue: 0 }];
    expect(() => assertPuzzlesValid(broken)).toThrow(/par/i);
  });

  it("assertPuzzlesValid rejects an answer failing its own affix", () => {
    const puzzles = buildPuzzles([baseCandidate()]);
    const broken = [
      { ...puzzles[0], answers: [...puzzles[0].answers, { word: "table", panelScore: 5, isFindable: true }] },
    ];
    expect(() => assertPuzzlesValid(broken)).toThrow(/affix/i);
  });

  it("assertPuzzlesValid rejects a duplicate word within a puzzle", () => {
    const puzzles = buildPuzzles([baseCandidate()]);
    const dup = puzzles[0].answers[0];
    const broken = [{ ...puzzles[0], answers: [...puzzles[0].answers, dup] }];
    expect(() => assertPuzzlesValid(broken)).toThrow(/duplicate/i);
  });

  it("REQ-044: emitted answers carry no vector or tier data", () => {
    const [p] = buildPuzzles([baseCandidate()]);
    for (const a of p.answers) {
      expect(Object.keys(a).sort()).toEqual(["isFindable", "panelScore", "word"]);
    }
  });
});
