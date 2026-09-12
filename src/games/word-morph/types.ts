// Word Morph domain types. Ported from the standalone app's engine/types.ts.

export type ValidationResult =
  | "VALID"
  | "INVALID_LENGTH"
  | "INVALID_CHARS"
  | "NOT_IN_DICTIONARY"
  | "NOT_ONE_LETTER"
  | "SAME_AS_CURRENT";

export type GameStatus = "IN_PROGRESS" | "WON";

export interface CandidatePair {
  startWordIndex: number;
  targetWordIndex: number;
  par: number;
  componentId: number;
}

/** One word-length dataset (dictionary + connectivity + curated pairs). */
export interface LengthDataset {
  wordLength: number;
  dictionaryId: string;
  dictionaryWords: string[];
  /** Shipped empty to save bytes; rebuilt at load time from dictionaryWords. */
  adjacency: number[][];
  componentIdByWordIndex: number[];
  componentCount: number;
  candidatePairs: CandidatePair[];
}

export interface PuzzleState {
  startWordText: string;
  targetWordText: string;
  par: number;
  moveHistory: string[]; // [0] = start; last = current
  gameStatus: GameStatus;
}
