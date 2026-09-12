import type { AttemptState, Node, Puzzle } from "./types.ts";
import { BLANK_MARKER } from "./types.ts";

// Pure Marginalia engine. No storage, no clock. Node traversal via choices.

export function isTerminal(node: Node): boolean {
  return node.choices.length === 0;
}

export function nodeOf(puzzle: Puzzle, id: string): Node {
  return puzzle.nodes[id];
}

/** Render a node's prompt with the chosen word substituted (or a blank shown). */
export function fillPrompt(prompt: string, word: string | null): string {
  return prompt.replace(BLANK_MARKER, word ?? "_____");
}

export function initAttempt(puzzle: Puzzle, dayId: string): AttemptState {
  return {
    puzzleId: puzzle.puzzleId,
    dayId,
    currentNodeId: puzzle.startNodeId,
    visited: [puzzle.startNodeId],
    choices: [],
    isComplete: isTerminal(nodeOf(puzzle, puzzle.startNodeId)),
  };
}

export interface ChooseOutcome {
  state: AttemptState;
  accepted: boolean;
  reason?: "complete" | "out-of-range";
}

/**
 * REQ-007..010 — apply a choice (0..2) at the current node: fill the blank,
 * advance to the mapped next node, append to history. Ends the run if the new
 * node is terminal. Rejected once the run has ended.
 */
export function choose(state: AttemptState, puzzle: Puzzle, choiceIndex: number): ChooseOutcome {
  if (state.isComplete) return { state, accepted: false, reason: "complete" };
  const node = nodeOf(puzzle, state.currentNodeId);
  if (choiceIndex < 0 || choiceIndex >= node.choices.length) return { state, accepted: false, reason: "out-of-range" };
  const nextId = node.choices[choiceIndex].next;
  const nextNode = nodeOf(puzzle, nextId);
  return {
    state: {
      ...state,
      currentNodeId: nextId,
      visited: [...state.visited, nextId],
      choices: [...state.choices, choiceIndex],
      isComplete: isTerminal(nextNode),
    },
    accepted: true,
  };
}

/** REQ-011 — solved = run ended at the golden node. */
export function isSolved(state: AttemptState, puzzle: Puzzle): boolean {
  return state.isComplete && state.currentNodeId === puzzle.goldenNodeId;
}

/** FIELD-021 — number of choices made. */
export function stepsCount(state: AttemptState): number {
  return state.choices.length;
}

/** Restart the run at the start node (REQ-012 replay). */
export function replay(puzzle: Puzzle, dayId: string): AttemptState {
  return initAttempt(puzzle, dayId);
}
