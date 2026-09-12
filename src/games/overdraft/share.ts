import type { AttemptState } from "./types.ts";

// REQ-022 — spoiler-safe share (TERM-013). Net-score band + borrow blocks; no word.

/** FIELD-020 — map net score to a band S0..S5. */
export function scoreBand(net: number): string {
  if (net <= 0) return "S0";
  if (net < 6) return "S1";
  if (net < 11) return "S2";
  if (net < 16) return "S3";
  if (net < 22) return "S4";
  return "S5";
}

const BAND_GLYPH: Record<string, string> = { S0: "⬛", S1: "🟫", S2: "🟨", S3: "🟩", S4: "🟦", S5: "🟪" };

/**
 * Build shareable text:
 *   Overdraft <dayId> <band>
 *   <band glyph> · borrow <n>/2 (🪙 per borrowed letter)
 * Never includes the submitted word.
 */
export function buildShareText(state: AttemptState, dayId: string): string {
  const band = scoreBand(state.netScore);
  const header = `Overdraft ${dayId} ${band}`;
  const coins = "🪙".repeat(state.borrowedCount) || "—";
  return `${header}\n${BAND_GLYPH[band]} borrow ${state.borrowedCount}/2 ${coins}`;
}

/** REQ-022/NFR-006 spoiler check: must not contain the finalized word. */
export function isSpoilerSafe(shareText: string, word: string): boolean {
  return !word || !shareText.toUpperCase().includes(word.toUpperCase());
}
