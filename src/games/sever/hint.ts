import type { AttemptState, Puzzle } from "./types.ts";

// REQ-014/015 — hint: reveal one correct break not yet revealed. Deterministic:
// lowest such gap index (preserves cross-platform parity). Also sets the candidate
// break true and locks it. Null when solved/failed or nothing left to reveal.
export interface HintOutcome {
  state: AttemptState;
  gapIndex: number;
}

export function applyHint(state: AttemptState, puzzle: Puzzle): HintOutcome | null {
  if (state.isSolved || state.isFailed) return null;
  const revealed = new Set(state.revealedBreaks);
  let gap = -1;
  for (let i = 0; i < puzzle.intendedBreaks.length; i++) {
    if (puzzle.intendedBreaks[i] && !revealed.has(i)) {
      gap = i;
      break;
    }
  }
  if (gap === -1) return null;

  const breaks = [...state.breaks];
  breaks[gap] = true;
  return {
    state: {
      ...state,
      breaks,
      revealedBreaks: [...state.revealedBreaks, gap],
      hintUsedCount: state.hintUsedCount + 1,
    },
    gapIndex: gap,
  };
}
