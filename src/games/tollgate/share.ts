import type { AttemptState, Puzzle } from "./types.ts";

// REQ-024 — spoiler-safe share (TERM-018). Cost vs par; never any words.

/**
 * Build shareable text:
 *   Tollgate <dayId>
 *   <medal> <totalCost> (par <par>)
 * where medal reflects performance vs par. No words are ever included.
 */
export function buildShareText(state: AttemptState, puzzle: Puzzle, dayId: string): string {
  const header = `Tollgate ${dayId}`;
  if (!state.isSolved) return `${header}\n⬛ unsolved`;
  const delta = state.totalCost - puzzle.par;
  const medal = delta <= 0 ? "🏆 par" : delta <= 2 ? "🥈 +" + delta : "🥉 +" + delta;
  return `${header}\n${medal} · cost ${state.totalCost} (par ${puzzle.par})`;
}

/** REQ-024 spoiler check: must not contain the start, target, or any path word. */
export function isSpoilerSafe(shareText: string, words: string[]): boolean {
  const up = shareText.toUpperCase();
  return !words.some((w) => w && w.length >= 3 && up.includes(w.toUpperCase()));
}
