// Spoiler-safe share text for Affix Loom. Ported from the standalone app's
// core/share.ts. Emits an emoji grid of attempt outcomes, never the solution
// word. isSpoilerSafe compares exact whitespace-delimited normalized tokens
// against the puzzle's targets so no target surface can leak.

import type { AttemptState, Puzzle } from "./types.ts";
import { normalizeToken, MAX_ATTEMPTS } from "./engine.ts";

export function buildShareText(state: AttemptState, dayId: string): string {
  const result = state.isSolved ? `${state.attemptsUsed}/${MAX_ATTEMPTS}` : `X/${MAX_ATTEMPTS}`;
  const grid = Array.from({ length: MAX_ATTEMPTS }, (_, i) => {
    if (i < state.attemptsUsed - (state.isSolved ? 1 : 0)) return "🟨";
    if (i === state.attemptsUsed - 1 && state.isSolved) return "🟩";
    return "⬛";
  }).join("");
  return `Affix Loom ${dayId} ${result}\n${grid}`;
}

/** True when the payload contains no exact target token (anti-spoiler guard). */
export function isSpoilerSafe(payload: string, puzzle: Puzzle): boolean {
  const tokens = payload.split(/\s+/u).map(normalizeToken);
  const targets = new Set(puzzle.targets.map(normalizeToken));
  return !tokens.some((t) => t.length > 0 && targets.has(t));
}
