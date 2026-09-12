// Core domain types for Kerning. Pure data.

export type Status = "in_progress" | "won" | "lost";

/** A daily puzzle: a letter run shown as reading A, target = reading B. */
export interface Puzzle {
  puzzleId: string;
  letterRun: string; // uppercase, no spaces
  shownMask: boolean[]; // reading A break positions (length letterRun.length-1)
  targetMask: boolean[]; // reading B break positions
}

export interface AttemptState {
  puzzleId: string;
  dayId: string;
  mask: boolean[]; // candidate breaks
  attemptsUsed: number;
  status: Status;
  revealedGaps: number[];
  history: number[]; // correct-break count per attempt
}

export interface SubmissionFeedback {
  correctBreakCount: number;
  allTokensAreDictionaryWords: boolean;
}

export const ATTEMPT_LIMIT = 6;
