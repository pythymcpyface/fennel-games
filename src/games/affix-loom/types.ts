// Domain types for the Affix Loom hub plugin. Ported from the standalone app's
// core/types.ts, trimmed to the plugin model: the immutable-pack signing,
// hashing, and manifest fields are dropped (the hub loads a plain precomputed
// JSON pack via AssetPort; integrity is handled by the app bundle/PWA cache).

export type ReasonCodePlayer =
  | "VALID"
  | "INVALID_WORD"
  | "NOT_TODAYS_ANSWER"
  | "RULES_MISMATCH";

export type MorphemeStatus = "CORRECT" | "PRESENT" | "ABSENT";
export type MorphemeSlot = "BASE" | "PREFIX" | "SUFFIX";

export interface MorphemeGrade {
  morpheme_id: string;
  token: string;
  slot: MorphemeSlot;
  index: number;
  status: MorphemeStatus;
}

export interface TargetSpec {
  base_id: string;
  prefix_ids: string[];
  suffix_ids: string[];
  surface: string;
}

export type ReasonCodeInternal =
  | "AFFIX_NOT_ALLOWED"
  | "SLOT_ORDER_INVALID"
  | "COMPATIBILITY_FAIL"
  | "TABOO_WORD"
  | "TARGET_MISMATCH"
  | "LEXICON_MISS"
  | "OK";

export interface BaseWord {
  id: string;
  token: string;
  pos?: string;
}

export interface Affix {
  id: string;
  token: string;
  kind: "prefix" | "suffix";
  pos?: string;
}

export interface OrthoRule {
  base_id: string;
  affix_id: string;
  op: "silent_e_drop" | "consonant_double" | "replace";
  from?: string;
  to?: string;
}

export interface Compatibility {
  banned_combos: Array<{ base_id: string; affix_id: string }>;
  min_len: number;
  max_len: number;
}

export interface SlotRules {
  max_prefixes: number;
  max_suffixes: number;
  allow_repeat_affix: boolean;
}

/** One daily puzzle in the pack: an affix inventory + the day's target + clue. */
export interface Puzzle {
  puzzleId: string;
  bases: BaseWord[];
  prefixes: Affix[];
  suffixes: Affix[];
  ortho_rules: OrthoRule[];
  compatibility: Compatibility;
  slot_rules: SlotRules;
  taboo_tokens: string[];
  targets: string[];
  target_specs: TargetSpec[];
  clue: string;
}

export interface ValidationResult {
  reason_player: ReasonCodePlayer;
  reason_internal: ReasonCodeInternal;
  normalized_token: string;
  canonical_surface_form: string;
  grades: MorphemeGrade[];
}

export interface Selection {
  base_id: string | null;
  prefix_ids: string[];
  suffix_ids: string[];
}

/** One recorded attempt shown in the attempts list. */
export interface AttemptRecord {
  surface: string;
  reason: ReasonCodePlayer;
  grades: MorphemeGrade[];
}

/** Per-day attempt state persisted by the hub. */
export interface AttemptState {
  dayId: string;
  selection: Selection;
  attempts: AttemptRecord[];
  attemptsUsed: number;
  isSolved: boolean;
  isFailed: boolean;
  lastReason: ReasonCodePlayer | null;
}
