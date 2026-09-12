import type { AttemptState, ErrorCode, MoveResult, Puzzle } from "./types.ts";

// Pure Palindial engine. No storage, no clock. Deterministic.

export function normalizeWord(raw: string): string {
  return raw.normalize("NFC").trim().toUpperCase().replace(/[^A-Z]/g, "");
}

export function isOneLetterChange(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) diff++;
  return diff === 1;
}

export function reverse(w: string): string {
  return w.split("").reverse().join("");
}

export function initAttempt(puzzle: Puzzle, dayId: string): AttemptState {
  return { puzzleId: puzzle.puzzleId, dayId, currentWord: puzzle.startWord, movesUsed: 0, path: [puzzle.startWord], status: "in_progress" };
}

function isWord(word: string, puzzle: Puzzle): boolean {
  return word === puzzle.startWord || word === puzzle.targetWord || puzzle.neighbors[word] !== undefined;
}

export function submitMove(state: AttemptState, puzzle: Puzzle, rawInput: string): MoveResult {
  if (state.status !== "in_progress") return fail(state, "ALREADY_ENDED");
  if (state.movesUsed >= puzzle.moveBudget) return fail(state, "OUT_OF_MOVES");
  const word = normalizeWord(rawInput);
  if (word.length !== state.currentWord.length) return fail(state, "WRONG_LENGTH");
  if (!isOneLetterChange(word, state.currentWord)) return fail(state, "NOT_ONE_LETTER_CHANGE");
  if (!isWord(word, puzzle)) return fail(state, "NOT_IN_DICTIONARY");

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

/** Hint: a neighbor of the current word that is on a shortest path to the target. */
export function findHint(state: AttemptState, puzzle: Puzzle): string | null {
  if (state.status !== "in_progress") return null;
  // BFS distances from target; pick the neighbor with the smallest distance.
  const dist = bfsDistances(puzzle.targetWord, puzzle.neighbors);
  const cur = state.currentWord;
  const curD = dist.get(cur);
  if (curD === undefined) return null;
  const candidates = (puzzle.neighbors[cur] ?? []).filter((n) => (dist.get(n) ?? Infinity) < curD).sort();
  return candidates.length > 0 ? candidates[0] : null;
}

function bfsDistances(from: string, neighbors: Record<string, string[]>): Map<string, number> {
  const dist = new Map<string, number>([[from, 0]]);
  let frontier = [from];
  let d = 0;
  while (frontier.length) {
    const next: string[] = [];
    for (const w of frontier) for (const n of neighbors[w] ?? []) if (!dist.has(n)) { dist.set(n, d + 1); next.push(n); }
    frontier = next;
    d++;
  }
  return dist;
}

function fail(state: AttemptState, error: ErrorCode): MoveResult {
  return { ok: false, error, state };
}
