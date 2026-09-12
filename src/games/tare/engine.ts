import type { AttemptState, Evaluation, ImbalanceBand, Puzzle, Tile, ValidationCode } from "./types.ts";

// Pure Tare engine. No storage, no clock. Multiset tile accounting + weight
// balance. The player proposes a LEFT and RIGHT word; the engine assigns the rack
// tiles to those letters, verifying every tile is used exactly once and the pans
// balance within tolerance.

export function normalize(word: string): string {
  return word.trim().toUpperCase();
}

/** Letter -> count multiset for a word. */
function letterCounts(word: string): Map<string, number> {
  const m = new Map<string, number>();
  for (const ch of normalize(word)) m.set(ch, (m.get(ch) ?? 0) + 1);
  return m;
}

/**
 * Assign rack tiles to a target letter multiset, choosing the assignment that is
 * deterministic. Returns the chosen tiles for the combined left+right words, or
 * null if the rack cannot supply exactly those letters (multiset equality of the
 * whole rack vs left+right). Because balance depends on WHICH tile of a repeated
 * letter goes where, we assign per-word by consuming tiles letter-by-letter in a
 * stable order.
 */
export function assignTiles(rack: readonly Tile[], word: string): { tiles: Tile[]; remaining: Tile[] } | null {
  const need = letterCounts(word);
  const remaining = rack.slice();
  const tiles: Tile[] = [];
  // Consume tiles for each needed letter, lowest-weight first (deterministic).
  for (const [letter, count] of [...need.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
    const pool = remaining
      .map((t, i) => ({ t, i }))
      .filter((x) => x.t.letter === letter)
      .sort((a, b) => a.t.weight - b.t.weight || (a.t.id < b.t.id ? -1 : 1));
    if (pool.length < count) return null;
    const take = pool.slice(0, count);
    for (const { i } of take) tiles.push(remaining[i]);
    // Remove taken tiles (by id) from remaining.
    const takenIds = new Set(take.map((x) => x.t.id));
    for (let i = remaining.length - 1; i >= 0; i--) if (takenIds.has(remaining[i].id)) remaining.splice(i, 1);
  }
  return { tiles, remaining };
}

function sumWeight(tiles: readonly Tile[]): number {
  return tiles.reduce((n, t) => n + t.weight, 0);
}

/** True iff the rack letters exactly equal left+right letters (multiset). */
export function rackUsedExactly(rack: readonly Tile[], left: string, right: string): boolean {
  const rackCounts = new Map<string, number>();
  for (const t of rack) rackCounts.set(t.letter, (rackCounts.get(t.letter) ?? 0) + 1);
  const wordCounts = letterCounts(normalize(left) + normalize(right));
  if (rackCounts.size !== wordCounts.size) return false;
  for (const [k, v] of rackCounts) if (wordCounts.get(k) !== v) return false;
  return true;
}

/**
 * REQ-005..014 — evaluate a proposed split. Pure. The dictionary is injected.
 */
export function evaluate(puzzle: Puzzle, left: string, right: string, dictionary: ReadonlySet<string>): Evaluation {
  const L = normalize(left);
  const R = normalize(right);
  const empty = L.length === 0 || R.length === 0;
  const isRackExact = !empty && rackUsedExactly(puzzle.rack, L, R);

  // Assign tiles to compute pan weights (only meaningful when the rack matches).
  let leftWeight = 0;
  let rightWeight = 0;
  if (isRackExact) {
    const la = assignTiles(puzzle.rack, L);
    if (la) {
      leftWeight = sumWeight(la.tiles);
      const ra = assignTiles(la.remaining, R);
      if (ra) rightWeight = sumWeight(ra.tiles);
    }
  }
  const imbalance = Math.abs(leftWeight - rightWeight);

  const isLeftValid = !empty && dictionary.has(L);
  const isRightValid = !empty && dictionary.has(R);
  const isBalanced = isRackExact && imbalance <= puzzle.tolerance;
  const isSolved = isLeftValid && isRightValid && isRackExact && isBalanced;

  let code: ValidationCode = "OK";
  if (empty) code = "EMPTY_WORD";
  else if (!isLeftValid) code = "NOT_IN_DICTIONARY_LEFT";
  else if (!isRightValid) code = "NOT_IN_DICTIONARY_RIGHT";
  else if (!isRackExact) code = "RACK_MISMATCH";
  else if (!isBalanced) code = "NOT_BALANCED";

  return { leftWeight, rightWeight, imbalance, isLeftValid, isRightValid, isRackExact, isBalanced, isSolved, code };
}

export function initAttempt(puzzle: Puzzle, dayId: string): AttemptState {
  return { puzzleId: puzzle.puzzleId, dayId, leftWord: "", rightWord: "", isComplete: false, imbalance: 0 };
}

export interface SubmitOutcome {
  state: AttemptState;
  accepted: boolean;
  evaluation: Evaluation;
}

/** REQ-014 — submit a split; on solve, lock it. Idempotent once complete. */
export function submit(state: AttemptState, puzzle: Puzzle, left: string, right: string, dictionary: ReadonlySet<string>): SubmitOutcome {
  const evaluation = evaluate(puzzle, left, right, dictionary);
  if (state.isComplete) return { state, accepted: false, evaluation };
  if (evaluation.isSolved) {
    return {
      state: { ...state, leftWord: normalize(left), rightWord: normalize(right), isComplete: true, imbalance: evaluation.imbalance },
      accepted: true,
      evaluation,
    };
  }
  return { state: { ...state, leftWord: normalize(left), rightWord: normalize(right), imbalance: evaluation.imbalance }, accepted: false, evaluation };
}

/** FIELD-026 / REQ-017 — imbalance band for sharing. */
export function imbalanceBand(evaluation: Evaluation | null): ImbalanceBand {
  if (!evaluation || !evaluation.isSolved) return "UNSOLVED";
  if (evaluation.imbalance === 0) return "PERFECT";
  if (evaluation.imbalance <= 2) return "NEAR";
  return "OFF";
}
