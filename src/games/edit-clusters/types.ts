// Core domain types for Edit Clusters. Pure data.
//
// Edit Clusters: a board of BOARD_SIZE same-length words. Exactly one subset of
// CLUSTER_SIZE words forms the densest sub-network under one-letter-change
// (edit-distance-1) adjacency — i.e. it maximises internal edges. The player
// selects CLUSTER_SIZE words; win = the unique densest subset, within a limited
// number of submissions.

export type Status = "in_progress" | "won" | "lost";
export type ErrorCode =
  | "wrong_size"
  | "duplicate_word"
  | "unknown_word"
  | "already_tried"
  | "no_attempts_remaining"
  | null;

export interface Puzzle {
  puzzleId: string;
  /** the board words (sorted, all same length). */
  board: string[];
  /** the unique densest subset (sorted) — the answer. */
  cluster: string[];
  /** internal edge count of the answer cluster (the max achievable). */
  maxEdges: number;
  /** adjacency restricted to the board: word -> board neighbours (sorted). */
  adjacency: Record<string, string[]>;
}

export interface Attempt {
  /** the CLUSTER_SIZE selected words (sorted). */
  words: string[];
  /** internal edges achieved by this selection. */
  edges: number;
  correct: boolean;
}

export interface AttemptState {
  puzzleId: string;
  dayId: string;
  attempts: Attempt[];
  attemptsRemaining: number;
  status: Status;
}

export interface SubmissionResult {
  state: AttemptState;
  correct: boolean;
  error: ErrorCode;
  attempt?: Attempt;
}

export const BOARD_SIZE = 9;
export const CLUSTER_SIZE = 4;
export const ATTEMPTS_TOTAL = 4;
