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

/** Which end of the word the category pattern pins. */
export type AffixType = "suffix" | "prefix";

/**
 * Does this word fit the category pattern? The affix alone never counts, so a
 * category of "ugh" does not accept the bare word "ugh".
 *
 * Lives here, in the dependency-free types module, so build-time admission
 * (`assertPuzzlesValid`) and run-time validation (`submitAnswer`) share one
 * implementation. Duplicating it risked a future rule change applying to only one
 * side, which would let the pack admit answers the engine then rejects.
 */
export function matchesAffix(word: string, affixType: AffixType, affixValue: string): boolean {
  if (word.length <= affixValue.length) return false;
  return affixType === "suffix" ? word.endsWith(affixValue) : word.startsWith(affixValue);
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
  affixType: AffixType;
  /** the pinned letters, e.g. "ugh" */
  affixValue: string;
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
