import type { AttemptState, Puzzle, RhymeDict, SubmissionFeedback } from "./types.ts";
import { ATTEMPT_LIMIT } from "./types.ts";

// Pure Rhyme Chain engine (TERM-005). No storage, no clock. Deterministic strings.

/** REQ-004 — normalize an entry: trim, lowercase, a–z + apostrophe only. */
export function normalizeEntry(raw: string): string {
  return raw.normalize("NFC").trim().toLowerCase().replace(/[^a-z']/g, "");
}

/** REQ-006 — two words rhyme iff both are known and share a rime key (TERM-023). */
export function rhymes(a: string, b: string, dict: RhymeDict): boolean {
  const ra = dict[a];
  const rb = dict[b];
  if (ra === undefined || rb === undefined) return false;
  return ra === rb;
}

/** The word the current entry must rhyme with (seed for slot 1, else last chain word). */
export function previousWord(state: AttemptState, puzzle: Puzzle): string {
  return state.chainWords.length === 0 ? puzzle.seedWord : state.chainWords[state.chainWords.length - 1];
}

export function currentSlotIndex(state: AttemptState): number {
  return state.chainWords.length;
}

export function initAttempt(puzzle: Puzzle, dayId: string): AttemptState {
  return {
    puzzleId: puzzle.puzzleId,
    dayId,
    chainWords: [],
    attemptsUsedForSlot: 0,
    attemptsPerSlot: [],
    outcome: "in_progress",
    hintUsedForSlot: false,
  };
}

export function canSubmit(state: AttemptState): boolean {
  return state.outcome === "in_progress";
}

export interface SubmitOutcome {
  state: AttemptState;
  accepted: boolean;
  won: boolean;
  feedback?: SubmissionFeedback;
}

/**
 * REQ-005..014 — submit an entry for the current slot. Accept iff it rhymes with the
 * previous word AND equals the slot's intended answer. Correct → extend chain (and
 * win on last slot); incorrect → feedback + consume an attempt (and lose on limit).
 */
export function submit(
  state: AttemptState,
  puzzle: Puzzle,
  rawEntry: string,
  dict: RhymeDict,
): SubmitOutcome {
  if (state.outcome !== "in_progress") return { state, accepted: false, won: false };
  const slot = currentSlotIndex(state);
  const intended = puzzle.slots[slot].answer;
  const entry = normalizeEntry(rawEntry);
  const prev = previousWord(state, puzzle);

  const isReal = dict[entry] !== undefined;
  const doesRhyme = rhymes(entry, prev, dict);
  const matches = entry === intended;

  // REQ-010 — accept only when it rhymes AND matches the intended answer.
  if (doesRhyme && matches) {
    const chainWords = [...state.chainWords, entry];
    const attemptsPerSlot = [...state.attemptsPerSlot, state.attemptsUsedForSlot];
    const won = chainWords.length === puzzle.slots.length;
    return {
      state: {
        ...state,
        chainWords,
        attemptsPerSlot,
        attemptsUsedForSlot: 0,
        hintUsedForSlot: false,
        outcome: won ? "won" : "in_progress",
      },
      accepted: true,
      won,
    };
  }

  // Incorrect — feedback + consume attempt.
  const feedback: SubmissionFeedback = {
    rhyme: isReal ? (doesRhyme ? "RHYMES" : "DOES_NOT_RHYME") : "UNKNOWN",
    word: isReal ? "REAL_WORD" : "NOT_IN_DICTIONARY",
  };
  const attemptsUsedForSlot = state.attemptsUsedForSlot + 1;
  const lost = attemptsUsedForSlot >= ATTEMPT_LIMIT;
  const attemptsPerSlot = lost ? [...state.attemptsPerSlot, attemptsUsedForSlot] : state.attemptsPerSlot;
  return {
    state: {
      ...state,
      attemptsUsedForSlot,
      attemptsPerSlot,
      outcome: lost ? "lost" : "in_progress",
    },
    accepted: false,
    won: false,
    feedback,
  };
}
