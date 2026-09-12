import type { GameState } from "./types.ts";

// REQ-015/016 — spoiler-safe share artifact (TERM-024). Encodes only coarse
// warm/cold blocks per guess plus a terminal star on win. Never includes the
// target or start word or raw ranks (RISK-009).

const WARM = "🟥"; // improved (warmer / best)
const COLD = "🟦"; // did not improve (colder)
const WIN = "⭐";

/** Map a verdict to a spoiler-safe block glyph. */
function verdictBlock(verdict: string): string {
  return verdict === "warmer" || verdict === "best" ? WARM : COLD;
}

/**
 * Build the shareable text. Format:
 *   Ladderless <dayId> <guesses>/par<par>
 *   <blocks...>[⭐]
 */
export function buildShareText(state: GameState, par: number, dayId: string): string {
  const blocks = state.guessHistory.map((g) => verdictBlock(g.verdict)).join("");
  const won = state.status === "won";
  const count = state.guessHistory.length;
  const header = `Ladderless ${dayId} ${won ? count : "X"}/par${par}`;
  const body = won ? `${blocks}${WIN}` : blocks;
  return `${header}\n${body}`;
}

/**
 * REQ-016 — verify the share text leaks neither the target nor the start word.
 * Case-insensitive substring check on alphabetic content.
 */
export function isSpoilerSafe(shareText: string, targetWord: string, startWord: string): boolean {
  const lower = shareText.toLowerCase();
  if (targetWord && lower.includes(targetWord.toLowerCase())) return false;
  if (startWord && lower.includes(startWord.toLowerCase())) return false;
  return true;
}
