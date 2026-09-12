import type { AttemptState, Puzzle } from "./types.ts";
import { totalSteps } from "./engine.ts";

// REQ-017 — spoiler-safe share (TERM-016). Steps vs par; never any words.

/**
 * Build shareable text:
 *   Fork <dayId>
 *   <medal> <steps> steps (par <par>)   OR   unsolved
 */
export function buildShareText(state: AttemptState, puzzle: Puzzle, dayId: string): string {
  const header = `Fork ${dayId}`;
  if (!state.isComplete) return `${header}\n⬛ unsolved`;
  const steps = totalSteps(state);
  const delta = steps - puzzle.par;
  const medal = delta <= 0 ? "🏆 par" : delta <= 2 ? "🥈 +" + delta : "🥉 +" + delta;
  return `${header}\n${medal} · ${steps} steps (par ${puzzle.par})`;
}

/** REQ-017 spoiler check: must contain none of the words. */
export function isSpoilerSafe(shareText: string, words: string[]): boolean {
  const up = shareText.toUpperCase();
  return !words.some((w) => w && w.length >= 3 && up.includes(w.toUpperCase()));
}
