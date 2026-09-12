// Affix Loom pure engine. The validator pipeline is ported verbatim from the
// standalone app's core/validator.ts (deterministic, side-effect-free, identical
// verdicts across WKWebView/Android WebView/browsers). The attempt-state reducer
// replaces the standalone FSM/session with the hub's functional immutable-state
// convention (see sever/engine.ts). Streak/stats are owned by the hub kit.

import type {
  Puzzle,
  Selection,
  ValidationResult,
  ReasonCodeInternal,
  ReasonCodePlayer,
  MorphemeGrade,
  TargetSpec,
  AttemptState,
  AttemptRecord,
} from "./types.ts";

export const MAX_ATTEMPTS = 6;

/** NFC + casefold + diacritic strip, collapse to a single token. */
export function normalizeToken(input: string): string {
  const nfc = input.normalize("NFC");
  const lower = nfc.toLowerCase();
  const stripped = lower.normalize("NFD").replace(/\p{M}+/gu, "");
  return stripped.replace(/\s+/gu, "");
}

/** Map an internal code to its player-facing bucket. */
export function rollupReason(code: ReasonCodeInternal): ReasonCodePlayer {
  switch (code) {
    case "OK":
      return "VALID";
    case "LEXICON_MISS":
      return "INVALID_WORD";
    case "TARGET_MISMATCH":
      return "NOT_TODAYS_ANSWER";
    case "AFFIX_NOT_ALLOWED":
    case "SLOT_ORDER_INVALID":
    case "COMPATIBILITY_FAIL":
    case "TABOO_WORD":
      return "RULES_MISMATCH";
    default:
      return "RULES_MISMATCH";
  }
}

function applyOrtho(join: string, op: string, from?: string, to?: string): string {
  switch (op) {
    case "silent_e_drop":
      return join.replace(/e\u0000/g, "\u0000");
    case "consonant_double":
      return join.replace(/([bcdfghjklmnpqrstvwxyz])\u0000/g, "$1$1\u0000");
    case "replace":
      if (from === undefined || to === undefined) return join;
      return join.replace(from, to);
    default:
      return join;
  }
}

/** Build the canonical surface form (prefixes + base + suffixes) applying any
 * (base_id, affix_id) ortho rewrites. A distinct prefix-boundary marker (\u0001)
 * is used for prefix→base joins so ortho ops (which target the base→suffix
 * marker \u0000) never mangle a prefix that ends in the same letter — e.g.
 * re- + use + -able must yield "reusable", not "rusable". Both markers are
 * removed to produce the final surface form. */
export function assembleSurfaceForm(puzzle: Puzzle, sel: Selection): string | null {
  const base = puzzle.bases.find((b) => b.id === sel.base_id);
  if (!base) return null;

  const prefTokens = sel.prefix_ids.map((id) => {
    const a = puzzle.prefixes.find((p) => p.id === id);
    return a ? a.token : null;
  });
  const sufTokens = sel.suffix_ids.map((id) => {
    const a = puzzle.suffixes.find((s) => s.id === id);
    return a ? a.token : null;
  });
  if (prefTokens.includes(null) || sufTokens.includes(null)) return null;

  let joined =
    (prefTokens as string[]).join("\u0001") +
    (prefTokens.length ? "\u0001" : "") +
    base.token +
    (sufTokens.length ? "\u0000" : "") +
    (sufTokens as string[]).join("\u0000");

  const affixIds = [...sel.prefix_ids, ...sel.suffix_ids];
  for (const rule of puzzle.ortho_rules) {
    if (rule.base_id !== base.id) continue;
    if (!affixIds.includes(rule.affix_id)) continue;
    joined = applyOrtho(joined, rule.op, rule.from, rule.to);
  }

  return joined.replace(/[\u0000\u0001]/g, "");
}

function makeResult(
  internal: ReasonCodeInternal,
  normalized: string,
  surface: string,
  grades: MorphemeGrade[] = [],
): ValidationResult {
  return {
    reason_internal: internal,
    reason_player: rollupReason(internal),
    normalized_token: normalized,
    canonical_surface_form: surface,
    grades,
  };
}

/** Resolve the day's target decomposition for grading. */
export function resolveTargetSpec(puzzle: Puzzle, normalizedTarget: string): TargetSpec | null {
  if (puzzle.target_specs && puzzle.target_specs.length > 0) {
    const exact = puzzle.target_specs.find((t) => t.surface === normalizedTarget);
    return exact ?? puzzle.target_specs[0];
  }
  if (puzzle.targets.includes(normalizedTarget)) {
    return { base_id: "", prefix_ids: [], suffix_ids: [], surface: normalizedTarget };
  }
  return null;
}

/** Grade each SELECTED morpheme against the target decomposition. CORRECT = same
 * id in the same slot at the same index; PRESENT = id occurs elsewhere in the
 * target; ABSENT otherwise. Only selected morphemes are graded (anti-spoiler). */
export function gradeGuess(puzzle: Puzzle, sel: Selection, spec: TargetSpec): MorphemeGrade[] {
  const grades: MorphemeGrade[] = [];
  const targetAll = new Set<string>([spec.base_id, ...spec.prefix_ids, ...spec.suffix_ids]);

  const statusFor = (id: string, inSlotAtIndex: boolean): MorphemeGrade["status"] => {
    if (inSlotAtIndex) return "CORRECT";
    return targetAll.has(id) && id !== "" ? "PRESENT" : "ABSENT";
  };

  if (sel.base_id !== null) {
    const base = puzzle.bases.find((b) => b.id === sel.base_id);
    grades.push({
      morpheme_id: sel.base_id,
      token: base ? base.token : sel.base_id,
      slot: "BASE",
      index: 0,
      status: statusFor(sel.base_id, sel.base_id === spec.base_id),
    });
  }
  sel.prefix_ids.forEach((id, i) => {
    const p = puzzle.prefixes.find((x) => x.id === id);
    grades.push({
      morpheme_id: id,
      token: p ? p.token : id,
      slot: "PREFIX",
      index: i,
      status: statusFor(id, spec.prefix_ids[i] === id),
    });
  });
  sel.suffix_ids.forEach((id, i) => {
    const s = puzzle.suffixes.find((x) => x.id === id);
    grades.push({
      morpheme_id: id,
      token: s ? s.token : id,
      slot: "SUFFIX",
      index: i,
      status: statusFor(id, spec.suffix_ids[i] === id),
    });
  });
  return grades;
}

/** Validate a selection against a puzzle. Deterministic and pure. The lexicon is
 * passed in (a Set) so validation is decoupled from the puzzle's affix inventory
 * — the hub supplies the large wordkit-derived en-GB accept-list. */
export function validateAttempt(
  puzzle: Puzzle,
  sel: Selection,
  lexicon: ReadonlySet<string>,
): ValidationResult {
  if (sel.prefix_ids.length > puzzle.slot_rules.max_prefixes) {
    return makeResult("SLOT_ORDER_INVALID", "", "");
  }
  if (sel.suffix_ids.length > puzzle.slot_rules.max_suffixes) {
    return makeResult("SLOT_ORDER_INVALID", "", "");
  }
  if (!puzzle.slot_rules.allow_repeat_affix) {
    const all = [...sel.prefix_ids, ...sel.suffix_ids];
    if (new Set(all).size !== all.length) {
      return makeResult("AFFIX_NOT_ALLOWED", "", "");
    }
  }

  const surface = assembleSurfaceForm(puzzle, sel);
  if (surface === null) {
    return makeResult("AFFIX_NOT_ALLOWED", "", "");
  }

  const normalized = normalizeToken(surface);

  const affixIds = [...sel.prefix_ids, ...sel.suffix_ids];
  for (const combo of puzzle.compatibility.banned_combos) {
    if (combo.base_id === sel.base_id && affixIds.includes(combo.affix_id)) {
      return makeResult("COMPATIBILITY_FAIL", normalized, surface);
    }
  }
  if (
    normalized.length < puzzle.compatibility.min_len ||
    normalized.length > puzzle.compatibility.max_len
  ) {
    return makeResult("COMPATIBILITY_FAIL", normalized, surface);
  }

  if (!lexicon.has(normalized)) {
    return makeResult("LEXICON_MISS", normalized, surface);
  }

  if (puzzle.taboo_tokens.includes(normalized)) {
    return makeResult("TABOO_WORD", normalized, surface);
  }

  const spec = resolveTargetSpec(puzzle, normalized);
  const isTarget = puzzle.targets.includes(normalized);
  const gradeSpec = spec ?? { base_id: "", prefix_ids: [], suffix_ids: [], surface: normalized };
  const grades = gradeGuess(puzzle, sel, gradeSpec);

  if (!isTarget) {
    return makeResult("TARGET_MISMATCH", normalized, surface, grades);
  }
  return makeResult("OK", normalized, surface, grades);
}

// ---- Attempt-state reducer (hub functional-immutable convention) ------------

const EMPTY_SELECTION: Selection = { base_id: null, prefix_ids: [], suffix_ids: [] };

export function initAttempt(_puzzle: Puzzle, dayId: string): AttemptState {
  return {
    dayId,
    selection: { ...EMPTY_SELECTION },
    attempts: [],
    attemptsUsed: 0,
    isSolved: false,
    isFailed: false,
    lastReason: null,
  };
}

export function selectBase(state: AttemptState, baseId: string): AttemptState {
  if (state.isSolved || state.isFailed) return state;
  return { ...state, selection: { ...state.selection, base_id: baseId } };
}

/** Toggle a prefix on/off (idempotent add/remove, preserving order). */
export function togglePrefix(state: AttemptState, prefixId: string): AttemptState {
  if (state.isSolved || state.isFailed) return state;
  const has = state.selection.prefix_ids.includes(prefixId);
  const prefix_ids = has
    ? state.selection.prefix_ids.filter((id) => id !== prefixId)
    : [...state.selection.prefix_ids, prefixId];
  return { ...state, selection: { ...state.selection, prefix_ids } };
}

export function toggleSuffix(state: AttemptState, suffixId: string): AttemptState {
  if (state.isSolved || state.isFailed) return state;
  const has = state.selection.suffix_ids.includes(suffixId);
  const suffix_ids = has
    ? state.selection.suffix_ids.filter((id) => id !== suffixId)
    : [...state.selection.suffix_ids, suffixId];
  return { ...state, selection: { ...state.selection, suffix_ids } };
}

export function clearSelection(state: AttemptState): AttemptState {
  if (state.isSolved || state.isFailed) return state;
  return { ...state, selection: { ...EMPTY_SELECTION } };
}

export function canSubmit(state: AttemptState): boolean {
  return !state.isSolved && !state.isFailed && state.selection.base_id !== null;
}

export interface SubmitOutput {
  state: AttemptState;
  result: ValidationResult;
  solved: boolean;
}

/** Apply a guess: validate, record the attempt, advance solved/failed flags. */
export function submit(
  state: AttemptState,
  puzzle: Puzzle,
  lexicon: ReadonlySet<string>,
): SubmitOutput {
  const result = validateAttempt(puzzle, state.selection, lexicon);
  const record: AttemptRecord = {
    surface: result.canonical_surface_form,
    reason: result.reason_player,
    grades: result.grades,
  };
  const attemptsUsed = state.attemptsUsed + 1;
  const solved = result.reason_player === "VALID";
  const failed = !solved && attemptsUsed >= MAX_ATTEMPTS;
  const next: AttemptState = {
    ...state,
    attempts: [...state.attempts, record],
    attemptsUsed,
    isSolved: solved,
    isFailed: failed,
    lastReason: result.reason_player,
    // Clear the working selection after a solve so the board reads clean.
    selection: solved ? { ...EMPTY_SELECTION } : state.selection,
  };
  return { state: next, result, solved };
}
