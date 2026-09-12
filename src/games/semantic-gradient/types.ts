// Core domain types for Semantic Gradient. Pure data.
//
// A Strands-style 6x6 perfect-cover grid. A hidden ANCHOR word ties the theme
// together: the four 5-letter THEME answers are GloVe neighbours of the anchor at
// graded closeness, bucketed by rank MARGIN into four decisive bands (hot→cold).
// An 8-letter SPANGRAM (also a strong neighbour) spans the grid top→bottom. Two
// 4-letter FILLER words complete the cover (8 + 20 + 8 = 36) and earn hints.
// Finding a theme word reveals its closeness BAND (temperature) to the still-
// hidden anchor. Win = all 4 theme + spangram; anchor revealed on completion.

export type AnswerType = "spangram" | "theme" | "filler";
export type Status = "in_progress" | "won";
export type Band = "hot" | "warm" | "cool" | "cold";   // hot = closest

export const ROWS = 6;
export const COLS = 6;
export const CELL_COUNT = ROWS * COLS;
export const BANDS: readonly Band[] = ["hot", "warm", "cool", "cold"];

export interface Answer {
  id: string;
  type: AnswerType;
  word: string;
  path: number[];
  band?: Band;         // present only for theme answers
}

export interface Puzzle {
  puzzleId: string;
  letters: string[];   // 36, uppercase
  answers: Answer[];   // 1 spangram + 4 theme + 2 filler
  anchor: string;      // hidden until completion
}

export type EventType = "found_theme" | "found_spangram" | "found_filler" | "spend_hint";
export interface LogEvent { type: EventType; order: number; band?: Band; }

export interface AttemptState {
  puzzleId: string;
  dayId: string;
  foundIds: string[];
  hintBalance: number;
  hintsSpent: number;
  revealedIds: string[];
  log: LogEvent[];
  status: Status;
}

export interface TraceResult {
  state: AttemptState;
  found: Answer | null;
  error: "empty" | "not_an_answer" | "already_found" | null;
}

export const HINT_PER_FILLER = 1;
