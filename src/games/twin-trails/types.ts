// Core domain types for Twin Trails. Pure data.
//
// Twin Trails: two hidden "gravity wells" (pivots A and B) each pulled a set of
// PER_SIDE words. The words are shown interleaved/shuffled; the player assigns
// each to trail A or trail B. One submission per attempt returns only the count
// correct (Connections-style), never which. Win = all SIDE_TOTAL correct within
// ATTEMPTS_TOTAL. The two pivot themes are revealed on solve.

export type Side = "A" | "B";
export type Status = "in_progress" | "won" | "lost";

export interface Puzzle {
  puzzleId: string;
  /** the shuffled board words (sorted for storage). */
  words: string[];
  /** gold assignment: word -> side. */
  gold: Record<string, Side>;
  /** short labels shown only after solving. */
  labelA: string;
  labelB: string;
}

export interface Attempt {
  /** the player's assignment word -> side. */
  assignment: Record<string, Side>;
  /** number of words placed on the correct trail. */
  correctCount: number;
  solved: boolean;
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
  error: "incomplete" | "no_attempts_remaining" | null;
  attempt?: Attempt;
}

export const PER_SIDE = 4;
export const SIDE_TOTAL = PER_SIDE * 2; // 8 words on the board
export const ATTEMPTS_TOTAL = 4;
