import type { AttemptState } from "./types.ts";

// REQ-013 — spoiler-safe share (TERM-017). Encodes only correct-link count per
// attempt as a block bar; never includes the words.

function bar(correct: number, total: number): string {
  const filled = "🟩".repeat(correct);
  const empty = "⬛".repeat(Math.max(0, total - correct));
  return filled + empty;
}

/**
 * Build shareable text:
 *   Seam <dayId> <attempts> tries
 *   <one bar per attempt: correct links out of total>
 */
export function buildShareText(state: AttemptState, dayId: string, totalLinks: number): string {
  const status = state.isSolved ? `${state.attempts} tries` : "X";
  const header = `Seam ${dayId} ${status}`;
  const rows = state.history.map((c) => bar(c, totalLinks)).join("\n");
  return `${header}\n${rows}`;
}

/** REQ-013/NFR-003 spoiler check: must not contain any puzzle word. */
export function isSpoilerSafe(shareText: string, words: string[]): boolean {
  const up = shareText.toUpperCase();
  return !words.some((w) => w && up.includes(w.toUpperCase()));
}
