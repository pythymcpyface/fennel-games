import type { AttemptState, Puzzle } from "./types.ts";

// REQ-018/019 — spoiler-safe share (TERM-021). Per-attempt blocks; never the words
// or theme/category labels.

const WRONG = "🟥";
const RIGHT = "🟩";

/**
 * Build shareable text:
 *   Odd Sense <dayId> <attempts>/4
 *   <🟥 per wrong><🟩 on solve>
 */
export function buildShareText(state: AttemptState, dayId: string): string {
  const solvedAttempt = state.state === "solved" ? state.guessHistory.length : "X";
  const header = `Odd Sense ${dayId} ${solvedAttempt}/4`;
  const blocks = state.guessHistory.map((g) => (g.result === "CORRECT" ? RIGHT : WRONG)).join("");
  return `${header}\n${blocks}`;
}

/** REQ-019 — must not contain any word or the theme/odd-category labels. */
export function isSpoilerSafe(shareText: string, puzzle: Puzzle): boolean {
  const upper = shareText.toUpperCase();
  for (const w of puzzle.words) if (upper.includes(w.toUpperCase())) return false;
  if (puzzle.themeLabel && upper.includes(puzzle.themeLabel.toUpperCase())) return false;
  if (puzzle.oddCategoryLabel && upper.includes(puzzle.oddCategoryLabel.toUpperCase())) return false;
  return true;
}
