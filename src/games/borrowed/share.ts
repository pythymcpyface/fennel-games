import type { AttemptState, Puzzle } from "./types.ts";
import { ATTEMPT_LIMIT } from "./types.ts";

const CELL = ["⬛", "🟥", "🟧", "🟨", "🟩", "⭐"];

export function buildShareText(state: AttemptState, dayId: string): string {
  const score = state.status === "solved" ? String(state.attemptsUsed) : "X";
  const rows = state.history.map((c) => CELL[Math.max(0, Math.min(5, c))]).join("");
  return `Borrowed ${dayId} ${score}/${ATTEMPT_LIMIT}\n${rows}`;
}

export function isSpoilerSafe(shareText: string, puzzle: Puzzle): boolean {
  const upper = shareText.toUpperCase();
  for (const w of puzzle.words) if (upper.includes(w.toUpperCase())) return false;
  for (const a of puzzle.answers) if (upper.includes(a.toUpperCase())) return false;
  return true;
}
