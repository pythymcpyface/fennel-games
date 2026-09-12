// Core domain types for Tradeoff. Pure data.

export type WinState = "in_progress" | "won" | "lost";
export type ErrorCode =
  | "NOT_IN_DICTIONARY"
  | "NOT_ONE_LETTER_CHANGE"
  | "WRONG_LENGTH"
  | "OUT_OF_SWAPS"
  | "ALREADY_ENDED"
  | "NO_IMPROVING_HINT";

/** A daily puzzle. `neighbors` is the precomputed edit-distance-1 adjacency for
 *  every reachable word (built from wordkit's edit graph at build time). */
export interface Puzzle {
  puzzleId: string;
  startWord: string; // uppercase
  swapBudget: number;
  parScore: number;
  /** letter -> value (Scrabble-style), A..Z. */
  letterValues: Record<string, number>;
  /** word -> its one-letter-change neighbors (uppercase). */
  neighbors: Record<string, string[]>;
}

export interface AttemptState {
  puzzleId: string;
  dayId: string;
  currentWord: string;
  swapsUsed: number;
  moveHistory: string[];
  bestScore: number;
  winState: WinState;
  hintUsedCount: number;
}

export interface MoveResult {
  state: AttemptState;
  ok: boolean;
  error?: ErrorCode;
}
