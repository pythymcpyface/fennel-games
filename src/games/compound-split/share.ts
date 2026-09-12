import type { AttemptState, Puzzle } from "./types.ts";
import { ATTEMPT_LIMIT, COMPOUND_COUNT } from "./types.ts";

const FOUND = "🟩";
const MISS = "⬛";

export function buildShareText(state: AttemptState, dayId: string): string {
  const score = state.status === "won" ? String(state.attemptsUsed) : "X";
  const header = `Compound Split ${dayId} ${score}/${ATTEMPT_LIMIT}`;
  const found = state.lockedPairs.length;
  const grid = FOUND.repeat(found) + MISS.repeat(COMPOUND_COUNT - found);
  return `${header}\n${grid}`;
}

export function isSpoilerSafe(shareText: string, puzzle: Puzzle): boolean {
  const upper = shareText.toUpperCase();
  for (const c of puzzle.compounds) if (upper.includes(c.toUpperCase())) return false;
  for (const h of puzzle.halves) if (h.length >= 3 && upper.includes(h.toUpperCase())) return false;
  return true;
}
