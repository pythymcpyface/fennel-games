import type { AttemptState, Puzzle } from "./types.ts";
import { ATTEMPTS_TOTAL, WORDS_COUNT } from "./types.ts";

// REQ-021/022 — spoiler-safe share: solved markers + attempts, no words or theme.
const SOLVED = "🟩";
const UNSOLVED = "⬛";

export function buildShareText(state: AttemptState, dayId: string): string {
  const solvedCount = state.solved.filter(Boolean).length;
  const status = state.status === "won" ? `${state.attemptsUsed} used` : state.status === "lost" ? "X" : `${solvedCount}/${WORDS_COUNT}`;
  const header = `Vowel Ghost ${dayId} ${status}`;
  const grid = state.solved.map((s) => (s ? SOLVED : UNSOLVED)).join("");
  const attempts = `${state.attemptsUsed}/${ATTEMPTS_TOTAL} attempts`;
  return `${header}\n${grid}\n${attempts}`;
}

/** REQ-021/022 — must not contain any word or the theme label. */
export function isSpoilerSafe(shareText: string, puzzle: Puzzle, status: AttemptState["status"]): boolean {
  const upper = shareText.toUpperCase();
  for (const w of puzzle.words) if (upper.includes(w.toUpperCase())) return false;
  // Theme label may only appear after a win; here we never include it, so always reject leaks.
  if (status !== "won" && puzzle.themeLabel && upper.includes(puzzle.themeLabel.toUpperCase())) return false;
  return true;
}
