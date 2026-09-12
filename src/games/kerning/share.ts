import type { AttemptState, Puzzle } from "./types.ts";
import { ATTEMPT_LIMIT } from "./types.ts";

const OK = "🟨"; // wrong but all tokens valid words
const BAD = "⬛";
const WIN = "🟩";

export function buildShareText(state: AttemptState, dayId: string): string {
  const score = state.status === "won" ? String(state.attemptsUsed + 1) : "X";
  const header = `Kerning ${dayId} ${score}/${ATTEMPT_LIMIT}`;
  const rows: string[] = state.history.map((c) => (c > 0 ? OK : BAD));
  if (state.status === "won") rows.push(WIN);
  return `${header}\n${rows.join("")}`;
}

export function isSpoilerSafe(shareText: string, puzzle: Puzzle): boolean {
  return !shareText.toUpperCase().includes(puzzle.letterRun.toUpperCase());
}
