import type { AttemptState, Puzzle } from "./types.ts";

// REQ-016 — spoiler-safe share (TERM-034). Chain length + attempts per slot as
// blocks; never the words or clues.

const LINK = "🟩"; // solved slot
const MISS = "⬛"; // slot not reached

/**
 * Build shareable text:
 *   Rhyme Chain <dayId> <chainLength>/<slotCount>
 *   🟩🟩🟩⬛⬛  (one block per slot; green = solved)
 */
export function buildShareText(state: AttemptState, puzzle: Puzzle, dayId: string): string {
  const total = puzzle.slots.length;
  const solved = state.chainWords.length;
  const header = `Rhyme Chain ${dayId} ${solved}/${total}`;
  const blocks = Array.from({ length: total }, (_, i) => (i < solved ? LINK : MISS)).join("");
  return `${header}\n${blocks}`;
}

/** REQ-016 — must not contain any clue or answer text. */
export function isSpoilerSafe(shareText: string, puzzle: Puzzle): boolean {
  const upper = shareText.toUpperCase();
  for (const slot of puzzle.slots) {
    if (slot.answer && upper.includes(slot.answer.toUpperCase())) return false;
    if (slot.clue && upper.includes(slot.clue.toUpperCase())) return false;
  }
  return true;
}
