// Lowball — content build logic. Pure and DOM-free so the fairness gate is unit
// testable without touching the 163 MB GloVe file. The build tool (tools/build-lowball.ts)
// supplies scored words; everything here is deterministic arithmetic and filtering.

import {
  FINDABLE_MAX_TIER,
  MAX_PANEL_SCORE,
  matchesRule,
  ruleLabel,
  type Answer,
  type CategoryRule,
  type Puzzle,
} from "./types.ts";

/** Does this word fit the category rule? Re-exported so build and runtime share one rule. */
export { matchesRule };

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
 * Membership is decided by calling the RUNTIME `matchesRule` predicate, not by a
 * parallel length calculation. The original generator used
 * `word.length > affixValue.length + 1` while the runtime uses
 * `word.length > affixValue.length`, so every word exactly one letter longer than its
 * affix was silently dropped from the pack while the engine would have accepted it
 * (cape, tape, came, name, bough...). Sharing the predicate makes that divergence
 * impossible rather than merely fixed.
 */
export function groupWordsByAffix(words: readonly string[]): Map<string, string[]> {
  const groups = new Map<string, string[]>();
  const add = (type: "prefix" | "suffix", value: string, word: string): void => {
    const key = `${type}:${value}`;
    const list = groups.get(key);
    if (list === undefined) groups.set(key, [word]);
    else list.push(word);
  };
  for (const word of words) {
    for (const len of SUFFIX_LENGTHS) {
      const value = word.slice(-len);
      if (value.length === len && matchesRule(word, { kind: "suffix", value })) add("suffix", value, word);
    }
    for (const len of PREFIX_LENGTHS) {
      const value = word.slice(0, len);
      if (value.length === len && matchesRule(word, { kind: "prefix", value })) add("prefix", value, word);
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

/** The GloVe-rank curve alone, shared by panelScore and countryPanelScore. */
function scoreFromRank(rank: number): number {
  const x = Math.log10(rank);
  const u = (LOG_CEIL - x) / (LOG_CEIL - LOG_FLOOR);
  const clampedU = Math.min(1, Math.max(0, u));
  const raw = MAX_PANEL_SCORE * Math.pow(clampedU, CURVE);
  if (!Number.isFinite(raw)) return 0;
  return Math.min(MAX_PANEL_SCORE, Math.max(0, Math.round(raw)));
}

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
  return scoreFromRank(rank);
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
  rule: CategoryRule;
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
 * The lowest achievable 2-sweep total using only findable answers, i.e. the best
 * a player who finds the two weakest real answers can score. `SWEEPS_TOTAL` is 2,
 * so this is exactly the floor a category's par must clear to be winnable at all.
 * Sorted ascending; the two lowest scores are the best case (REQ-042).
 */
export function bestTwoFindableSum(answers: readonly Answer[]): number {
  const scores = answers
    .filter((a) => a.isFindable)
    .map((a) => a.panelScore)
    .sort((a, b) => a - b);
  return (scores[0] ?? 0) + (scores[1] ?? 0);
}

/**
 * Beat-par target for a TWO-SWEEP round: the median of every distinct pair-sum
 * across findable answers, rather than the median of single answers (REQ-041).
 *
 * `computePar` (words) takes the median of single scores, which understates the
 * true beat-par bar for a round that sums two sweeps — half of it is unreachable
 * with only one answer in hand. Countries has a much smaller answer pool (no
 * findable zero-scorer exists among 154+ names), so that understatement makes a
 * category mathematically unwinnable: par sits below the sum of even the two
 * weakest real answers. Pair-median par fixes this for the countries domain
 * without touching the words pack, which is already winnable under the simpler
 * definition and has its own tuning history.
 */
export function computeCountryPar(answers: Answer[]): number {
  const scores = answers
    .filter((a) => a.isFindable)
    .map((a) => a.panelScore)
    .sort((a, b) => a - b);
  const sums: number[] = [];
  for (let i = 0; i < scores.length; i++) {
    for (let j = i + 1; j < scores.length; j++) sums.push(scores[i] + scores[j]);
  }
  if (sums.length === 0) return 0;
  sums.sort((a, b) => a - b);
  const mid = Math.floor(sums.length / 2);
  const median = sums.length % 2 === 1 ? sums[mid] : (sums[mid - 1] + sums[mid]) / 2;
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
      rule: candidate.rule,
      categoryLabel: ruleLabel(candidate.rule, "words"),
      answers,
      parValue: computePar(answers),
      categoryDomain: "words",
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
      if (!matchesRule(a.word, p.rule)) {
        throw new Error(`${p.puzzleId}: answer "${a.word}" fails rule ${JSON.stringify(p.rule)}`);
      }
      if (!Number.isInteger(a.panelScore) || a.panelScore < 0 || a.panelScore > MAX_PANEL_SCORE) {
        throw new Error(`${p.puzzleId}: answer "${a.word}" has out-of-range score ${a.panelScore}`);
      }
    }
  }
}

// =============================================================================
// COUNTRIES VARIANT
// =============================================================================
//
// The countries variant reuses every engine primitive unchanged. Differences:
//   1. Answer pool is COUNTRY_LIST (sovereign state names, single- and multi-word;
//      normalize() strips spaces so "South Africa" and "southafrica" are the same
//      submission).
//   2. Scoring signal: GloVe rank where available, editorial tier fallback
//      otherwise — NOT a hard zero. A country absent from GloVe's corpus is not
//      the same thing as a country nobody would say (REQ-COUNTRY-002).
//   3. Category rules are generated across many families (letter position,
//      containment, length, vowel shape, substrings), not just fixed-length
//      prefixes/suffixes, because the ~190-name pool cannot support enough
//      3/4-letter-affix categories with adequate supply (REQ-COUNTRY-001).
//   4. Fairness-gate thresholds sized for a small closed namespace, PLUS a
//      winnability check: the two lowest findable scores must sum below par,
//      since a round is two sweeps, not one (REQ-COUNTRY-003).
//   5. ruleLabel(rule, "countries") supplies "Countries" wording.
//   6. Built Puzzle carries categoryDomain: "countries".

/**
 * Recognisability tier for a country. Mirrors the SCOWL-tier scale so
 * isFindable() can be reused directly.
 *   10 — universally known (G7 / large economies)
 *   35 — well-known (medium-sized, frequently in the news)
 *   50 — findable but less prominent
 *   70 — specialist / rarely mentioned in English media
 */
export type CountryTier = 10 | 35 | 50 | 70;

/** A country entry in the static list. */
export interface CountryEntry {
  /** Lowercase, a-z only, no spaces — the normalised form players type. */
  name: string;
  /**
   * Editorial recognisability tier. When the name IS in GloVe the rank
   * governs the score, but tier still controls isFindable and supplies the
   * fallback score when the name is out of vocabulary.
   */
  tier: CountryTier;
}

/**
 * All sovereign state names, normalised to lowercase a-z with spaces removed.
 * Tier: 10 = universally known, 35 = well-known, 50 = findable, 70 = specialist.
 * Duplicates resolved by COUNTRIES (first-seen wins, lower tier kept).
 */
export const COUNTRY_LIST: readonly CountryEntry[] = [
  // tier 10 — universally known
  { name: "france",        tier: 10 }, { name: "germany",     tier: 10 },
  { name: "china",         tier: 10 }, { name: "india",       tier: 10 },
  { name: "canada",        tier: 10 }, { name: "australia",   tier: 10 },
  { name: "brazil",        tier: 10 }, { name: "russia",      tier: 10 },
  { name: "italy",         tier: 10 }, { name: "spain",       tier: 10 },
  { name: "japan",         tier: 10 }, { name: "mexico",      tier: 10 },
  { name: "argentina",     tier: 10 }, { name: "colombia",    tier: 10 },
  { name: "nigeria",       tier: 10 }, { name: "indonesia",   tier: 10 },
  { name: "pakistan",      tier: 10 }, { name: "bangladesh",  tier: 10 },
  { name: "ethiopia",      tier: 10 }, { name: "iran",        tier: 10 },
  { name: "egypt",         tier: 10 }, { name: "turkey",      tier: 10 },
  { name: "ukraine",       tier: 10 }, { name: "ghana",       tier: 10 },
  { name: "kenya",         tier: 10 }, { name: "sweden",      tier: 10 },
  { name: "norway",        tier: 10 }, { name: "denmark",     tier: 10 },
  { name: "finland",       tier: 10 }, { name: "poland",      tier: 10 },
  { name: "portugal",      tier: 10 }, { name: "greece",      tier: 10 },
  { name: "israel",        tier: 10 }, { name: "iraq",        tier: 10 },
  { name: "chile",         tier: 10 }, { name: "peru",        tier: 10 },
  { name: "venezuela",     tier: 10 }, { name: "cuba",        tier: 10 },
  { name: "iceland",       tier: 10 }, { name: "libya",       tier: 10 },
  { name: "yemen",         tier: 10 },
  // tier 10 — universally known, multi-word (normalize() strips the space)
  { name: "unitedkingdom", tier: 10 }, { name: "unitedstates", tier: 10 },
  { name: "southafrica",   tier: 10 }, { name: "newzealand",   tier: 10 },
  { name: "saudiarabia",   tier: 10 }, { name: "southkorea",   tier: 10 },
  { name: "northkorea",    tier: 10 },
  // tier 35 — well-known
  { name: "romania",       tier: 35 }, { name: "hungary",     tier: 35 },
  { name: "austria",       tier: 35 }, { name: "switzerland", tier: 35 },
  { name: "belgium",       tier: 35 }, { name: "netherlands", tier: 35 },
  { name: "ireland",       tier: 35 }, { name: "thailand",    tier: 35 },
  { name: "vietnam",       tier: 35 }, { name: "malaysia",    tier: 35 },
  { name: "singapore",     tier: 35 }, { name: "philippines", tier: 35 },
  { name: "taiwan",        tier: 35 }, { name: "afghanistan", tier: 35 },
  { name: "morocco",       tier: 35 }, { name: "algeria",     tier: 35 },
  { name: "angola",        tier: 35 }, { name: "tanzania",    tier: 35 },
  { name: "mozambique",    tier: 35 }, { name: "zimbabwe",    tier: 35 },
  { name: "cameroon",      tier: 35 }, { name: "uganda",      tier: 35 },
  { name: "sudan",         tier: 35 }, { name: "senegal",     tier: 35 },
  { name: "tunisia",       tier: 35 }, { name: "syria",       tier: 35 },
  { name: "jordan",        tier: 35 }, { name: "lebanon",     tier: 35 },
  { name: "bolivia",       tier: 35 }, { name: "ecuador",     tier: 35 },
  { name: "uruguay",       tier: 35 }, { name: "paraguay",    tier: 35 },
  { name: "croatia",       tier: 35 }, { name: "serbia",      tier: 35 },
  { name: "slovakia",      tier: 35 }, { name: "bulgaria",    tier: 35 },
  { name: "lithuania",     tier: 35 }, { name: "latvia",      tier: 35 },
  { name: "estonia",       tier: 35 }, { name: "slovenia",    tier: 35 },
  { name: "albania",       tier: 35 }, { name: "georgia",     tier: 35 },
  { name: "armenia",       tier: 35 }, { name: "azerbaijan",  tier: 35 },
  { name: "kazakhstan",    tier: 35 }, { name: "uzbekistan",  tier: 35 },
  { name: "cambodia",      tier: 35 }, { name: "nepal",       tier: 35 },
  { name: "myanmar",       tier: 35 }, { name: "somalia",     tier: 35 },
  { name: "chad",          tier: 35 }, { name: "madagascar",  tier: 35 },
  { name: "zambia",        tier: 35 }, { name: "malawi",      tier: 35 },
  { name: "rwanda",        tier: 35 }, { name: "haiti",       tier: 35 },
  { name: "jamaica",       tier: 35 }, { name: "liberia",     tier: 35 },
  // tier 35 — well-known, multi-word
  { name: "srilanka",      tier: 35 }, { name: "costarica",   tier: 35 },
  { name: "czechrepublic", tier: 35 }, { name: "dominicanrepublic", tier: 35 },
  { name: "unitedarabemirates", tier: 35 },
  // tier 50 — findable, less prominent (includes the small-island states that
  // were previously mis-tiered 70 despite being in the GloVe corpus — see
  // REQ-COUNTRY-002)
  { name: "mongolia",      tier: 50 }, { name: "belarus",     tier: 50 },
  { name: "moldova",       tier: 50 }, { name: "kosovo",      tier: 50 },
  { name: "macedonia",     tier: 50 }, { name: "montenegro",  tier: 50 },
  { name: "tajikistan",    tier: 50 }, { name: "kyrgyzstan",  tier: 50 },
  { name: "turkmenistan",  tier: 50 }, { name: "laos",        tier: 50 },
  { name: "bhutan",        tier: 50 }, { name: "maldives",    tier: 50 },
  { name: "brunei",        tier: 50 }, { name: "eritrea",     tier: 50 },
  { name: "djibouti",      tier: 50 }, { name: "burundi",     tier: 50 },
  { name: "benin",         tier: 50 }, { name: "togo",        tier: 50 },
  { name: "mali",          tier: 50 }, { name: "niger",       tier: 50 },
  { name: "guinea",        tier: 50 }, { name: "gabon",       tier: 50 },
  { name: "botswana",      tier: 50 }, { name: "lesotho",     tier: 50 },
  { name: "swaziland",     tier: 50 }, { name: "namibia",     tier: 50 },
  { name: "suriname",      tier: 50 }, { name: "guyana",      tier: 50 },
  { name: "belize",        tier: 50 }, { name: "honduras",    tier: 50 },
  { name: "nicaragua",     tier: 50 }, { name: "guatemala",   tier: 50 },
  { name: "panama",        tier: 50 }, { name: "bahrain",     tier: 50 },
  { name: "kuwait",        tier: 50 }, { name: "oman",        tier: 50 },
  { name: "qatar",         tier: 50 }, { name: "cyprus",      tier: 50 },
  { name: "malta",         tier: 50 }, { name: "luxembourg",  tier: 50 },
  { name: "andorra",       tier: 50 }, { name: "monaco",      tier: 50 },
  { name: "liechtenstein", tier: 50 }, { name: "vanuatu",     tier: 50 },
  { name: "samoa",         tier: 50 }, { name: "tonga",       tier: 50 },
  { name: "kiribati",      tier: 50 }, { name: "tuvalu",      tier: 50 },
  { name: "nauru",         tier: 50 }, { name: "palau",       tier: 50 },
  { name: "comoros",       tier: 50 }, { name: "seychelles",  tier: 50 },
  { name: "mauritius",     tier: 50 }, { name: "micronesia",  tier: 50 },
  { name: "dominica",      tier: 50 }, { name: "grenada",     tier: 50 },
  { name: "barbados",      tier: 50 }, { name: "bahamas",     tier: 50 },
  { name: "fiji",          tier: 50 }, { name: "gambia",      tier: 50 },
  { name: "mauritania",    tier: 50 },
  // tier 50 — findable, multi-word
  { name: "elsalvador",    tier: 50 }, { name: "ivorycoast",  tier: 50 },
  { name: "sierraleone",   tier: 50 }, { name: "burkinafaso", tier: 50 },
  { name: "southsudan",    tier: 50 }, { name: "papuanewguinea", tier: 50 },
  { name: "centralafricanrepublic", tier: 50 }, { name: "trinidadandtobago", tier: 50 },
  { name: "vaticancity",   tier: 50 },
  // tier 70 — specialist / rarely mentioned
  { name: "eswatini",      tier: 70 },
  // tier 70 — specialist, multi-word
  { name: "capeverde",     tier: 70 }, { name: "easttimor",   tier: 70 },
  { name: "equatorialguinea", tier: 70 }, { name: "guineabissau", tier: 70 },
  { name: "marshallislands", tier: 70 }, { name: "solomonislands", tier: 70 },
  { name: "sanmarino",     tier: 70 }, { name: "saotomeandprincipe", tier: 70 },
];

/** De-duplicated country list. First-seen wins so lower tier is always kept. */
export const COUNTRIES: readonly CountryEntry[] = ((): readonly CountryEntry[] => {
  const seen = new Set<string>();
  const result: CountryEntry[] = [];
  for (const c of COUNTRY_LIST) {
    if (!seen.has(c.name)) { seen.add(c.name); result.push(c); }
  }
  return result;
})();

// --- Country panel score: GloVe rank, with a TIER FALLBACK instead of a hard
// zero (REQ-COUNTRY-002) -------------------------------------------------------
//
// panelScore() (words) returns 0 for any rank === null, which is correct there:
// GloVe's 400k-word vocabulary is large enough that absence really does mean
// "nobody would say this". It is the wrong rule for countries: several genuinely
// well-known names (multi-word states like "south africa", which GloVe never
// tokenises as one word) are absent from GloVe for a corpus-tokenisation reason
// that has nothing to do with recognisability. Falling back to a score derived
// from the editorial tier keeps those countries scoring like their tier suggests
// instead of like a findable-zero trap.

/** Fallback score used when a country's name is absent from the GloVe corpus. */
const COUNTRY_TIER_FALLBACK: Record<CountryTier, number> = { 10: 85, 35: 45, 50: 22, 70: 8 };

/**
 * How many of a notional 100 people would give this country. Unlike
 * `panelScore`, an out-of-vocabulary name does NOT collapse to 0 — it falls back
 * to a score fixed by editorial tier, since OOV here usually just means "GloVe
 * doesn't tokenise multi-word names", not "obscure".
 */
export function countryPanelScore(rank: number | null, tier: CountryTier): number {
  if (!isFindable(tier)) return 0;
  if (rank === null || !Number.isFinite(rank) || rank <= 0) return COUNTRY_TIER_FALLBACK[tier];
  return scoreFromRank(rank);
}

// --- Country fairness-gate thresholds ----------------------------------------
// Sized for a ~190-name closed namespace, not the ~50 000-word corpus, AND for a
// TWO-SWEEP round: a category is worthless if its two weakest findable answers
// already sum to par or above (REQ-COUNTRY-003).

export const COUNTRY_MIN_ANSWERS = 12;
export const COUNTRY_MAX_ANSWERS = 45;
export const COUNTRY_MIN_TRAP_SCORE = 45;
export const COUNTRY_MIN_FINDABLE = 12;
export const COUNTRY_MIN_NONZERO = 10;
export const COUNTRY_MIN_DISTINCT_NONZERO = 8;

/** Prefix/suffix/contains substring lengths tested when enumerating rules. */
export const COUNTRY_SUBSTRING_LENGTHS: readonly number[] = [2, 3, 4];

/** A country name with the two signals the scoring formula needs. */
export interface ScoredCountry {
  word: string;
  /** GloVe vocabulary line number, or null when OOV. */
  rank: number | null;
  /** Editorial recognisability tier (10/35/50/70). */
  tier: CountryTier;
}

/** A country category proposed by the build tool, before the fairness gate. */
export interface CountryCandidate {
  rule: CategoryRule;
  words: ScoredCountry[];
}

/**
 * Every candidate rule worth testing against the country pool: fixed structural
 * rules (letter position, length, vowel shape) enumerated directly, plus every
 * prefix/suffix/contains substring that actually OCCURS in some country name.
 *
 * Testing only occurring substrings — rather than every possible 2..4-letter
 * combination — mirrors `groupWordsByAffix`'s approach and keeps the candidate
 * set proportional to the corpus: a substring absent from every name can never
 * clear `COUNTRY_MIN_ANSWERS`, so generating it would only waste gate cycles.
 */
export function enumerateCountryRules(countries: readonly ScoredCountry[]): CategoryRule[] {
  const rules: CategoryRule[] = [];
  const AZ = "abcdefghijklmnopqrstuvwxyz".split("");
  for (const letter of AZ) {
    rules.push({ kind: "startsLetter", letter });
    rules.push({ kind: "endsLetter", letter });
    rules.push({ kind: "containsLetter", letter });
    rules.push({ kind: "lacksLetter", letter });
    rules.push({ kind: "letterAtLeast", letter, n: 3 });
  }
  for (const n of [4, 5, 6, 7, 8, 9, 10, 11, 12]) rules.push({ kind: "lengthEq", n });
  for (const n of [6, 7, 8, 9, 10, 11, 12]) rules.push({ kind: "lengthGte", n });
  for (const n of [4, 5, 6, 7, 8]) rules.push({ kind: "lengthLte", n });
  rules.push(
    { kind: "startsVowel" },
    { kind: "startsConsonant" },
    { kind: "sameFirstLast" },
    { kind: "tripleConsonant" },
  );
  for (const n of [3, 4, 5, 6]) rules.push({ kind: "vowelCountGte", n });
  for (const n of [2, 3]) rules.push({ kind: "vowelCountLte", n });

  const seenPrefix = new Set<string>();
  const seenSuffix = new Set<string>();
  const seenContains = new Set<string>();
  for (const c of countries) {
    for (const len of COUNTRY_SUBSTRING_LENGTHS) {
      const pre = c.word.slice(0, len);
      if (pre.length === len && !seenPrefix.has(pre)) {
        seenPrefix.add(pre);
        rules.push({ kind: "prefix", value: pre });
      }
      const suf = c.word.slice(-len);
      if (suf.length === len && !seenSuffix.has(suf)) {
        seenSuffix.add(suf);
        rules.push({ kind: "suffix", value: suf });
      }
    }
    for (let i = 0; i + 2 <= c.word.length; i++) {
      const g = c.word.slice(i, i + 2);
      if (!seenContains.has(g)) {
        seenContains.add(g);
        rules.push({ kind: "contains", value: g });
      }
    }
  }
  return rules;
}

/**
 * Group countries by every candidate rule. Membership is decided by calling the
 * RUNTIME `matchesRule` predicate — the same guarantee `groupWordsByAffix` gives
 * the words pack, extended to a rule space rather than just two affix kinds.
 * Rules matching zero countries are dropped immediately; the gate would reject
 * them anyway, but there is no reason to carry them through it.
 */
export function groupCountriesByRule(
  rules: readonly CategoryRule[],
  countries: readonly ScoredCountry[],
): CountryCandidate[] {
  const candidates: CountryCandidate[] = [];
  for (const rule of rules) {
    const words = countries.filter((c) => matchesRule(c.word, rule));
    if (words.length > 0) candidates.push({ rule, words });
  }
  return candidates;
}

/**
 * Score every country and flag findability, highest score first.
 * Uses `countryPanelScore` (tier fallback on OOV), not `panelScore` (hard-zero
 * on OOV) — see REQ-COUNTRY-002.
 */
export function buildCountryAnswers(candidate: CountryCandidate): Answer[] {
  return candidate.words
    .map((sc) => ({
      word: sc.word,
      panelScore: countryPanelScore(sc.rank, sc.tier),
      isFindable: isFindable(sc.tier),
    }))
    .sort((a, b) => b.panelScore - a.panelScore || a.word.localeCompare(b.word));
}

/**
 * Why a country candidate was refused. Extends GateFailure with `unwinnable`,
 * the one extra rule the country gate needs that the words gate does not (see
 * `countryGateFailureReason`).
 */
export type CountryGateFailure = GateFailure | "unwinnable";

/**
 * Fairness gate for country categories — same shape as `gateFailureReason`, with
 * COUNTRY_* thresholds and one extra rule `gateFailureReason` does not need: a
 * round sums TWO sweeps, so a category is unwinnable unless its two weakest
 * findable answers together undercut par. The words pack never needs this check
 * because it always contains a findable zero-scorer; the country pool does not.
 */
export function countryGateFailureReason(candidate: CountryCandidate): CountryGateFailure | null {
  const answers = buildCountryAnswers(candidate);
  if (answers.length < COUNTRY_MIN_ANSWERS || answers.length > COUNTRY_MAX_ANSWERS)
    return "answer_count";
  const top = answers[0]?.panelScore ?? 0;
  if (top < COUNTRY_MIN_TRAP_SCORE) return "no_trap";
  const findable = answers.filter((a) => a.isFindable);
  if (findable.length < COUNTRY_MIN_FINDABLE) return "findable_count";
  const nonZero = answers.filter((a) => a.panelScore > 0);
  const distinct = new Set(nonZero.map((a) => a.panelScore)).size;
  if (nonZero.length < COUNTRY_MIN_NONZERO || distinct < COUNTRY_MIN_DISTINCT_NONZERO)
    return "no_ladder";
  const par = computeCountryPar(answers);
  if (par <= 0) return "par_zero";
  if (bestTwoFindableSum(answers) >= par) return "unwinnable";
  return null;
}

/**
 * Turn admitted country candidates into Puzzles.
 * startIndex offsets puz-NNNN ids for callers building a combined pack.
 */
export function buildCountryPuzzles(
  candidates: CountryCandidate[],
  startIndex = 0,
): Puzzle[] {
  const puzzles: Puzzle[] = [];
  for (const candidate of candidates) {
    if (countryGateFailureReason(candidate) !== null) continue;
    const answers = buildCountryAnswers(candidate);
    puzzles.push({
      puzzleId: `puz-${(startIndex + puzzles.length).toString().padStart(4, "0")}`,
      rule: candidate.rule,
      categoryLabel: ruleLabel(candidate.rule, "countries"),
      answers,
      parValue: computeCountryPar(answers),
      categoryDomain: "countries",
    });
  }
  return puzzles;
}

/** Final build-time assertion over a countries pack. */
export function assertCountryPuzzlesValid(puzzles: Puzzle[]): void {
  for (const p of puzzles) {
    if (p.categoryDomain !== "countries") {
      throw new Error(
        `${p.puzzleId}: expected categoryDomain "countries", got "${p.categoryDomain}"`,
      );
    }
    if (p.parValue <= 0)
      throw new Error(`${p.puzzleId}: par must exceed 0, got ${p.parValue}`);
    // A round sums SWEEPS_TOTAL (2) sweeps: a par that cannot be undercut by the
    // best two findable answers makes the category impossible to win no matter
    // what the player does — the exact bug this refactor exists to fix.
    if (bestTwoFindableSum(p.answers) >= p.parValue) {
      throw new Error(
        `${p.puzzleId}: unwinnable — best 2-answer sum ${bestTwoFindableSum(p.answers)} ` +
          `is not below par ${p.parValue}`,
      );
    }
    if (p.answers.length < COUNTRY_MIN_ANSWERS || p.answers.length > COUNTRY_MAX_ANSWERS) {
      throw new Error(
        `${p.puzzleId}: answer count ${p.answers.length} outside ` +
          `${COUNTRY_MIN_ANSWERS}..${COUNTRY_MAX_ANSWERS}`,
      );
    }
    const findableSupply = p.answers.filter((a) => a.isFindable).length;
    if (findableSupply < COUNTRY_MIN_FINDABLE) {
      throw new Error(
        `${p.puzzleId}: only ${findableSupply} findable answers, need at least ${COUNTRY_MIN_FINDABLE}`,
      );
    }
    const seen = new Set<string>();
    for (const a of p.answers) {
      if (seen.has(a.word)) throw new Error(`${p.puzzleId}: duplicate answer "${a.word}"`);
      seen.add(a.word);
      if (!matchesRule(a.word, p.rule)) {
        throw new Error(
          `${p.puzzleId}: answer "${a.word}" fails rule ${JSON.stringify(p.rule)}`,
        );
      }
      if (!Number.isInteger(a.panelScore) || a.panelScore < 0 || a.panelScore > MAX_PANEL_SCORE) {
        throw new Error(
          `${p.puzzleId}: answer "${a.word}" has out-of-range score ${a.panelScore}`,
        );
      }
    }
  }
}
