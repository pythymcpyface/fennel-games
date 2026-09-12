// Core domain types for Edit-Ladder Trails. Pure data.
//
// A 6x6 letter grid (36 cells) is a PERFECT COVER: every tile belongs to exactly
// one answer, traced as a non-linear 8-direction path (Strands-style word search).
// Theme = an EDIT LADDER of four 5-letter rungs (each one substitution from the
// last, e.g. HOSES→HOLES→MOLES→MILES). A single 8-letter SPANGRAM spans the grid
// top-to-bottom and anchors the theme. Two 4-letter FILLER words complete the
// cover (8 + 20 + 8 = 36). Relaxed play, no lose state; fillers earn hints.

export type AnswerType = "spangram" | "rung" | "filler";
export type Status = "in_progress" | "won";

/** grid geometry — locked at 6x6 per spec (FIELD-004). */
export const ROWS = 6;
export const COLS = 6;
export const CELL_COUNT = ROWS * COLS;

/** One embedded answer and its exact placement path (cell indices 0..35). */
export interface Answer {
  id: string;
  type: AnswerType;
  word: string;          // lowercase en-GB word
  path: number[];        // ordered, contiguous 8-neighbour cell indices; length === word.length
}

export interface Puzzle {
  puzzleId: string;
  letters: string[];     // length 36, uppercase A-Z
  answers: Answer[];     // 1 spangram + 4 rungs + 2 fillers
  ladder: string[];      // the 4 rungs in chain order (theme reveal)
  spangram: string;      // the 8-letter theme anchor
}

/** A discovery-log event (spoiler-free; drives the share grid). */
export type EventType = "found_rung" | "found_spangram" | "found_filler" | "spend_hint";
export interface LogEvent { type: EventType; order: number; }

export interface AttemptState {
  puzzleId: string;
  dayId: string;
  foundIds: string[];      // answerIds discovered (unique)
  hintBalance: number;     // earned from fillers, >= 0
  hintsSpent: number;
  revealedIds: string[];   // answers whose start cell was revealed via a hint
  log: LogEvent[];         // discovery order, for the share grid
  status: Status;
}

export interface TraceResult {
  state: AttemptState;
  found: Answer | null;    // the answer matched by this trace, if any
  error: "empty" | "not_an_answer" | "already_found" | null;
}

export const HINT_PER_FILLER = 1;
