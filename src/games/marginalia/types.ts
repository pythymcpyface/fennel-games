// Core domain types for Marginalia — a daily branching cloze story. Each node
// shows a sentence with one missing word ([[BLANK]]) and 3 word choices; the
// chosen word fills the blank AND branches to a specific next node. Exactly one
// path reaches the GOLDEN ENDING. Reaching it = solved.
//
// Pure data. Mirrors spec Glossary/Data Dictionary.
// TERM-004 Story Graph; TERM-005 Node; TERM-007 Word Choice; TERM-011 Golden Ending.

export const BLANK_MARKER = "[[BLANK]]";

/** One word choice: the word + the node it leads to (FIELD-008/009). */
export interface Choice {
  /** FIELD-008 choiceText. */
  word: string;
  /** FIELD-009 nextNodeId. */
  next: string;
}

/** A story node (FIELD-004..012). Terminal nodes have no choices. */
export interface Node {
  id: string;
  /** FIELD-005 promptText — contains exactly one [[BLANK]] marker. */
  prompt: string;
  /** FIELD-007 choices — exactly 3 for non-terminal nodes; empty for terminals. */
  choices: Choice[];
}

/** A daily puzzle: a node graph + start + golden ending. */
export interface Puzzle {
  puzzleId: string;
  /** FIELD-003 nodes, keyed by id. */
  nodes: Record<string, Node>;
  /** FIELD-010 startNodeId. */
  startNodeId: string;
  /** FIELD-011 goldenNodeId. */
  goldenNodeId: string;
}

/** Persisted per-day run state (TERM-012). */
export interface AttemptState {
  puzzleId: string;
  dayId: string;
  /** FIELD-017 currentNodeId. */
  currentNodeId: string;
  /** FIELD-013 visitedNodeIds (path). */
  visited: string[];
  /** FIELD-014 selectedChoiceIndices. */
  choices: number[];
  /** FIELD-015 runEnded. */
  isComplete: boolean;
}
