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
      if (!matchesAffix(a.word, p.affixType, p.affixValue)) {
        throw new Error(`${p.puzzleId}: answer "${a.word}" fails affix ${p.affixType} "${p.affixValue}"`);
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
//   1. Answer pool is COUNTRY_LIST (single-word sovereign state names).
//   2. Scoring signal: GloVe rank where available, editorial tier otherwise.
//   3. Suffix lengths [3, 4] only (no 2-letter suffixes).
//   4. Lower fairness-gate thresholds (smaller namespace ~100 names vs ~50 000).
//   5. categoryLabel uses "Countries" wording.
//   6. Built Puzzle carries categoryDomain: "countries".

/**
 * Recognisability tier for a country whose name is absent from GloVe vocabulary.
 * Mirrors the SCOWL-tier scale so panelScore() can be reused directly.
 *   10 — universally known (G7 / large economies)
 *   35 — well-known (medium-sized, frequently in the news)
 *   50 — findable but less prominent
 *   70 — specialist / rarely mentioned in English media
 */
export type CountryTier = 10 | 35 | 50 | 70;

/** A country entry in the static list. */
export interface CountryEntry {
  /** Lowercase, single-word, a-z only — the normalised form players type. */
  name: string;
  /**
   * Editorial recognisability tier. When the name IS in GloVe the rank
   * governs the score, but tier still controls isFindable.
   */
  tier: CountryTier;
}

/**
 * All single-word sovereign state names, normalised to lowercase a-z.
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
  { name: "iceland",       tier: 10 },
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
  { name: "jamaica",       tier: 35 },
  // tier 50 — findable, less prominent
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
  { name: "liechtenstein", tier: 50 },
  // tier 70 — specialist / rarely mentioned
  { name: "vanuatu",       tier: 70 }, { name: "samoa",       tier: 70 },
  { name: "tonga",         tier: 70 }, { name: "kiribati",    tier: 70 },
  { name: "tuvalu",        tier: 70 }, { name: "nauru",       tier: 70 },
  { name: "palau",         tier: 70 }, { name: "comoros",     tier: 70 },
  { name: "seychelles",    tier: 70 }, { name: "mauritius",   tier: 70 },
  { name: "micronesia",    tier: 70 }, { name: "dominica",    tier: 70 },
  { name: "grenada",       tier: 70 }, { name: "barbados",    tier: 70 },
  { name: "bahamas",       tier: 70 },
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

// --- Country fairness-gate thresholds ----------------------------------------
// Lower than word-mode thresholds: country namespace is ~120 names vs ~50 000.

export const COUNTRY_MIN_ANSWERS = 3;
export const COUNTRY_MAX_ANSWERS = 30;
export const COUNTRY_MIN_TRAP_SCORE = 15;
export const COUNTRY_MIN_FINDABLE = 3;
export const COUNTRY_MIN_NONZERO = 2;
export const COUNTRY_MIN_DISTINCT_NONZERO = 2;

/** Suffix lengths for country categories — no 2-letter suffixes. */
export const COUNTRY_SUFFIX_LENGTHS: readonly number[] = [3, 4];
/** Prefix lengths for country categories. */
export const COUNTRY_PREFIX_LENGTHS: readonly number[] = [3, 4];

/** Human-readable prompt for a country category. */
export function categoryLabelCountries(affixType: AffixType, affixValue: string): string {
  const verb = affixType === "suffix" ? "ending" : "starting";
  const prep = affixType === "suffix" ? "in" : "with";
  return `Countries ${verb} ${prep} "${affixValue}"`;
}

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
  affixType: AffixType;
  affixValue: string;
  words: ScoredCountry[];
}

/**
 * Group country names into candidate affix categories.
 * Uses the RUNTIME matchesAffix predicate so build and runtime cannot diverge.
 */
export function groupCountriesByAffix(
  countries: readonly ScoredCountry[],
): Map<string, ScoredCountry[]> {
  const groups = new Map<string, ScoredCountry[]>();
  const add = (type: AffixType, value: string, sc: ScoredCountry): void => {
    const key = `${type}:${value}`;
    const list = groups.get(key);
    if (list === undefined) groups.set(key, [sc]);
    else list.push(sc);
  };
  for (const sc of countries) {
    for (const len of COUNTRY_SUFFIX_LENGTHS) {
      const value = sc.word.slice(-len);
      if (value.length === len && matchesAffix(sc.word, "suffix", value)) add("suffix", value, sc);
    }
    for (const len of COUNTRY_PREFIX_LENGTHS) {
      const value = sc.word.slice(0, len);
      if (value.length === len && matchesAffix(sc.word, "prefix", value)) add("prefix", value, sc);
    }
  }
  return groups;
}

/**
 * Score every country and flag findability, highest score first.
 * Reuses panelScore / isFindable directly — formula is identical.
 */
export function buildCountryAnswers(candidate: CountryCandidate): Answer[] {
  return candidate.words
    .map((sc) => ({
      word: sc.word,
      panelScore: panelScore(sc.rank, sc.tier),
      isFindable: isFindable(sc.tier),
    }))
    .sort((a, b) => b.panelScore - a.panelScore || a.word.localeCompare(b.word));
}

/** Why a country candidate was refused. Reuses the same labels as GateFailure. */
export type CountryGateFailure = GateFailure;

/**
 * Fairness gate for country categories — same six-rule logic as
 * gateFailureReason but with COUNTRY_* thresholds.
 */
export function countryGateFailureReason(
  candidate: CountryCandidate,
): CountryGateFailure | null {
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
  if (computePar(answers) <= 0) return "par_zero";
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
      affixType: candidate.affixType,
      affixValue: candidate.affixValue,
      categoryLabel: categoryLabelCountries(candidate.affixType, candidate.affixValue),
      answers,
      parValue: computePar(answers),
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
    if (p.answers.length < COUNTRY_MIN_ANSWERS || p.answers.length > COUNTRY_MAX_ANSWERS) {
      throw new Error(
        `${p.puzzleId}: answer count ${p.answers.length} outside ` +
          `${COUNTRY_MIN_ANSWERS}..${COUNTRY_MAX_ANSWERS}`,
      );
    }
    const seen = new Set<string>();
    for (const a of p.answers) {
      if (seen.has(a.word)) throw new Error(`${p.puzzleId}: duplicate answer "${a.word}"`);
      seen.add(a.word);
      if (!matchesAffix(a.word, p.affixType, p.affixValue)) {
        throw new Error(
          `${p.puzzleId}: answer "${a.word}" fails affix ${p.affixType} "${p.affixValue}"`,
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
