import type { AttemptState, ImbalanceBand } from "./types.ts";

// REQ-016 — spoiler-safe share (TERM-021). Balance band + word-length shape.
// FIELD-025: MUST NOT contain the words or any rack letters.

const BAND_GLYPH: Record<ImbalanceBand, string> = {
  PERFECT: "⚖️",
  NEAR: "🟰",
  OFF: "↔️",
  UNSOLVED: "❌",
};

/**
 * Build shareable text:
 *   Tare <dayId> <band>
 *   ⚖️ <leftLen>|<rightLen>
 * Reveals only the balance band and word lengths, never the words/letters.
 */
export function buildShareText(state: AttemptState, band: ImbalanceBand, dayId: string): string {
  const header = `Tare ${dayId} ${band}`;
  const leftLen = state.leftWord.length;
  const rightLen = state.rightWord.length;
  const shape = state.isComplete ? `${BAND_GLYPH[band]} ${leftLen}|${rightLen}` : `${BAND_GLYPH.UNSOLVED} —`;
  return `${header}\n${shape}`;
}

/**
 * REQ-016/EDGE-005 spoiler check: the share text must not contain the left or
 * right word (case- and whitespace-insensitive).
 */
export function isSpoilerSafe(shareText: string, state: AttemptState): boolean {
  const haystack = shareText.toUpperCase().replace(/\s+/g, "");
  for (const w of [state.leftWord, state.rightWord]) {
    const up = w.toUpperCase().replace(/\s+/g, "");
    if (up.length > 0 && haystack.includes(up)) return false;
  }
  return true;
}
