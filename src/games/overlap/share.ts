import type { AttemptState, RevealRow } from "./types.ts";

// REQ-019 — spoiler-safe share artifact (TERM-019). Emoji reveal grid only; never
// prints the bridge word or the guesses.

const GLYPH: Record<string, string> = { EXACT: "🟩", PRESENT: "🟨", ABSENT: "⬛" };

function rowToEmoji(row: RevealRow): string {
  return row.map((s) => GLYPH[s]).join("");
}

/**
 * Build shareable text:
 *   Overlap <dayId> <guesses>/6[*hints]
 *   <emoji rows...>
 */
export function buildShareText(state: AttemptState, dayId: string): string {
  const scoreCell = state.isSolved ? String(state.guesses.length) : "X";
  const hintSuffix = state.hintCountUsed > 0 ? ` (${state.hintCountUsed} hints)` : "";
  const header = `Overlap ${dayId} ${scoreCell}/6${hintSuffix}`;
  const grid = state.revealGrid.map(rowToEmoji).join("\n");
  return `${header}\n${grid}`;
}

/** REQ-019 spoiler check: share text must not contain the bridge word. */
export function isSpoilerSafe(shareText: string, bridgeWord: string): boolean {
  return !shareText.toUpperCase().includes(bridgeWord.toUpperCase());
}
