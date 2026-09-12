import type { AttemptState, Puzzle } from "./types.ts";
import { ATTEMPTS_TOTAL, CLUSTER_SIZE } from "./types.ts";

// Spoiler-safe share: per-attempt density signature (internal edges achieved out
// of the max), no words revealed. Max internal edges for CLUSTER_SIZE=4 is 6.

const MAX_POSSIBLE_EDGES = (CLUSTER_SIZE * (CLUSTER_SIZE - 1)) / 2; // 6 for k=4
const SOLVED = "🟩";
const BLOCKS = ["⬛", "🟥", "🟧", "🟨", "🟨", "🟩", "🟩"]; // index by edges 0..6

export function edgeBlock(edges: number, correct: boolean): string {
  if (correct) return SOLVED;
  const i = Math.max(0, Math.min(MAX_POSSIBLE_EDGES, edges));
  return BLOCKS[i] ?? BLOCKS[0];
}

export function buildShareText(state: AttemptState, dayId: string): string {
  const used = ATTEMPTS_TOTAL - state.attemptsRemaining + (state.status === "won" ? 1 : 0);
  const head =
    state.status === "won" ? `${used}/${ATTEMPTS_TOTAL}` : state.status === "lost" ? `X/${ATTEMPTS_TOTAL}` : "…";
  const rows = state.attempts.map((a) => edgeBlock(a.edges, a.correct)).join("");
  return `Edit Clusters ${dayId} ${head}\n${rows}`;
}

export function isSpoilerSafe(shareText: string, puzzle: Puzzle): boolean {
  const upper = shareText.toUpperCase();
  for (const w of puzzle.board) if (upper.includes(w.toUpperCase())) return false;
  return true;
}
