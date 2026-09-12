import type { AttemptState, Puzzle } from "./types.ts";

const FILLED = "🟩";
const EMPTY = "⬛";

export function buildShareText(state: AttemptState, puzzle: Puzzle, dayId: string): string {
  const moves = state.status === "won" ? `${state.movesUsed}/${puzzle.moveBudget}` : `X/${puzzle.moveBudget}`;
  const bar = FILLED.repeat(state.movesUsed) + EMPTY.repeat(Math.max(0, puzzle.moveBudget - state.movesUsed));
  return `Antonym Bridge ${dayId} ${moves}\n${bar}`;
}

export function isSpoilerSafe(shareText: string, path: string[], targetWord: string): boolean {
  const upper = shareText.toUpperCase();
  if (targetWord && upper.includes(targetWord.toUpperCase())) return false;
  return !path.some((w) => w && upper.includes(w.toUpperCase()));
}
