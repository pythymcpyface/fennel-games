import type { AttemptState } from "./types.ts";

// REQ-018 — spoiler-safe share (TERM-023). Per-attempt rows using coarse blocks;
// never prints the phrase or puzzle string.

const SOLVE = "🟩";
const OK_WORDS = "🟨"; // incorrect but all tokens were valid words
const BAD = "⬛"; // incorrect and some tokens not words

/**
 * Build shareable text:
 *   Sever <dayId> <attempts>/6
 *   <row per attempt>[🟩 on solve]
 * Rows encode only "all-words-valid?" not positions (spoiler-safe).
 */
export function buildShareText(state: AttemptState, dayId: string): string {
  const score = state.isSolved ? String(state.attemptsUsed + 1) : "X";
  const header = `Sever ${dayId} ${score}/6`;
  const rows: string[] = state.history.map((f) => (f.allTokensAreDictionaryWords ? OK_WORDS : BAD));
  if (state.isSolved) rows.push(SOLVE);
  return `${header}\n${rows.join("")}`;
}

/** REQ-018 spoiler check: must not contain the phrase or puzzle string. */
export function isSpoilerSafe(shareText: string, puzzleString: string): boolean {
  return !shareText.toUpperCase().includes(puzzleString.toUpperCase());
}
