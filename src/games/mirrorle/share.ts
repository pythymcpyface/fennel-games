import type { AttemptState } from "./types.ts";
import { MAX_GREEN } from "./types.ts";

// REQ-018/019 — spoiler-safe share (TERM-016). Encodes only the aggregated green
// count per row as a coarse block; never prints guesses or the secret words.

// Green count 0..10 mapped to a 3-tier block so the trajectory is legible but the
// exact letters are never leaked.
function blockFor(green: number): string {
  if (green >= MAX_GREEN) return "⭐"; // a fully-solving row
  if (green >= 6) return "🟩";
  if (green >= 3) return "🟨";
  return "⬛";
}

/**
 * Build shareable text:
 *   Mirrorle <dayId> <guesses>/9
 *   <one block per guess row>
 * Rows encode only the summed-green tier (spoiler-safe): no words, no per-secret split.
 */
export function buildShareText(state: AttemptState, dayId: string): string {
  const score = state.isSolved ? String(state.rows.length) : "X";
  const header = `Mirrorle ${dayId} ${score}/9`;
  const rows = state.rows.map((r) => blockFor(r.green)).join("");
  return `${header}\n${rows}`;
}

/** REQ-018 spoiler check: must not contain any guessed word or the secrets. */
export function isSpoilerSafe(shareText: string, secrets: string[], guesses: string[]): boolean {
  const up = shareText.toUpperCase();
  return ![...secrets, ...guesses].some((w) => w && up.includes(w.toUpperCase()));
}
