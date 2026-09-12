import type { AttemptState, Puzzle } from "./types.ts";
import { ATTEMPT_LIMIT } from "./types.ts";

const CELL = ["⬛", "🟥", "🟧", "🟨", "🟩", "⭐"];

export function buildShareText(state: AttemptState, dayId: string): string {
  const score = state.status === "solved" ? String(state.attemptsUsed) : "X";
  const rows = state.history.map((c) => CELL[Math.max(0, Math.min(5, c))]).join("");
  return `Loan Ledger ${dayId} ${score}/${ATTEMPT_LIMIT}\n${rows}`;
}

export function isSpoilerSafe(shareText: string, puzzle: Puzzle): boolean {
  const upper = shareText.toUpperCase();
  for (const it of puzzle.items) {
    if (upper.includes(it.word.toUpperCase())) return false;
    if (upper.includes(it.answer.toUpperCase())) return false;
  }
  return true;
}
