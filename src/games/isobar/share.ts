import type { AttemptState } from "./types.ts";
import { WORD_COUNT } from "./types.ts";

// REQ-020 — spoiler-safe share (TERM-012). Per-attempt correct-count blocks; no words.

function bar(correct: number): string {
  return "🟩".repeat(correct) + "⬛".repeat(Math.max(0, WORD_COUNT - correct));
}

/**
 * Build shareable text:
 *   Isobar <dayId> <attempts> tries
 *   <one bar per attempt: correct out of 5>
 */
export function buildShareText(state: AttemptState, dayId: string): string {
  const status = state.isSolved ? `${state.attempts} tries` : "X";
  const header = `Isobar ${dayId} ${status}`;
  const rows = state.history.map(bar).join("\n");
  return `${header}\n${rows}`;
}

/** REQ-020/REQ-022 spoiler check: must not contain any word (or the center). */
export function isSpoilerSafe(shareText: string, words: string[]): boolean {
  const up = shareText.toUpperCase();
  return !words.some((w) => w && up.includes(w.toUpperCase()));
}
