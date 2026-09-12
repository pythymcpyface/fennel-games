import type { AttemptState, Puzzle } from "./types.ts";
import { ATTEMPTS_TOTAL } from "./types.ts";

const SOLVED = "🟩";
const UNSOLVED = "⬛";

export function buildShareText(state: AttemptState, dayId: string): string {
  const solvedCount = state.solved.filter(Boolean).length;
  const status = state.status === "won" ? `${state.attemptsUsed} used` : state.status === "lost" ? "X" : `${solvedCount}/${state.solved.length}`;
  const grid = state.solved.map((s) => (s ? SOLVED : UNSOLVED)).join("");
  return `Homophone Heist ${dayId} ${status}\n${grid}\n${state.attemptsUsed}/${ATTEMPTS_TOTAL} attempts`;
}

export function isSpoilerSafe(shareText: string, puzzle: Puzzle): boolean {
  const upper = shareText.toUpperCase();
  for (const a of puzzle.answers) if (a.length >= 3 && upper.includes(a.toUpperCase())) return false;
  return true;
}
