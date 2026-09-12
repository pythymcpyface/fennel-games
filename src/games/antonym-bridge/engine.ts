import type { AttemptState, ErrorCode, MoveResult, Puzzle } from "./types.ts";

// Pure Antonym Bridge engine. No storage, no clock. Deterministic.

export function normalizeWord(raw: string): string {
  return raw.normalize("NFC").trim().toUpperCase().replace(/[^A-Z]/g, "");
}

export function initAttempt(puzzle: Puzzle, dayId: string): AttemptState {
  return { puzzleId: puzzle.puzzleId, dayId, currentWord: puzzle.startWord, movesUsed: 0, path: [puzzle.startWord], status: "in_progress" };
}

/** Are a and b antonyms (edge in the graph, either direction)? */
export function areAntonyms(a: string, b: string, antonyms: Record<string, string[]>): boolean {
  return (antonyms[a]?.includes(b) ?? false) || (antonyms[b]?.includes(a) ?? false);
}

function isKnownWord(word: string, puzzle: Puzzle): boolean {
  return word === puzzle.startWord || word === puzzle.targetWord || puzzle.antonyms[word] !== undefined;
}

export function submitMove(state: AttemptState, puzzle: Puzzle, rawInput: string): MoveResult {
  if (state.status !== "in_progress") return fail(state, "ALREADY_ENDED");
  if (state.movesUsed >= puzzle.moveBudget) return fail(state, "OUT_OF_MOVES");
  const word = normalizeWord(rawInput);
  if (!isKnownWord(word, puzzle)) return fail(state, "NOT_A_WORD");
  if (!areAntonyms(state.currentWord, word, puzzle.antonyms)) return fail(state, "NOT_AN_ANTONYM");

  const movesUsed = state.movesUsed + 1;
  const path = [...state.path, word];
  let status: AttemptState["status"] = "in_progress";
  if (word === puzzle.targetWord) status = "won";
  else if (movesUsed >= puzzle.moveBudget) status = "lost";
  return { ok: true, state: { ...state, currentWord: word, movesUsed, path, status } };
}

export function canMove(state: AttemptState): boolean {
  return state.status === "in_progress";
}

/** Hint: an antonym of the current word on a shortest path to the target. */
export function findHint(state: AttemptState, puzzle: Puzzle): string | null {
  if (state.status !== "in_progress") return null;
  const dist = bfsDistances(puzzle.targetWord, puzzle.antonyms);
  const cur = state.currentWord;
  const curD = dist.get(cur);
  if (curD === undefined) return null;
  const candidates = (puzzle.antonyms[cur] ?? []).filter((n) => (dist.get(n) ?? Infinity) < curD).sort();
  return candidates.length > 0 ? candidates[0] : null;
}

export function bfsDistances(from: string, antonyms: Record<string, string[]>): Map<string, number> {
  // Treat the graph as undirected for reachability.
  const adj: Record<string, Set<string>> = {};
  const add = (a: string, b: string) => { (adj[a] ??= new Set()).add(b); };
  for (const [w, ns] of Object.entries(antonyms)) for (const n of ns) { add(w, n); add(n, w); }
  const dist = new Map<string, number>([[from, 0]]);
  let frontier = [from];
  let d = 0;
  while (frontier.length) {
    const next: string[] = [];
    for (const w of frontier) for (const n of adj[w] ?? []) if (!dist.has(n)) { dist.set(n, d + 1); next.push(n); }
    frontier = next;
    d++;
  }
  return dist;
}

function fail(state: AttemptState, error: ErrorCode): MoveResult {
  return { ok: false, error, state };
}
