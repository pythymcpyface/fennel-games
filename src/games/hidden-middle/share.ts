import type { AttemptState, Puzzle } from "./types.ts";
import { MAX_INCORRECT_ATTEMPTS } from "./types.ts";

// REQ-017 — spoiler-safe share (TERM-022). Blocks per incorrect attempt + solve
// marker; never the carrier, clue, or answer.

const MISS = "⬛";
const WIN = "🟩";
const FAIL = "🟥";

/**
 * Build shareable text:
 *   Hidden Middle <dayId> <attempts>/6
 *   ⬛⬛🟩   (one miss block per wrong guess, then 🟩 on solve / 🟥 on fail)
 */
export function buildShareText(state: AttemptState, dayId: string): string {
  const solved = state.status === "solved";
  const score = solved ? String(state.incorrectAttemptsUsed + 1) : "X";
  const header = `Hidden Middle ${dayId} ${score}/${MAX_INCORRECT_ATTEMPTS}`;
  const misses = MISS.repeat(state.incorrectAttemptsUsed);
  const end = solved ? WIN : state.status === "failed" ? FAIL : "";
  return `${header}\n${misses}${end}`;
}

/** REQ-017 — must not contain carrier, clue, or answer. */
export function isSpoilerSafe(shareText: string, puzzle: Puzzle): boolean {
  const upper = shareText.toUpperCase();
  if (puzzle.carrierWord && upper.includes(puzzle.carrierWord.toUpperCase())) return false;
  if (puzzle.answerWord && upper.includes(puzzle.answerWord.toUpperCase())) return false;
  if (puzzle.clue && upper.includes(puzzle.clue.toUpperCase())) return false;
  return true;
}
