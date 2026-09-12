// Lowball — content build logic. Pure and DOM-free so the fairness gate is unit
// testable without touching the 163 MB GloVe file. The build tool (tools/build-lowball.ts)
// supplies scored words; everything here is deterministic arithmetic and filtering.

import {
  FINDABLE_MAX_TIER,
  MAX_PANEL_SCORE,
  matchesAffix,
  type Answer,
  type AffixType,
  type Puzzle,
} from "./types.ts";

/** Does this word fit the category pattern? Re-exported so build and runtime share one rule. */
export { matchesAffix };

// --- Content safety (REQ-001, REQ-002, REQ-003) ------------------------------
//
// This is a family title shipping on the App Store and Play Store, so genuinely
// offensive words must not appear as answers or as category prompts. The original
// implementation tested the blocklist as an UNANCHORED SUBSTRING, which destroyed
// innocent words: /rape/ matched "grape", "drape", "scrape", "serape", "undrape",
// "broomrape" and "crape"; /cock/ matched "peacock" and "shuttlecock". That is the
// Scunthorpe problem, and it was the cause of the reported bug.
//
// Matching is therefore anchored to whole words, plus explicitly enumerated
// inflections and compounds. Whole-word matching ALONE would be worse than the bug,
// because it would newly admit "rapes", "cocks" and "rapeseed".

/** Terms blocked as standalone words. Reviewed by content safety, not engineering. */
const BLOCKED_TERMS: readonly string[] = [
  "slut", "shit", "piss", "cock", "dick", "tits", "arse", "turd", "fuck", "cunt",
  "wank", "twat", "bitch", "whore", "nigger", "spic", "kike", "coon", "fag", "rape",
  "semen", "penis", "vagina", "boob", "willy", "bugger", "bollock", "prick", "knob",
  "smut", "slag", "hooker", "junkie", "heroin", "cocaine",
];

/** Suffixes applied to every blocked term to catch simple inflections. */
const BLOCKED_INFLECTIONS: readonly string[] = ["s", "es", "ed", "ing", "er", "ers", "y"];

/**
 * Inflected forms of a blocked term.
 *
 * Terms ending in `e` need that `e` dropped before a vowel-initial suffix, or the
 * result is nonsense: naive concatenation yields "rapeed" and "rapeing" while the
 * real forms "raped" and "raping" would slip through unblocked.
 */
function inflectionsOf(term: string): string[] {
  const forms = BLOCKED_INFLECTIONS.map((suffix) => term + suffix);
  if (term.endsWith("e")) {
    const stem = term.slice(0, -1);
    for (const suffix of BLOCKED_INFLECTIONS) {
      if (/^[aeiou]/.test(suffix)) forms.push(stem + suffix);
    }
  }
  return forms;
}

/**
 * Offensive compounds that whole-word matching would otherwise admit. Enumerated
 * explicitly so the list is reviewable; extend here rather than loosening the
 * matching rule back toward substring search.
 */
const BLOCKED_COMPOUNDS: readonly string[] = [
  "rapeseed", "rapeseeds", "bullshit", "bullshits", "bullshitting", "horseshit",
  "dipshit", "dipshits", "shithead", "shitheads", "shithouse", "arsehole",
  "arseholes", "dickhead", "dickheads", "cocksucker", "cocksuckers", "motherfucker",
  "motherfuckers", "clusterfuck", "cockfight", "cockfighting", "cockfights",
];

const BLOCKED_SET: ReadonlySet<string> = new Set<string>([
  ...BLOCKED_TERMS,
  ...BLOCKED_TERMS.flatMap(inflectionsOf),
  ...BLOCKED_COMPOUNDS,
]);

/**
 * Is this word excluded on content-safety grounds?
 *
 * Whole-word (plus enumerated inflection/compound) matching only. A word that merely
 * CONTAINS a blocked term is clean: "grape" is a grape.
 */
export function isBlockedWord(word: string): boolean {
  return BLOCKED_SET.has(word.toLowerCase());
}

/**
 * Is this affix safe to show as a category prompt?
 *
 * Tests whether the affix IS a blocked term. It deliberately does NOT test whether
 * some blocked term contains the affix: `"rape".includes("ape")` is true, so that
 * check would reject the `"ape"` category and reproduce the very bug being fixed.
 */
export function isSafeAffix(affixValue: string): boolean {
  return !isBlockedWord(affixValue);
}

// --- Affix grouping (REQ-004) ------------------------------------------------

/** Suffix lengths enumerated as candidate categories. */
export const SUFFIX_LENGTHS: readonly number[] = [2, 3, 4];
/** Prefix lengths enumerated as candidate categories. */
export const PREFIX_LENGTHS: readonly number[] = [3, 4];

/**
 * Group words into candidate affix categories, keyed `"<type>:<value>"`.
 *
 * Membership is decided by calling the RUNTIME `matchesAffix` predicate, not by a
 * parallel length calculation. The original generator used
 * `word.length > affixValue.length + 1` while the runtime uses
 * `word.length > affixValue.length`, so every word exactly one letter longer than its
 * affix was silently dropped from the pack while the engine would have accepted it
 * (cape, tape, came, name, bough...). Sharing the predicate makes that divergence
 * impossible rather than merely fixed.
 */
export function groupWordsByAffix(words: readonly string[]): Map<string, string[]> {
  const groups = new Map<string, string[]>();
  const add = (type: AffixType, value: string, word: string): void => {
    const key = `${type}:${value}`;
    const list = groups.get(key);
    if (list === undefined) groups.set(key, [word]);
    else list.push(word);
  };
  for (const word of words) {
    for (const len of SUFFIX_LENGTHS) {
      const value = word.slice(-len);
      if (value.length === len && matchesAffix(word, "suffix", value)) add("suffix", value, word);
    }
    for (const len of PREFIX_LENGTHS) {
      const value = word.slice(0, len);
      if (value.length === len && matchesAffix(word, "prefix", value)) add("prefix", value, word);
    }
  }
  return groups;
}


// --- Fairness gate thresholds (frozen per content-pack version, ADR-004) ------

/** Inclusive bounds on how many valid answers a category may hold (REQ-031). */
export const MIN_ANSWERS = 10;
export const MAX_ANSWERS = 36;
/** A category needs an obvious answer to avoid, or there is no trap (REQ-032). */
export const MIN_TRAP_SCORE = 45;
/** A category needs enough retrievable answers to be playable (REQ-033). */
export const MIN_FINDABLE = 6;
/** A category needs a real scoring ladder, not a cliff (REQ-035). */
export const MIN_NONZERO = 5;
export const MIN_DISTINCT_NONZERO = 4;

// --- Panel score formula (REQ-036..040) --------------------------------------
//
// GloVe's 400k-word vocabulary is ordered by DESCENDING corpus frequency, so a
// word's line number is a fine-grained frequency rank. Mapping log10(rank) onto
// 0..1 and raising it to a convex exponent means only genuinely common words score
// high, which is what makes obscure answers worth hunting.

/** log10(rank) at or below which a word is universally known -> score 100. */
const LOG_FLOOR = 3.0;
/** log10(rank) at or above which a word is effectively unknown -> score 0. */
const LOG_CEIL = 5.2;
/** Convexity: >1 pushes mid-frequency words down the scale. */
const CURVE = 2.2;

/**
 * How many of a notional 100 people would give this answer.
 *
 * Returns 0 when the word is absent from the GloVe vocabulary (`rank === null`) or
 * sits above the findable SCOWL tier: in both cases a lay panel would never say it.
 * Any non-finite or non-positive rank also yields 0 rather than NaN (REQ-040).
 */
export function panelScore(rank: number | null, tier: number): number {
  if (rank === null) return 0;
  if (!Number.isFinite(rank) || rank <= 0) return 0;
  if (!isFindable(tier)) return 0;

  const x = Math.log10(rank);
  const u = (LOG_CEIL - x) / (LOG_CEIL - LOG_FLOOR);
  const clampedU = Math.min(1, Math.max(0, u));
  const raw = MAX_PANEL_SCORE * Math.pow(clampedU, CURVE);
  if (!Number.isFinite(raw)) return 0;
  return Math.min(MAX_PANEL_SCORE, Math.max(0, Math.round(raw)));
}

/** Whether a lay player could plausibly retrieve a word at this SCOWL tier. */
export function isFindable(tier: number): boolean {
  return tier <= FINDABLE_MAX_TIER;
}

// --- Category shape ----------------------------------------------------------

/** A corpus word with the two signals the formula needs. */
export interface ScoredWord {
  word: string;
  /** GloVe vocabulary line number, or null when out of vocabulary. */
  rank: number | null;
  /** SCOWL frequency tier: 10 commonest .. 70 rarest. */
  tier: number;
}

/** A category proposed by the build tool, before the fairness gate runs. */
export interface Candidate {
  affixType: AffixType;
  affixValue: string;
  words: ScoredWord[];
}

/** Why a candidate was refused admission to the content pack. */
export type GateFailure =
  | "answer_count"
  | "no_trap"
  | "findable_count"
  | "no_findable_zero"
  | "no_ladder"
  | "par_zero";

/** Human-readable prompt for a category. */
export function categoryLabel(affixType: AffixType, affixValue: string): string {
  const verb = affixType === "suffix" ? "ending" : "starting";
  const prep = affixType === "suffix" ? "in" : "with";
  return `Words ${verb} ${prep} "${affixValue}"`;
}

/**
 * Score every word and flag its findability, highest score first so the reveal can
 * render the ladder top-down. Only the three shipped fields survive: rank and tier
 * are derivation inputs and must not reach the client (REQ-044, ADR-005).
 */
export function buildAnswers(candidate: Candidate): Answer[] {
  return candidate.words
    .map((sw) => ({
      word: sw.word,
      panelScore: panelScore(sw.rank, sw.tier),
      isFindable: isFindable(sw.tier),
    }))
    .sort((a, b) => b.panelScore - a.panelScore || a.word.localeCompare(b.word));
}

/**
 * Beat-par target: the median panel score across FINDABLE answers only (REQ-041).
 * Unfindable words are excluded because par should reflect what a real player can
 * reach, not what the corpus happens to contain.
 */
export function computePar(answers: Answer[]): number {
  const scores = answers
    .filter((a) => a.isFindable)
    .map((a) => a.panelScore)
    .sort((a, b) => a - b);
  if (scores.length === 0) return 0;
  const mid = Math.floor(scores.length / 2);
  const median = scores.length % 2 === 1 ? scores[mid] : (scores[mid - 1] + scores[mid]) / 2;
  return Math.round(median);
}

/**
 * The fairness gate. Returns null when the category is admissible, else the first
 * rule it breaks.
 *
 * Note this is deliberately NOT a uniqueness gate. Every other game in the hub
 * admits a puzzle only if exactly one answer is correct; Lowball is a gradient with
 * several 0-scorers, so the gate instead guarantees a findable low scorer, a real
 * trap, and a graded ladder between them.
 */
export function gateFailureReason(candidate: Candidate): GateFailure | null {
  const answers = buildAnswers(candidate);

  if (answers.length < MIN_ANSWERS || answers.length > MAX_ANSWERS) return "answer_count";

  const top = answers[0]?.panelScore ?? 0;
  if (top < MIN_TRAP_SCORE) return "no_trap";

  const findable = answers.filter((a) => a.isFindable);
  if (findable.length < MIN_FINDABLE) return "findable_count";

  if (!findable.some((a) => a.panelScore === 0)) return "no_findable_zero";

  const nonZero = answers.filter((a) => a.panelScore > 0);
  const distinct = new Set(nonZero.map((a) => a.panelScore)).size;
  if (nonZero.length < MIN_NONZERO || distinct < MIN_DISTINCT_NONZERO) return "no_ladder";

  // Par is computed last because it depends on the findable set surviving the rules
  // above. A par of 0 would make the category unwinnable, since no total can be
  // below zero (REQ-042, ADR-007).
  if (computePar(answers) <= 0) return "par_zero";

  return null;
}

/** Turn admitted candidates into puzzles, numbered in input order. */
export function buildPuzzles(candidates: Candidate[]): Puzzle[] {
  const puzzles: Puzzle[] = [];
  for (const candidate of candidates) {
    if (gateFailureReason(candidate) !== null) continue;
    const answers = buildAnswers(candidate);
    puzzles.push({
      puzzleId: `puz-${puzzles.length.toString().padStart(4, "0")}`,
      affixType: candidate.affixType,
      affixValue: candidate.affixValue,
      categoryLabel: categoryLabel(candidate.affixType, candidate.affixValue),
      answers,
      parValue: computePar(answers),
    });
  }
  return puzzles;
}

/**
 * Final build-time assertion over the emitted pack. Throws on the first violation
 * so a bad pack can never ship.
 */
export function assertPuzzlesValid(puzzles: Puzzle[]): void {
  for (const p of puzzles) {
    if (p.parValue <= 0) {
      throw new Error(`${p.puzzleId}: par must exceed 0, got ${p.parValue}`);
    }
    if (p.answers.length < MIN_ANSWERS || p.answers.length > MAX_ANSWERS) {
      throw new Error(`${p.puzzleId}: answer count ${p.answers.length} outside ${MIN_ANSWERS}..${MAX_ANSWERS}`);
    }
    const seen = new Set<string>();
    for (const a of p.answers) {
      if (seen.has(a.word)) throw new Error(`${p.puzzleId}: duplicate answer "${a.word}"`);
      seen.add(a.word);
      if (!matchesAffix(a.word, p.affixType, p.affixValue)) {
        throw new Error(`${p.puzzleId}: answer "${a.word}" fails affix ${p.affixType} "${p.affixValue}"`);
      }
      if (!Number.isInteger(a.panelScore) || a.panelScore < 0 || a.panelScore > MAX_PANEL_SCORE) {
        throw new Error(`${p.puzzleId}: answer "${a.word}" has out-of-range score ${a.panelScore}`);
      }
    }
    if (!p.answers.some((a) => a.isFindable && a.panelScore === 0)) {
      throw new Error(`${p.puzzleId}: no findable zero-scoring answer`);
    }
  }
}
