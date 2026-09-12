import type { AttemptState, Puzzle } from "./types.ts";
import { correctCount, isSelectionCorrect, totalEntries } from "./engine.ts";

// REQ-018 — spoiler-safe share (TERM-014). Per-entry correctness grid + score.
// FIELD-025/026: MUST NOT contain any answer text or clue text.

const CORRECT_GLYPH = "🟩";
const WRONG_GLYPH = "⬛";

/**
 * Build shareable text:
 *   Clueback <dayId> <correct>/<total>
 *   🟩⬛🟩🟩🟩
 * Reveals only which entries were solved, never the answers or clues.
 */
export function buildShareText(state: AttemptState, puzzle: Puzzle, dayId: string): string {
  const total = totalEntries(puzzle);
  const correct = correctCount(state, puzzle);
  const header = `Clueback ${dayId} ${correct}/${total}`;
  const grid = puzzle.entries
    .map((_e, i) => (isSelectionCorrect(state, puzzle, i) ? CORRECT_GLYPH : WRONG_GLYPH))
    .join("");
  return `${header}\n${grid}`;
}

/**
 * REQ-018/NFR-006 spoiler check: the share text must not contain any answer
 * string from the puzzle (case-insensitive, whitespace-insensitive).
 */
export function isSpoilerSafe(shareText: string, puzzle: Puzzle): boolean {
  const haystack = shareText.toUpperCase().replace(/\s+/g, "");
  return !puzzle.entries.some((e) => {
    const a = e.answer.toUpperCase().replace(/\s+/g, "");
    return a.length > 0 && haystack.includes(a);
  });
}
