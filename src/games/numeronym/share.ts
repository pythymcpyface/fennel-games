import type { AttemptState, Puzzle } from "./types.ts";
import { ATTEMPTS_TOTAL, WORDS_COUNT } from "./types.ts";

// Spoiler-safe share: solved count + attempts, no words/clues/theme.
const SOLVED = "🟩";
const UNSOLVED = "⬛";

export function buildShareText(state: AttemptState, dayId: string): string {
  const used = ATTEMPTS_TOTAL - state.attemptsRemaining;
  const solvedCount = state.solved.filter(Boolean).length;
  const status = state.status === "won" ? `${used} used` : state.status === "lost" ? "X" : `${solvedCount}/${WORDS_COUNT}`;
  const grid = state.solved.map((s) => (s ? SOLVED : UNSOLVED)).join("");
  return `Numeronym ${dayId} ${status}\n${grid}`;
}

export function isSpoilerSafe(shareText: string, puzzle: Puzzle): boolean {
  const upper = shareText.toUpperCase();
  for (const a of puzzle.answers) if (upper.includes(a.toUpperCase())) return false;
  for (const c of puzzle.clues) if (upper.includes(c.toUpperCase())) return false;
  if (puzzle.themeLabel && upper.includes(puzzle.themeLabel.toUpperCase())) return false;
  return true;
}
