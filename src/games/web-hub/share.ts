import type { AttemptState, Puzzle } from "./types.ts";
import { ATTEMPTS_TOTAL } from "./types.ts";

// Spoiler-safe share: per-guess degree signature (how connected each pick was),
// never the words. The hub (win) is green; weaker picks read cooler.

const CORRECT = "🟩";
const HEAT = ["🟦", "🟦", "🟨", "🟧", "🟥"]; // low degree (blue) .. high (red), index clamped

export function degreeBlock(degree: number, correct: boolean, maxDegree: number): string {
  if (correct) return CORRECT;
  const span = Math.max(1, maxDegree);
  const i = Math.min(HEAT.length - 1, Math.round((degree / span) * (HEAT.length - 1)));
  return HEAT[Math.max(0, i)];
}

export function buildShareText(state: AttemptState, dayId: string, maxDegree: number): string {
  const used = ATTEMPTS_TOTAL - state.attemptsRemaining + (state.status === "won" ? 1 : 0);
  const head =
    state.status === "won" ? `${used}/${ATTEMPTS_TOTAL}` : state.status === "lost" ? `X/${ATTEMPTS_TOTAL}` : "…";
  const rows = state.guesses.map((g) => degreeBlock(g.degree, g.correct, maxDegree)).join("");
  return `Web Hub ${dayId} ${head}\n${rows}`;
}

export function isSpoilerSafe(shareText: string, puzzle: Puzzle): boolean {
  const upper = shareText.toUpperCase();
  for (const w of puzzle.board) if (upper.includes(w.toUpperCase())) return false;
  return true;
}
