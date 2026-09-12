import type { AttemptState, Puzzle } from "./types.ts";
import { ATTEMPTS_TOTAL } from "./types.ts";

// Spoiler-safe share: per-guess heat squares (how outlier-ish each pick was),
// never the words. A cold (wrong, belongs) pick reads blue; the hot outlier green.

const CORRECT = "🟩";
const HEAT = ["🟦", "🟦", "🟨", "🟧", "🟥"]; // index by heat 0..HEAT_MAX (4)

export function heatBlock(heat: number, correct: boolean): string {
  if (correct) return CORRECT;
  const i = Math.max(0, Math.min(HEAT.length - 1, heat));
  return HEAT[i];
}

export function buildShareText(state: AttemptState, dayId: string): string {
  const used = ATTEMPTS_TOTAL - state.attemptsRemaining + (state.status === "won" ? 1 : 0);
  const head =
    state.status === "won" ? `${used}/${ATTEMPTS_TOTAL}` : state.status === "lost" ? `X/${ATTEMPTS_TOTAL}` : "…";
  const rows = state.guesses.map((g) => heatBlock(g.heat, g.correct)).join("");
  return `Odd-One Gradient ${dayId} ${head}\n${rows}`;
}

export function isSpoilerSafe(shareText: string, puzzle: Puzzle): boolean {
  const upper = shareText.toUpperCase();
  for (const w of puzzle.words) if (upper.includes(w.toUpperCase())) return false;
  if (puzzle.themeLabel && upper.includes(puzzle.themeLabel.toUpperCase())) return false;
  return true;
}
