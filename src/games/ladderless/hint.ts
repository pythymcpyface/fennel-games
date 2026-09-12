import type { GameState, RankTable } from "./types.ts";

// REQ-013/014 — deterministic "next warmer word" hint (JOURNEY-003, TERM-025).
// Returns the unguessed word that is the SMALLEST improvement over the current
// bestRank — i.e. the highest rank that is still strictly below bestRank — so the
// hint nudges the player one step warmer rather than handing them the target. The
// target is only revealed when it is the sole improving word. Ties broken
// lexicographically for cross-platform determinism (RISK-004). Words already
// guessed OR already suggested by a prior hint are excluded, so repeated Hint
// clicks yield progressively warmer, distinct suggestions. Null when no hint
// applies (already at rank 1, or every improving word is already used).
export function selectHint(state: GameState, table: RankTable): string | null {
  if (state.bestRank <= 1) return null;
  const excluded = new Set([
    ...state.guessHistory.map((g) => g.guessWord),
    ...state.suggestedHints,
  ]);

  let hintWord: string | null = null;
  let hintRank = -Infinity;
  // Fixed (sorted) iteration order => engine-independent tie-breaking.
  for (const word of Object.keys(table.ranks).sort()) {
    if (excluded.has(word)) continue;
    const rank = table.ranks[word];
    if (rank >= state.bestRank) continue; // must strictly improve
    // Pick the largest such rank (closest to current best = smallest nudge).
    if (rank > hintRank) {
      hintRank = rank;
      hintWord = word;
    }
  }
  return hintWord;
}
