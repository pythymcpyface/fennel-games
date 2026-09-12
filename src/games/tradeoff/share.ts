import type { AttemptState, Puzzle } from "./types.ts";
import { currentScore } from "./engine.ts";

// REQ-021 — spoiler-safe share: swaps used vs budget + score progress bar. No words.
const FILLED = "🟩";
const EMPTY = "⬛";
const BAR = 10;

export function buildShareText(state: AttemptState, puzzle: Puzzle, dayId: string): string {
  const score = currentScore(state, puzzle);
  const startScore = puzzle.letterValues ? sumStart(puzzle) : 0;
  const denom = Math.max(1, puzzle.parScore - startScore);
  const progress = Math.max(0, Math.min(1, (score - startScore) / denom));
  const filled = Math.round(progress * BAR);
  const bar = FILLED.repeat(filled) + EMPTY.repeat(BAR - filled);
  const swaps = state.winState === "won" ? `${state.swapsUsed}/${puzzle.swapBudget}` : `X/${puzzle.swapBudget}`;
  return `Tradeoff ${dayId} ${swaps}\n${bar}`;
}

function sumStart(puzzle: Puzzle): number {
  let s = 0;
  for (const ch of puzzle.startWord) s += puzzle.letterValues[ch] ?? 0;
  return s;
}

/** REQ-021 — must not contain any word from the move history. */
export function isSpoilerSafe(shareText: string, moveHistory: string[]): boolean {
  const upper = shareText.toUpperCase();
  return !moveHistory.some((w) => w && upper.includes(w.toUpperCase()));
}
