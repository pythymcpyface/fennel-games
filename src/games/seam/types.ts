// Core domain types for Seam. Pure data. Mirrors spec Glossary/Data Dictionary.
// TERM-001 Seam; TERM-004 Chain; TERM-008 Adjacency Link; TERM-012 Solution Chain.

/**
 * A daily puzzle: a set of words plus the canonical solution ordering. Adjacency
 * validity is defined by the solution's consecutive pairs (undirected), so the
 * puzzle is self-contained — no external link database ships (TERM-024).
 */
export interface Puzzle {
  puzzleId: string;
  /** FIELD-004 word_list, in SCRAMBLED display order (uppercase). */
  words: string[];
  /**
   * FIELD-012 the canonical solution as indices into `words`. A permutation of
   * 0..N-1. Its consecutive pairs are the valid links (undirected).
   */
  solution: number[];
}

/** FIELD-014 one attempt's feedback (TERM-014). */
export interface AttemptFeedback {
  /** FIELD-008 correct_links_count — valid adjacent links in the submitted order. */
  correctLinks: number;
  /** total links = N-1. */
  totalLinks: number;
  solved: boolean;
}

/** Persisted per-day attempt state (TERM-013/015). */
export interface AttemptState {
  puzzleId: string;
  dayId: string;
  /** FIELD-005 chain_order — current arrangement as indices into puzzle.words. */
  order: number[];
  attempts: number;
  isSolved: boolean;
  /** per-attempt correct-link counts, for the spoiler-safe share. */
  history: number[];
}
