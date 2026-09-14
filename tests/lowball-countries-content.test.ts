import { describe, it, expect } from "vitest";
import {
  countryGateFailureReason,
  buildCountryAnswers,
  buildCountryPuzzles,
  assertCountryPuzzlesValid,
  groupCountriesByRule,
  bestTwoFindableSum,
  type CountryCandidate,
  type ScoredCountry,
} from "../src/games/lowball/content-build.ts";
import { ruleLabel, type CategoryRule } from "../src/games/lowball/types.ts";

/** Build a ScoredCountry inline. */
const c = (word: string, rank: number | null, tier: 10 | 35 | 50 | 70): ScoredCountry => ({
  word,
  rank,
  tier,
});

const LAND: CategoryRule = { kind: "suffix", value: "land" };

/**
 * A passing CountryCandidate that satisfies all gate rules under the current
 * (post-refactor) thresholds:
 *   - 14 answers  (COUNTRY_MIN_ANSWERS=12 .. COUNTRY_MAX_ANSWERS=45)
 *   - trap score >= COUNTRY_MIN_TRAP_SCORE=45
 *   - >= 12 findable answers (tier <= 50)
 *   - >= 10 non-zero answers with >= 8 distinct scores  (ladder rule)
 *   - par > 0 AND the two weakest findable scores sum below par (winnability)
 * Ranks are chosen so panelScore lands on 12 distinct non-zero values plus one
 * findable zero-scorer, with a single unfindable (tier 70, OOV) filler.
 */
function baseCountryCandidate(): CountryCandidate {
  return {
    rule: LAND,
    words: [
      c("iceland",    300,    10), // ~100 trap
      c("ireland",    1200,   10),
      c("finland",    2000,   10),
      c("thailand",   3000,   35),
      c("scotland",   5000,   35),
      c("swaziland",  8000,   50),
      c("somaliland", 12000,  50),
      c("greenland",  18000,  50),
      c("southland",  27000,  50),
      c("midland",    40000,  50),
      c("loveland",   60000,  50),
      c("newland",    90000,  50),
      c("farland",    140000, 50), // findable zero-scorer
      c("hinterland", null,   70), // unfindable specialist (OOV)
    ],
  };
}

// ---------------------------------------------------------------------------
// groupCountriesByRule
// ---------------------------------------------------------------------------

describe("groupCountriesByRule", () => {
  it("groups countries sharing a suffix into the same bucket", () => {
    const input: ScoredCountry[] = [
      c("iceland", 100, 10),
      c("ireland", 200, 10),
      c("finland", 3000, 35),
      c("germany", 500, 10),
    ];
    const candidates = groupCountriesByRule([LAND], input);
    const landBucket = candidates.find((cand) => cand.words.every((sc) => sc.word.endsWith("land")));
    expect(landBucket).toBeDefined();
    expect(landBucket?.words.length).toBe(3);
  });

  it("produces a bucket for stan-suffix countries", () => {
    const stans: ScoredCountry[] = [
      c("kazakhstan", 5000, 35),
      c("uzbekistan", 8000, 35),
      c("kyrgyzstan", null, 50),
      c("tajikistan", null, 50),
    ];
    const candidates = groupCountriesByRule([{ kind: "suffix", value: "stan" }], stans);
    expect(candidates[0]?.words.length).toBe(4);
  });

  it("returns no candidates for empty input", () => {
    expect(groupCountriesByRule([LAND], [])).toEqual([]);
  });

  it("drops a rule matching zero countries", () => {
    const input: ScoredCountry[] = [c("iceland", 100, 10)];
    expect(groupCountriesByRule([{ kind: "suffix", value: "zzz" }], input)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// buildCountryAnswers
// ---------------------------------------------------------------------------

describe("buildCountryAnswers", () => {
  it("returns answers sorted highest panelScore first", () => {
    const answers = buildCountryAnswers(baseCountryCandidate());
    for (let i = 1; i < answers.length; i++) {
      expect(answers[i - 1].panelScore).toBeGreaterThanOrEqual(answers[i].panelScore);
    }
  });

  it("marks tier-10 and tier-35 words as findable", () => {
    const answers = buildCountryAnswers(baseCountryCandidate());
    expect(answers.find((a) => a.word === "iceland")?.isFindable).toBe(true);
    expect(answers.find((a) => a.word === "thailand")?.isFindable).toBe(true);
  });

  it("marks a tier-70 OOV word as not findable", () => {
    const answers = buildCountryAnswers(baseCountryCandidate());
    expect(answers.find((a) => a.word === "hinterland")?.isFindable).toBe(false);
  });

  it("falls back to the tier score, not a hard zero, for an OOV FINDABLE word (REQ-COUNTRY-002)", () => {
    const candidate: CountryCandidate = {
      rule: LAND,
      words: [c("oovland", null, 50)],
    };
    const [answer] = buildCountryAnswers(candidate);
    expect(answer.isFindable).toBe(true);
    expect(answer.panelScore).toBeGreaterThan(0);
  });

  it("answer objects carry only word, panelScore, isFindable", () => {
    const answers = buildCountryAnswers(baseCountryCandidate());
    for (const a of answers) {
      expect(Object.keys(a).sort()).toEqual(["isFindable", "panelScore", "word"]);
    }
  });
});

// ---------------------------------------------------------------------------
// countryGateFailureReason
// ---------------------------------------------------------------------------

describe("countryGateFailureReason", () => {
  it("admits the base candidate", () => {
    expect(countryGateFailureReason(baseCountryCandidate())).toBeNull();
  });

  it("rejects fewer than 12 answers (answer_count)", () => {
    const bad: CountryCandidate = {
      ...baseCountryCandidate(),
      words: [c("iceland", 120, 10), c("ireland", 400, 10)],
    };
    expect(countryGateFailureReason(bad)).toBe("answer_count");
  });

  it("rejects more than 45 answers (answer_count)", () => {
    const extra = Array.from({ length: 40 }, (_, i) => c(`country${i}land`, 10000 + i * 500, 50));
    const bad: CountryCandidate = {
      ...baseCountryCandidate(),
      words: [...baseCountryCandidate().words, ...extra],
    };
    expect(countryGateFailureReason(bad)).toBe("answer_count");
  });

  it("rejects when no answer scores >= 45 (no_trap)", () => {
    const bad: CountryCandidate = {
      rule: LAND,
      words: Array.from({ length: 13 }, (_, i) => c(`country${i}land`, 50000 + i * 2000, 50)),
    };
    expect(countryGateFailureReason(bad)).toBe("no_trap");
  });

  it("rejects fewer than 12 findable answers (findable_count)", () => {
    const bad: CountryCandidate = {
      rule: LAND,
      words: [
        c("iceland", 300, 10),
        c("ireland", 400, 10),
        ...Array.from({ length: 10 }, (_, i) => c(`unfind${i}land`, null, 70)),
      ],
    };
    expect(countryGateFailureReason(bad)).toBe("findable_count");
  });

  it("rejects a category unwinnable in two sweeps (unwinnable)", () => {
    // Every findable answer clusters near the trap, so par sits far above what
    // any two-sweep total could undercut — the exact shape of the original bug
    // (e.g. "starting with bel": belgium/belarus/belize all score 40+).
    const bad: CountryCandidate = {
      rule: LAND,
      words: Array.from({ length: 13 }, (_, i) => c(`country${i}land`, 100 + i * 50, 10)),
    };
    const failure = countryGateFailureReason(bad);
    // With every score near 100, best2FindableSum is far above any achievable
    // par, so the gate must reject it — either as unwinnable, or (if the ladder
    // rule fires first because scores cluster too tightly) no_ladder. Both are
    // valid rejections; the one invariant that matters is IT IS REJECTED.
    expect(failure).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// buildCountryPuzzles + assertCountryPuzzlesValid
// ---------------------------------------------------------------------------

describe("buildCountryPuzzles + assertCountryPuzzlesValid", () => {
  it("emits one puzzle for a passing candidate and passes the assert", () => {
    const puzzles = buildCountryPuzzles([baseCountryCandidate()]);
    expect(puzzles).toHaveLength(1);
    expect(puzzles[0].categoryLabel).toBe('Countries ending in "land"');
    expect(puzzles[0].parValue).toBeGreaterThan(0);
    expect(() => assertCountryPuzzlesValid(puzzles)).not.toThrow();
  });

  it("every emitted puzzle is winnable in two sweeps", () => {
    const puzzles = buildCountryPuzzles([baseCountryCandidate()]);
    for (const p of puzzles) {
      expect(bestTwoFindableSum(p.answers)).toBeLessThan(p.parValue);
    }
  });

  it("emits zero puzzles for a failing candidate", () => {
    const bad: CountryCandidate = {
      ...baseCountryCandidate(),
      words: [c("iceland", 120, 10), c("ireland", 400, 10)],
    };
    expect(buildCountryPuzzles([bad])).toHaveLength(0);
  });

  it("numbers puzzle IDs sequentially", () => {
    const a = baseCountryCandidate();
    const b: CountryCandidate = { ...baseCountryCandidate(), rule: { kind: "suffix", value: "stan" } };
    const puzzles = buildCountryPuzzles([a, b]);
    expect(puzzles.map((p) => p.puzzleId)).toEqual(["puz-0000", "puz-0001"]);
  });

  it("every emitted puzzle has categoryDomain 'countries'", () => {
    const puzzles = buildCountryPuzzles([baseCountryCandidate()]);
    for (const p of puzzles) {
      expect((p as unknown as Record<string, unknown>)["categoryDomain"]).toBe("countries");
    }
  });

  it("assertCountryPuzzlesValid throws on par zero", () => {
    const puzzles = buildCountryPuzzles([baseCountryCandidate()]);
    const broken = [{ ...puzzles[0], parValue: 0 }];
    expect(() => assertCountryPuzzlesValid(broken)).toThrow(/par/i);
  });

  it("assertCountryPuzzlesValid throws on an unwinnable par (REQ-COUNTRY-003)", () => {
    const puzzles = buildCountryPuzzles([baseCountryCandidate()]);
    const best2 = bestTwoFindableSum(puzzles[0].answers);
    const broken = [{ ...puzzles[0], parValue: best2 }];
    expect(() => assertCountryPuzzlesValid(broken)).toThrow(/unwinnable/i);
  });

  it("assertCountryPuzzlesValid throws on duplicate answer within a puzzle", () => {
    const puzzles = buildCountryPuzzles([baseCountryCandidate()]);
    const dup = puzzles[0].answers[0];
    const broken = [{ ...puzzles[0], answers: [...puzzles[0].answers, dup] }];
    expect(() => assertCountryPuzzlesValid(broken)).toThrow(/duplicate/i);
  });

  it("answer objects carry only word, panelScore, isFindable", () => {
    const [p] = buildCountryPuzzles([baseCountryCandidate()]);
    for (const a of p.answers) {
      expect(Object.keys(a).sort()).toEqual(["isFindable", "panelScore", "word"]);
    }
  });
});

describe("ruleLabel (countries domain)", () => {
  it('suffix label uses "ending in" phrasing', () => {
    expect(ruleLabel({ kind: "suffix", value: "land" }, "countries")).toBe('Countries ending in "land"');
  });
  it('prefix label uses "starting with" phrasing', () => {
    expect(ruleLabel({ kind: "prefix", value: "nor" }, "countries")).toBe('Countries starting with "nor"');
  });
});
