import type { AttemptState } from "./types.ts";

// REQ-017/018 — spoiler-safe share (TERM-027). Encodes solved status + path length
// only; never the word or board letters.

/**
 * Build shareable text:
 *   Isthmus <dayId> <status>
 *   🌉 bridged in <n> tiles   (solved)  OR  ⬛ not yet   (unsolved)
 */
export function buildShareText(state: AttemptState, dayId: string): string {
  const header = `Isthmus ${dayId}`;
  if (state.isSolved) {
    return `${header}\n🌉 bridged (${state.bestLen} tiles, ${state.attempts} tries)`;
  }
  return `${header}\n⬛ not yet (${state.attempts} tries)`;
}

/** REQ-017 spoiler check: must not contain the solution word or any grid letters run. */
export function isSpoilerSafe(shareText: string, words: string[]): boolean {
  const up = shareText.toUpperCase();
  return !words.some((w) => w && w.length >= 3 && up.includes(w.toUpperCase()));
}
