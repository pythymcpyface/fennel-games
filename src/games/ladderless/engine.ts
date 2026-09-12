import type { GameState, GuessRecord, RankTable, Verdict } from "./types.ts";

// Pure gameplay engine (TERM-026). No storage, no clock, no floating point.
// Warmer/colder is a pure integer rank comparison (NFR-002 determinism).

const MAX_GUESS_LEN = 64;

/**
 * FIELD-007 normalization: NFC, trim, lowercase, ASCII a–z only, length 1..64.
 * Deterministic across platforms (resolves the Missing-Edge-Case on normalization).
 */
export function normalizeGuess(input: string): string {
  const n = input.normalize("NFC").trim().toLowerCase();
  if (n.length < 1) throw new Error("Guess is empty");
  if (n.length > MAX_GUESS_LEN) throw new Error("Guess too long");
  if (!/^[a-z]+$/.test(n)) throw new Error("Guess must be a–z only");
  return n;
}

/** FIELD-011 — tier = number of ascending cutoffs strictly below the rank. */
export function rankToTier(rank: number, tierCutoffs: number[]): number {
  let tier = 0;
  for (const cutoff of tierCutoffs) {
    if (rank >= cutoff) tier++;
    else break;
  }
  return tier;
}

export interface EvaluatedGuess {
  semanticRank: number;
  rankTier: number;
  verdict: Verdict;
  isWin: boolean;
}

/**
 * REQ-008/009/011 — look up a word's rank/tier and compute the verdict relative to
 * the prior best rank.
 *
 * O-1 (accept-list decoupling): a guess may be a valid accept-list word that is
 * NOT in this target's bounded rank universe. Such words score at the worst
 * possible rank (vocabSize + 1) → max tier → "colder", deterministically, and
 * can never win (only the exact target is rank 1). This replaces the former
 * throw-on-miss (ERROR-002), which assumed validation == rank universe.
 */
export function evaluateGuess(
  guessWord: string,
  table: RankTable,
  priorBestRank: number,
): EvaluatedGuess {
  const rank = table.ranks[guessWord] ?? table.vocabSize + 1;
  const rankTier = rankToTier(rank, table.tierCutoffs);
  const isWin = guessWord === table.targetWord;
  let verdict: Verdict;
  if (isWin || rank === 1) verdict = "best";
  else if (rank < priorBestRank) verdict = "warmer";
  else verdict = "colder";
  return { semanticRank: rank, rankTier, verdict, isWin };
}

/** REQ-005 — fresh state; bestRank starts at the worst possible (vocabSize). */
export function initGameState(puzzleId: string, dayId: string, vocabSize: number): GameState {
  return {
    puzzleId,
    dayId,
    status: "not_started",
    guessHistory: [],
    bestRank: vocabSize,
    hintCount: 0,
    suggestedHints: [],
  };
}

/**
 * REQ-010/012/018 — pure reducer: append the evaluated guess, advance bestRank
 * (never regressing), and move status not_started → in_progress → won.
 */
export function reduceGameState(
  prev: GameState,
  ev: EvaluatedGuess,
  guessWord: string,
  timestamp: number,
): GameState {
  const record: GuessRecord = {
    guessIndex: prev.guessHistory.length + 1,
    guessWord,
    semanticRank: ev.semanticRank,
    rankTier: ev.rankTier,
    verdict: ev.verdict,
    isWin: ev.isWin,
    guessTimestamp: timestamp,
  };
  const bestRank = Math.min(prev.bestRank, ev.semanticRank);
  const status = ev.isWin ? "won" : "in_progress";
  return {
    ...prev,
    status,
    bestRank,
    guessHistory: [...prev.guessHistory, record],
  };
}
