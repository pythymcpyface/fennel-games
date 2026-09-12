import type { AttemptState, Puzzle } from "./types.ts";
import { ATTEMPT_LIMIT } from "./types.ts";

// REQ-013/014 — spoiler-safe share: correct-position counts per attempt, no words
// or scale label.
const CELL = ["⬛", "🟥", "🟧", "🟨", "🟩", "⭐"]; // index = correct count 0..5

export function buildShareText(state: AttemptState, dayId: string): string {
  const score = state.status === "solved" ? String(state.attemptsUsed) : "X";
  const header = `Degrees ${dayId} ${score}/${ATTEMPT_LIMIT}`;
  const rows = state.history.map((c) => CELL[Math.max(0, Math.min(5, c))]).join("");
  return `${header}\n${rows}`;
}

/** REQ-013/014 — must not contain any word or the scale label. */
export function isSpoilerSafe(shareText: string, puzzle: Puzzle): boolean {
  const upper = shareText.toUpperCase();
  for (const w of puzzle.words) if (upper.includes(w.toUpperCase())) return false;
  if (puzzle.scaleLabel && upper.includes(puzzle.scaleLabel.toUpperCase())) return false;
  return true;
}
