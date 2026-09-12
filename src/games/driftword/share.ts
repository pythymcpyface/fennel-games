import type { AttemptState, Mark } from "./types.ts";
import { GUESS_BUDGET } from "./types.ts";

// REQ-016 — spoiler-safe share (TERM-023). Emoji block per mark; never any words.

const EMOJI: Record<Mark, string> = { G: "🟩", Y: "🟨", X: "⬛" };

/**
 * Build shareable text:
 *   Driftword <dayId> <n>/6
 *   <one emoji row per guess>
 */
export function buildShareText(state: AttemptState, dayId: string): string {
  const score = state.isSolved ? String(state.rows.length) : "X";
  const header = `Driftword ${dayId} ${score}/${GUESS_BUDGET}`;
  const rows = state.rows.map((r) => r.marks.map((m) => EMOJI[m]).join("")).join("\n");
  return `${header}\n${rows}`;
}

/** REQ-016 spoiler check: must not contain any guessed word or path target. */
export function isSpoilerSafe(shareText: string, words: string[]): boolean {
  const up = shareText.toUpperCase();
  return !words.some((w) => w && up.includes(w.toUpperCase()));
}
