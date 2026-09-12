import type { AttemptFeedback, AttemptState, Puzzle } from "./types.ts";

// Pure Seam engine. No storage, no clock. Adjacency validity is defined by the
// puzzle's solution consecutive pairs (undirected), so all logic is deterministic.

/** Build the set of valid undirected links from the solution ordering. */
export function solutionLinks(puzzle: Puzzle): Set<string> {
  const links = new Set<string>();
  for (let i = 0; i < puzzle.solution.length - 1; i++) {
    const a = puzzle.solution[i];
    const b = puzzle.solution[i + 1];
    links.add(linkKey(a, b));
  }
  return links;
}

/** Undirected link key (order-independent) over word indices. */
export function linkKey(a: number, b: number): string {
  return a < b ? `${a}-${b}` : `${b}-${a}`;
}

/** REQ-009 — count valid adjacent links in an ordering. */
export function countCorrectLinks(order: number[], links: ReadonlySet<string>): number {
  let n = 0;
  for (let i = 0; i < order.length - 1; i++) {
    if (links.has(linkKey(order[i], order[i + 1]))) n++;
  }
  return n;
}

/** REQ-005/006 — is `order` a valid permutation of 0..N-1? */
export function isPermutation(order: number[], n: number): boolean {
  if (order.length !== n) return false;
  const seen = new Set(order);
  if (seen.size !== n) return false;
  for (let i = 0; i < n; i++) if (!seen.has(i)) return false;
  return true;
}

/** Fresh attempt: start from the puzzle's scrambled display order (identity). */
export function initAttempt(puzzle: Puzzle, dayId: string): AttemptState {
  return {
    puzzleId: puzzle.puzzleId,
    dayId,
    order: puzzle.words.map((_, i) => i),
    attempts: 0,
    isSolved: false,
    history: [],
  };
}

/** REQ-006 — swap two positions in the order (keyboard/tap-to-swap). */
export function swap(state: AttemptState, i: number, j: number): AttemptState {
  if (state.isSolved) return state;
  const n = state.order.length;
  if (i < 0 || j < 0 || i >= n || j >= n || i === j) return state;
  const order = [...state.order];
  [order[i], order[j]] = [order[j], order[i]];
  return { ...state, order };
}

/** REQ-007 — move the item at `from` to index `to` (keyboard reorder). */
export function move(state: AttemptState, from: number, to: number): AttemptState {
  if (state.isSolved) return state;
  const n = state.order.length;
  if (from < 0 || to < 0 || from >= n || to >= n || from === to) return state;
  const order = [...state.order];
  const [item] = order.splice(from, 1);
  order.splice(to, 0, item);
  return { ...state, order };
}

/** REQ-009..012 — evaluate the current order; consumes an attempt; may solve. */
export function submit(state: AttemptState, puzzle: Puzzle): { state: AttemptState; feedback: AttemptFeedback } {
  const links = solutionLinks(puzzle);
  const total = puzzle.words.length - 1;
  const correct = countCorrectLinks(state.order, links);
  const solved = correct === total;
  const next: AttemptState = {
    ...state,
    attempts: state.attempts + 1,
    isSolved: solved,
    history: [...state.history, correct],
  };
  return { state: next, feedback: { correctLinks: correct, totalLinks: total, solved } };
}

export function canSubmit(state: AttemptState): boolean {
  return !state.isSolved;
}
