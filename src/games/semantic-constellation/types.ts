// Core domain types for Semantic Constellation. Pure data.
//
// A Strands-style 6x6 perfect-cover grid with TWO hidden semantic anchors (A, B).
// Two 5-letter theme answers belong to cluster A (decisively closer to anchor A
// than B by GloVe rank margin), two to cluster B. An 8-letter SPANGRAM related to
// both anchors spans the grid top->bottom (the bridge). Two 4-letter fillers
// complete the cover (8 + 20 + 8 = 36). Finding a theme word reveals its cluster
// (A/B) without naming the anchors; both cluster themes reveal on completion.
// Relaxed, no lose state; fillers earn hints.

export type AnswerType = "spangram" | "theme" | "filler";
export type Cluster = "A" | "B";
export type Status = "in_progress" | "won";

export const ROWS = 6;
export const COLS = 6;
export const CELL_COUNT = ROWS * COLS;

export interface Answer {
  id: string;
  type: AnswerType;
  word: string;
  path: number[];
  cluster?: Cluster;   // present only for theme answers
}

export interface Puzzle {
  puzzleId: string;
  letters: string[];   // 36, uppercase
  answers: Answer[];   // 1 spangram + 4 theme (2 A + 2 B) + 2 filler
  anchorA: string;     // hidden until completion
  anchorB: string;     // hidden until completion
}

export type EventType = "found_theme" | "found_spangram" | "found_filler" | "spend_hint";
export interface LogEvent { type: EventType; order: number; cluster?: Cluster; }

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
