import type { AttemptState, Attempt, ErrorCode, Puzzle, SubmissionResult } from "./types.ts";
import { ATTEMPTS_TOTAL, CLUSTER_SIZE } from "./types.ts";

// Pure Edit Clusters engine. No storage, no clock. Deterministic.

export function normalize(raw: string): string {
  return raw.normalize("NFC").trim().toLowerCase().replace(/[^a-z]/g, "");
}

/** Count internal edit-distance-1 edges among `selection` using board adjacency. */
export function internalEdges(selection: readonly string[], adjacency: Record<string, string[]>): number {
  const set = new Set(selection);
  let edges = 0;
  const sorted = [...selection].sort();
  for (let i = 0; i < sorted.length; i++) {
    const ns = adjacency[sorted[i]] ?? [];
    for (const n of ns) {
      // count each undirected edge once: only when neighbour sorts after this word
      if (set.has(n) && n > sorted[i]) edges += 1;
    }
  }
  return edges;
}

export function initAttempt(puzzle: Puzzle, dayId: string): AttemptState {
  return {
    puzzleId: puzzle.puzzleId,
    dayId,
    attempts: [],
    attemptsRemaining: ATTEMPTS_TOTAL,
    status: "in_progress",
  };
}

export function canSubmit(state: AttemptState): boolean {
  return state.status === "in_progress" && state.attemptsRemaining > 0;
}

/** Submit a selection of words (any order). */
export function submit(state: AttemptState, puzzle: Puzzle, rawSelection: readonly string[]): SubmissionResult {
  if (state.status !== "in_progress" || state.attemptsRemaining <= 0) {
    return { state, correct: false, error: "no_attempts_remaining" };
  }
  const words = rawSelection.map(normalize).filter((w) => w.length > 0);
  if (words.length !== CLUSTER_SIZE) return { state, correct: false, error: "wrong_size" };
  if (new Set(words).size !== words.length) return { state, correct: false, error: "duplicate_word" };
  const boardSet = new Set(puzzle.board);
  for (const w of words) if (!boardSet.has(w)) return { state, correct: false, error: "unknown_word" };

  const sorted = [...words].sort();
  const key = sorted.join(",");
  if (state.attempts.some((a) => a.words.join(",") === key)) {
    return { state, correct: false, error: "already_tried" };
  }

  const edges = internalEdges(sorted, puzzle.adjacency);
  const correct = key === [...puzzle.cluster].sort().join(",");
  const attempt: Attempt = { words: sorted, edges, correct };
  const attempts = [...state.attempts, attempt];
  if (correct) {
    return { state: { ...state, attempts, status: "won" }, correct: true, error: null, attempt };
  }
  const attemptsRemaining = state.attemptsRemaining - 1;
  const lost = attemptsRemaining <= 0;
  const err: ErrorCode = null;
  return {
    state: { ...state, attempts, attemptsRemaining, status: lost ? "lost" : "in_progress" },
    correct: false,
    error: err,
    attempt,
  };
}
