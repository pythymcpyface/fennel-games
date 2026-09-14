import { describe, it, expect } from "vitest";
import {
  categoryLabelCountries,
  countryGateFailureReason,
  buildCountryAnswers,
  buildCountryPuzzles,
  assertCountryPuzzlesValid,
  groupCountriesByAffix,
  type CountryCandidate,
  type ScoredCountry,
} from "../src/games/lowball/content-build.ts";

/** Build a ScoredCountry inline. */
const c = (word: string, rank: number | null, tier: 10 | 35 | 50 | 70): ScoredCountry => ({
  word,
  rank,
  tier,
});

/**
 * A passing CountryCandidate that satisfies all gate rules:
 *   - 8 answers  (COUNTRY_MIN_ANSWERS=3 .. COUNTRY_MAX_ANSWERS=30)
 *   - trap score >= COUNTRY_MIN_TRAP_SCORE=15
 *   - >= 3 findable answers (tier <= 50)
 *   - >= 1 findable zero-scorer
 *   - >= 2 non-zero answers with >= 2 distinct scores  (ladder rule)
 *   - par > 0
 */
function baseCountryCandidate(): CountryCandidate {
  return {
    affixType: "suffix",
    affixValue: "land",
    words: [
      c("Iceland",    120,    10),  // trap (~100)
      c("Ireland",    400,    10),  // high score
      c("Finland",    3000,   35),  // mid score
      c("Thailand",   8000,   35),  // mid score
      c("Scotland",   20000,  50),  // lower score, findable
      c("Swaziland",  null,   50),  // findable zero-scorer (OOV)
      c("Somaliland", null,   50),  // findable zero-scorer (OOV)
      c("Hinterland", null,   70),  // unfindable specialist
    ],
  };
}

// ---------------------------------------------------------------------------
// categoryLabelCountries
// ---------------------------------------------------------------------------

describe("categoryLabelCountries", () => {
  it('suffix label uses "ending in" phrasing', () => {
    expect(categoryLabelCountries("suffix", "land")).toBe('Countries ending in "land"');
  });

  it('prefix label uses "starting with" phrasing', () => {
    expect(categoryLabelCountries("prefix", "nor")).toBe('Countries starting with "nor"');
  });

  it("uses the affix value verbatim", () => {
    expect(categoryLabelCountries("suffix", "stan")).toBe('Countries ending in "stan"');
  });
});

// ---------------------------------------------------------------------------
// groupCountriesByAffix
// ---------------------------------------------------------------------------

describe("groupCountriesByAffix", () => {
  it("groups countries sharing a suffix into the same bucket", () => {
    const input: ScoredCountry[] = [
      c("Iceland", 100, 10),
      c("Ireland", 200, 10),
      c("Finland", 3000, 35),
      c("Germany", 500, 10),
    ];
    const groups = groupCountriesByAffix(input);
    const landBucket = [...groups.values()].find(
      (list) => list.length >= 3 && list.every((sc) => sc.word.endsWith("land")),
    );
    expect(landBucket).toBeDefined();
  });

  it("produces a bucket for stan-suffix countries", () => {
    const stans: ScoredCountry[] = [
      c("Kazakhstan", 5000, 35),
      c("Uzbekistan", 8000, 35),
      c("Kyrgyzstan", null, 50),
      c("Tajikistan", null, 50),
    ];
    const groups = groupCountriesByAffix(stans);
    const stanBucket = [...groups.values()].find(
      (list) => list.length >= 4 && list.every((sc) => sc.word.endsWith("stan")),
    );
    expect(stanBucket).toBeDefined();
  });

  it("returns an empty map for empty input", () => {
    expect(groupCountriesByAffix([])).toEqual(new Map());
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
    expect(answers.find((a) => a.word === "Iceland")?.isFindable).toBe(true);
    expect(answers.find((a) => a.word === "Finland")?.isFindable).toBe(true);
  });

  it("marks a tier-70 OOV word as not findable", () => {
    const answers = buildCountryAnswers(baseCountryCandidate());
    expect(answers.find((a) => a.word === "Hinterland")?.isFindable).toBe(false);
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

  it("rejects fewer than 3 answers (answer_count)", () => {
    const bad: CountryCandidate = {
      ...baseCountryCandidate(),
      words: [c("Iceland", 120, 10), c("Ireland", 400, 10)],
    };
    expect(countryGateFailureReason(bad)).toBe("answer_count");
  });

  it("rejects more than 30 answers (answer_count)", () => {
    const extra = Array.from({ length: 25 }, (_, i) => c(`Country${i}land`, 10000 + i * 500, 50));
    const bad: CountryCandidate = {
      ...baseCountryCandidate(),
      words: [...baseCountryCandidate().words, ...extra],
    };
    expect(countryGateFailureReason(bad)).toBe("answer_count");
  });

  it("rejects when no answer scores >= 40 (no_trap)", () => {
    const bad: CountryCandidate = {
      affixType: "suffix",
      affixValue: "land",
      words: [
        c("Greenland",  50000, 35),
        c("Swaziland",  60000, 35),
        c("Somaliland", 70000, 35),
        c("Hinterland", null,  50),
      ],
    };
    expect(countryGateFailureReason(bad)).toBe("no_trap");
  });

  it("rejects fewer than 3 findable answers (findable_count)", () => {
    const bad: CountryCandidate = {
      affixType: "suffix",
      affixValue: "land",
      words: [
        c("Iceland",    120,  10),
        c("Ireland",    400,  10),
        c("Hinterland", null, 70),
        c("Somaliland", null, 70),
        c("Disneyland", null, 70),
      ],
    };
    expect(countryGateFailureReason(bad)).toBe("findable_count");
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

  it("emits zero puzzles for a failing candidate", () => {
    const bad: CountryCandidate = {
      ...baseCountryCandidate(),
      words: [c("Iceland", 120, 10), c("Ireland", 400, 10)],
    };
    expect(buildCountryPuzzles([bad])).toHaveLength(0);
  });

  it("numbers puzzle IDs sequentially", () => {
    const a = baseCountryCandidate();
    const b: CountryCandidate = { ...baseCountryCandidate(), affixValue: "stan" };
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
