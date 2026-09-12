import type { AttemptState, Puzzle } from "./types.ts";

// Spoiler-safe share: solved + submit count + score. The words ARE the fun to share,
// but to stay spoiler-safe pre-spread we share only the score/acronym length pattern.
export function buildShareText(state: AttemptState, puzzle: Puzzle, dayId: string, score: number): string {
  const status = state.status === "won" ? `solved (score ${score})` : "in progress";
  const blocks = "🟦".repeat(puzzle.acronym.length);
  return `Acronym Attack ${dayId} ${status}\n${blocks}`;
}

/** Must not contain the player's words (they may be creative/personal). */
export function isSpoilerSafe(shareText: string, words: string[]): boolean {
  const upper = shareText.toUpperCase();
  return !words.some((w) => w && upper.includes(w.toUpperCase()));
}
