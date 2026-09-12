import type { Puzzle, BaseWord, Affix, OrthoRule, TargetSpec } from "./types.ts";
import { assembleSurfaceForm, normalizeToken } from "./engine.ts";

// Build-time content generation + fairness gate. Pure + deterministic. Ported
// from the standalone app's tools/pack-factory/seed-content.ts, minus the
// signing/manifest layer (the hub ships a plain precomputed pack).
//
// The affix INVENTORY (bases/prefixes/suffixes/ortho/compatibility) is curated
// here — it is affix-morphology data that wordkit does not provide. The LEXICON
// (real-word accept-list) is supplied separately by the build tool from wordkit
// (loadCorpus, en-GB), decoupling validation from the inventory.

const BASES: BaseWord[] = [
  { id: "b_hope", token: "hope" },
  { id: "b_care", token: "care" },
  { id: "b_use", token: "use" },
  { id: "b_play", token: "play" },
  { id: "b_help", token: "help" },
  { id: "b_run", token: "run" },
  { id: "b_move", token: "move" },
  { id: "b_read", token: "read" },
];

const PREFIXES: Affix[] = [
  { id: "p_un", token: "un", kind: "prefix" },
  { id: "p_re", token: "re", kind: "prefix" },
  { id: "p_pre", token: "pre", kind: "prefix" },
];

const SUFFIXES: Affix[] = [
  { id: "s_ful", token: "ful", kind: "suffix" },
  { id: "s_less", token: "less", kind: "suffix" },
  { id: "s_ing", token: "ing", kind: "suffix" },
  { id: "s_er", token: "er", kind: "suffix" },
  { id: "s_able", token: "able", kind: "suffix" },
];

const ORTHO: OrthoRule[] = [
  { base_id: "b_hope", affix_id: "s_ing", op: "silent_e_drop" },
  { base_id: "b_care", affix_id: "s_ing", op: "silent_e_drop" },
  { base_id: "b_use", affix_id: "s_ing", op: "silent_e_drop" },
  { base_id: "b_use", affix_id: "s_able", op: "silent_e_drop" },
  { base_id: "b_move", affix_id: "s_ing", op: "silent_e_drop" },
  { base_id: "b_move", affix_id: "s_able", op: "silent_e_drop" },
  { base_id: "b_run", affix_id: "s_ing", op: "consonant_double" },
  { base_id: "b_run", affix_id: "s_er", op: "consonant_double" },
];

const COMPATIBILITY = {
  banned_combos: [{ base_id: "b_use", affix_id: "p_un" }],
  min_len: 3,
  max_len: 20,
};

const SLOT_RULES = { max_prefixes: 2, max_suffixes: 2, allow_repeat_affix: false };

/** One daily target: its morpheme decomposition + a definition clue. */
export interface DailyDef {
  base_id: string;
  prefix_ids: string[];
  suffix_ids: string[];
  clue: string;
}

export const DAILY_DEFS: DailyDef[] = [
  { base_id: "b_hope", prefix_ids: [], suffix_ids: ["s_ful"], clue: "Full of optimism; expecting good things." },
  { base_id: "b_care", prefix_ids: [], suffix_ids: ["s_less"], clue: "Not paying enough attention; negligent." },
  { base_id: "b_use", prefix_ids: ["p_re"], suffix_ids: ["s_able"], clue: "Able to be used again and again." },
  { base_id: "b_run", prefix_ids: [], suffix_ids: ["s_ing"], clue: "Moving quickly on foot; in operation." },
  { base_id: "b_help", prefix_ids: [], suffix_ids: ["s_ful"], clue: "Giving useful assistance." },
  { base_id: "b_play", prefix_ids: [], suffix_ids: ["s_ful"], clue: "Fond of games and fun; light-hearted." },
  { base_id: "b_read", prefix_ids: [], suffix_ids: ["s_able"], clue: "Easy or enjoyable to read." },
];

const INVENTORY = {
  bases: BASES,
  prefixes: PREFIXES,
  suffixes: SUFFIXES,
  ortho_rules: ORTHO,
  compatibility: COMPATIBILITY,
  slot_rules: SLOT_RULES,
  taboo_tokens: [] as string[],
};

/** Build the target surface for a daily def using the shared assembly + ortho. */
function surfaceFor(def: DailyDef): string {
  const puzzleShell: Puzzle = {
    ...INVENTORY,
    puzzleId: "",
    targets: [],
    target_specs: [],
    clue: def.clue,
  };
  const surface = assembleSurfaceForm(puzzleShell, {
    base_id: def.base_id,
    prefix_ids: def.prefix_ids,
    suffix_ids: def.suffix_ids,
  });
  if (surface === null) throw new Error(`affix-loom: undecomposable def for base ${def.base_id}`);
  return normalizeToken(surface);
}

/** Build one Puzzle per daily def. Every puzzle carries the full curated
 * inventory plus its own target + decomposition. Deterministic order. */
export function buildPuzzles(defs: DailyDef[] = DAILY_DEFS): Puzzle[] {
  return defs.map((def, i) => {
    const surface = surfaceFor(def);
    const spec: TargetSpec = {
      base_id: def.base_id,
      prefix_ids: def.prefix_ids,
      suffix_ids: def.suffix_ids,
      surface,
    };
    const puzzle: Puzzle = {
      ...INVENTORY,
      puzzleId: `puz-${i.toString().padStart(4, "0")}`,
      targets: [surface],
      target_specs: [spec],
      clue: def.clue,
    };
    return puzzle;
  });
}

/** Fairness gate: every target must be constructible from its own decomposition
 * (round-trips through assembly) AND be a real word in the supplied lexicon. */
export function assertPuzzlesValid(puzzles: Puzzle[], lexicon: ReadonlySet<string>): void {
  for (const p of puzzles) {
    const spec = p.target_specs[0];
    const rebuilt = assembleSurfaceForm(p, {
      base_id: spec.base_id,
      prefix_ids: spec.prefix_ids,
      suffix_ids: spec.suffix_ids,
    });
    if (rebuilt === null || normalizeToken(rebuilt) !== spec.surface) {
      throw new Error(`affix-loom: target for ${p.puzzleId} not reconstructible (${spec.surface})`);
    }
    if (!lexicon.has(spec.surface)) {
      throw new Error(`affix-loom: target ${spec.surface} (${p.puzzleId}) missing from lexicon`);
    }
  }
}
