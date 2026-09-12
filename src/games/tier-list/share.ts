import type { AttemptState, Puzzle } from "./types.ts";
import { ATTEMPTS_TOTAL, RANK_SIZE } from "./types.ts";

// Spoiler-safe share: per-attempt correct-position count as a filled bar, no words.

const FILLED = "🟦";
const EMPTY = "⬜";

export function positionBar(correct: number): string {
  const c = Math.max(0, Math.min(RANK_SIZE, correct));
  return FILLED.repeat(c) + EMPTY.repeat(RANK_SIZE - c);
}

export function buildShareText(state: AttemptState, dayId: string): string {
  const used = ATTEMPTS_TOTAL - state.attemptsRemaining + (state.status === "won" ? 1 : 0);
  const head =
    state.status === "won" ? `${used}/${ATTEMPTS_TOTAL}` : state.status === "lost" ? `X/${ATTEMPTS_TOTAL}` : "…";
  const rows = state.attempts.map((a) => positionBar(a.correctPositions)).join("\n");
  return `Tier List ${dayId} ${head}\n${rows}`;
}

export function isSpoilerSafe(shareText: string, puzzle: Puzzle): boolean {
  const upper = shareText.toUpperCase();
  for (const w of puzzle.words) if (upper.includes(w.toUpperCase())) return false;
  return true;
}
