// Lowball — shared types. Pure data shapes only; no imports, no side effects.
//
// Lowball inverts the usual scoring: every valid answer carries a PANEL SCORE of
// 0..100 modelling how many of a notional 100 people would have given it, and the
// player wants the LOWEST total. Obvious answers score near 100; obscure-but-real
// answers score 0.
//
// The panel score is a DERIVED STATISTICAL MODEL computed at build time from corpus
// frequency (GloVe vocabulary rank) and SCOWL knowability tiers. It is not a survey
// of real people, and the view must say so (REQ-053).

/**
 * Verbatim honesty disclosure required by REQ-053, rendered wherever a panel score
 * is presented.
 *
 * The panel score is a statistical model derived from corpus frequency, not a survey
 * of real people. Lives in types.ts rather than the view so it is unit-testable
 * without a DOM: a typo here would silently weaken the one constraint the product
 * must not get wrong.
 */
export const PANEL_DISCLOSURE = "simulated panel of 100 \u00b7 from corpus frequency";

/**
 * Honesty disclosure for the countries variant. The scoring signal is name
 * recognisability (GloVe rank where available, editorial tier otherwise) rather
 * than raw corpus frequency, so the wording differs deliberately.
 */
export const PANEL_DISCLOSURE_COUNTRIES = "simulated panel of 100 \u00b7 from name recognisability";

/**
 * Which domain of answers a puzzle draws from. Drives the category label wording
 * and the content-build scoring path; the engine is domain-agnostic.
 */
export type CategoryDomain = "words" | "countries";

/** Phrasings that would falsely imply a real survey. Asserted absent by tests. */
export const FORBIDDEN_SURVEY_PHRASES = [
  "we asked 100 people",
  "we surveyed",
  "100 people were asked",
  "survey of 100",
] as const;

/** Two sweeps per round: each sweep takes exactly one answer. */
export const SWEEPS_TOTAL = 2;

/** Maximum panel score, and the penalty for any invalid submission. */
export const MAX_PANEL_SCORE = 100;

/**
 * SCOWL tier at or below which a word is treated as retrievable by a lay player.
 * Tiers above this are specialist or archaic: real words, but nobody would say them,
 * so they score 0 and are flagged unfindable (REQ-038, TERM-010).
 */
export const FINDABLE_MAX_TIER = 50;

/**
 * A category's admission test, as data rather than a hardcoded prefix/suffix pair.
 * Each variant is one fact about a word that the fairness gate can verify has
 * enough supply and enough of a scoring ladder. `all` combines two rules with AND,
 * used for narrower categories (e.g. "starts with a consonant AND 8+ letters").
 *
 * `prefix`/`suffix`/`contains` subsume what used to be the fixed AffixType/
 * affixValue pair; the affix alone never counts (a category of "ugh" does not
 * accept the bare word "ugh").
 */
export type CategoryRule =
  | { kind: "prefix" | "suffix" | "contains"; value: string }
  | { kind: "startsLetter" | "endsLetter" | "containsLetter" | "lacksLetter"; letter: string }
  | { kind: "letterAtLeast"; letter: string; n: number }
  | { kind: "lengthEq" | "lengthGte" | "lengthLte"; n: number }
  | { kind: "vowelCountGte" | "vowelCountLte"; n: number }
  | { kind: "startsVowel" | "startsConsonant" | "sameFirstLast" | "tripleConsonant" }
  | { kind: "all"; rules: CategoryRule[] };

const VOWELS = new Set(["a", "e", "i", "o", "u"]);

/** How many vowels (a/e/i/o/u) a normalised word contains. */
function vowelCount(word: string): number {
  let n = 0;
  for (const ch of word) if (VOWELS.has(ch)) n++;
  return n;
}

/**
 * Does this word satisfy a single (non-`all`) rule?
 *
 * Lives here, in the dependency-free types module, so build-time admission
 * (`assertPuzzlesValid`) and run-time validation (`submitAnswer`) share one
 * implementation. Duplicating it risked a future rule change applying to only one
 * side, which would let the pack admit answers the engine then rejects.
 */
function matchesSingleRule(word: string, rule: Exclude<CategoryRule, { kind: "all" }>): boolean {
  switch (rule.kind) {
    case "prefix":
      return word.length > rule.value.length && word.startsWith(rule.value);
    case "suffix":
      return word.length > rule.value.length && word.endsWith(rule.value);
    case "contains":
      return word.length > rule.value.length && word.includes(rule.value);
    case "startsLetter":
      return word.startsWith(rule.letter);
    case "endsLetter":
      return word.endsWith(rule.letter);
    case "containsLetter":
      return word.includes(rule.letter);
    case "lacksLetter":
      return !word.includes(rule.letter);
    case "letterAtLeast": {
      let n = 0;
      for (const ch of word) if (ch === rule.letter) n++;
      return n >= rule.n;
    }
    case "lengthEq":
      return word.length === rule.n;
    case "lengthGte":
      return word.length >= rule.n;
    case "lengthLte":
      return word.length <= rule.n;
    case "vowelCountGte":
      return vowelCount(word) >= rule.n;
    case "vowelCountLte":
      return vowelCount(word) <= rule.n;
    case "startsVowel":
      return VOWELS.has(word[0] ?? "");
    case "startsConsonant":
      return word.length > 0 && !VOWELS.has(word[0] ?? "");
    case "sameFirstLast":
      return word.length > 0 && word[0] === word[word.length - 1];
    case "tripleConsonant":
      return /[^aeiou]{3}/.test(word);
  }
}

/** Does this word fit the category rule? */
export function matchesRule(word: string, rule: CategoryRule): boolean {
  if (rule.kind === "all") return rule.rules.every((r) => matchesRule(word, r));
  return matchesSingleRule(word, rule);
}

/**
 * Human-readable prompt fragment for a single (non-`all`) rule, e.g. `ending in
 * "ugh"` or `with 8 or more letters`. Composed by `ruleLabel` into a full prompt.
 */
function singleRuleFragment(rule: Exclude<CategoryRule, { kind: "all" }>): string {
  switch (rule.kind) {
    case "prefix":
      return `starting with "${rule.value}"`;
    case "suffix":
      return `ending in "${rule.value}"`;
    case "contains":
      return `containing "${rule.value}"`;
    case "startsLetter":
      return `starting with "${rule.letter}"`;
    case "endsLetter":
      return `ending in "${rule.letter}"`;
    case "containsLetter":
      return `containing "${rule.letter}"`;
    case "lacksLetter":
      return `with no "${rule.letter}"`;
    case "letterAtLeast":
      return `with "${rule.letter}" ${rule.n} or more times`;
    case "lengthEq":
      return `with exactly ${rule.n} letters`;
    case "lengthGte":
      return `with ${rule.n} or more letters`;
    case "lengthLte":
      return `with ${rule.n} letters or fewer`;
    case "vowelCountGte":
      return `with ${rule.n} or more vowels`;
    case "vowelCountLte":
      return `with ${rule.n} vowels or fewer`;
    case "startsVowel":
      return "starting with a vowel";
    case "startsConsonant":
      return "starting with a consonant";
    case "sameFirstLast":
      return "starting and ending with the same letter";
    case "tripleConsonant":
      return "with three consonants in a row";
  }
}

/** Human-readable prompt for a category rule, e.g. `Words ending in "ugh"`. */
export function ruleLabel(rule: CategoryRule, domain: CategoryDomain): string {
  const subject = domain === "countries" ? "Countries" : "Words";
  if (rule.kind === "all") {
    return `${subject} ${rule.rules.map((r) => singleRuleFragment(r as Exclude<CategoryRule, { kind: "all" }>)).join(" and ")}`;
  }
  return `${subject} ${singleRuleFragment(rule)}`;
}

/** One admissible answer for a category, with its precomputed panel score. */
export interface Answer {
  /** normalised, lowercase, /^[a-z]+$/ */
  word: string;
  /** 0..100 — how many of a notional 100 people would have said this. */
  panelScore: number;
  /**
   * True when a lay player could plausibly retrieve this word (SCOWL tier <=
   * FINDABLE_MAX_TIER). Distinguishes a genuine find from a lucky junk word, so a
   * 0-scoring `usquebaugh` is not celebrated like a 0-scoring `hiccough`.
   */
  isFindable: boolean;
}

/** A single day's category. */
export interface Puzzle {
  puzzleId: string;
  /** the admission test every answer must satisfy */
  rule: CategoryRule;
  /** human-readable prompt, e.g. `Words ending in "ugh"` */
  categoryLabel: string;
  /**
   * Every valid answer for this category, derived from the complete corpus. This
   * list IS the runtime validator: a submission absent from it is invalid by
   * definition, so no separate dictionary ships (ADR-002).
   */
  answers: Answer[];
  /**
   * Beat-par target: the median panel score across findable answers. A total
   * strictly below par wins. Always > 0, so every shipped category is winnable
   * (REQ-042).
   */
  parValue: number;
  /**
   * Which answer domain this puzzle draws from. Defaults to "words" for the
   * original English-word pack; "countries" for the geography variant. The engine
   * is domain-agnostic — only the build tool, disclosure text, and label wording
   * differ.
   */
  categoryDomain: CategoryDomain;
}

/** Why a submission scored the maximum penalty instead of its panel score. */
export type InvalidReason = "not_in_list" | "affix_mismatch" | "duplicate" | "empty";

/** One consumed sweep. */
export interface Sweep {
  /** normalised submission; "" when the raw input normalised to nothing. */
  answerWord: string;
  /** 0..100 — the panel score, or MAX_PANEL_SCORE for any invalid submission. */
  panelScore: number;
  /** null when the answer was valid. */
  invalidReason: InvalidReason | null;
  /** true when this repeats an answer the same player already gave. */
  isDuplicateOfEarlierAnswer: boolean;
}

/** Per-player progress. v1 renders exactly one. */
export interface PlayerState {
  playerId: number;
  sweeps: Sweep[];
}

export type Verdict = "pending" | "win" | "loss";

/** Which storage namespace a round belongs to. Never mixed (ADR-003). */
export type RoundMode = "daily" | "practice";

/** Full round state. Every engine transition returns a new object. */
export interface AttemptState {
  puzzleId: string;
  dayId: string;
  mode: RoundMode;
  players: PlayerState[];
  activePlayerIndex: number;
  /** 0..SWEEPS_TOTAL — advances on every consumed sweep, valid or not. */
  sweepIndex: number;
  verdict: Verdict;
  /**
   * Tension counter: drains from MAX_PANEL_SCORE down to the latest sweep's score
   * one discrete step per `advanceTick` call. A logical tick, not wall-clock time,
   * so the engine stays pure and the drain is unit-testable (ADR-001).
   */
  tickCounter: number;
  /** Target the tick counter is draining toward; null before any sweep. */
  tickTarget: number | null;
}

/** Error markers returned instead of throwing on a misuse the view should prevent. */
export type SubmitError = "no_sweeps_remaining";

/** Result of a submission attempt. */
export interface SubmitResult {
  state: AttemptState;
  /** null on success; set when the submission was refused outright. */
  error: SubmitError | null;
  /** the sweep just consumed, or null when refused. */
  sweep: Sweep | null;
}
