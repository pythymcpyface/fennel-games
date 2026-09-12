import type { AttemptState, Puzzle } from "./types.ts";
import { ATTEMPTS_TOTAL, SIDE_TOTAL } from "./types.ts";

// Spoiler-safe share: per-attempt correct-count as a filled bar, no words or
// labels. Reads like Connections' guess history without revealing the split.

const FILLED = "🟩";
const EMPTY = "⬜";

export function countBar(correct: number): string {
  const c = Math.max(0, Math.min(SIDE_TOTAL, correct));
  return FILLED.repeat(c) + EMPTY.repeat(SIDE_TOTAL - c);
}

export function buildShareText(state: AttemptState, dayId: string): string {
  const used = ATTEMPTS_TOTAL - state.attemptsRemaining + (state.status === "won" ? 1 : 0);
  const head =
    state.status === "won" ? `${used}/${ATTEMPTS_TOTAL}` : state.status === "lost" ? `X/${ATTEMPTS_TOTAL}` : "…";
  const rows = state.attempts.map((a) => countBar(a.correctCount)).join("\n");
  return `Twin Trails ${dayId} ${head}\n${rows}`;
}

export function isSpoilerSafe(shareText: string, puzzle: Puzzle): boolean {
  const upper = shareText.toUpperCase();
  for (const w of puzzle.words) if (upper.includes(w.toUpperCase())) return false;
  for (const l of [puzzle.labelA, puzzle.labelB]) if (l && upper.includes(l.toUpperCase())) return false;
  return true;
}
