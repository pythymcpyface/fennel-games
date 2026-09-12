import type { AttemptState, Puzzle, RevealState } from "./types.ts";
import { MAX_GUESSES } from "./types.ts";

const GLYPH: Record<RevealState, string> = { EXACT: "🟩", PRESENT: "🟨", ABSENT: "⬛" };

export function buildShareText(state: AttemptState, puzzle: Puzzle, dayId: string): string {
  const score = state.status === "won" ? String(state.rows.length) : "X";
  // Include the emoji rebus itself — it is the puzzle, not the answer, and is fun to share.
  const header = `Emoji Etymon ${dayId} ${puzzle.emoji} ${score}/${MAX_GUESSES}`;
  const grid = state.rows.map((r) => r.map((s) => GLYPH[s]).join("")).join("\n");
  return `${header}\n${grid}`;
}

export function isSpoilerSafe(shareText: string, answer: string): boolean {
  return !shareText.toUpperCase().includes(answer.toUpperCase());
}
