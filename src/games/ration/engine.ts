import type { AttemptState, LetterCounts, Puzzle, TargetBucket } from "./types.ts";

// Pure Ration engine. No storage, no clock. Shared consumable letter accounting.

/** Count the letters in a word into a LetterCounts map. */
export function lettersOf(word: string): LetterCounts {
  const counts: LetterCounts = {};
  for (const ch of word.toUpperCase()) counts[ch] = (counts[ch] ?? 0) + 1;
  return counts;
}

/** Sum letter usage across a list of words. */
export function totalLettersUsed(words: string[]): LetterCounts {
  const acc: LetterCounts = {};
  for (const w of words) {
    for (const [ch, n] of Object.entries(lettersOf(w))) acc[ch] = (acc[ch] ?? 0) + n;
  }
  return acc;
}

/** REQ-005/009 — remaining inventory = initial minus all spent letters. */
export function remainingInventory(puzzle: Puzzle, words: string[]): LetterCounts {
  const used = totalLettersUsed(words);
  const rem: LetterCounts = {};
  for (const [ch, n] of Object.entries(puzzle.inventory)) rem[ch] = n - (used[ch] ?? 0);
  return rem;
}

/** Can `word` be afforded given the letters already spent? */
export function canAfford(puzzle: Puzzle, existing: string[], word: string): boolean {
  const rem = remainingInventory(puzzle, existing);
  for (const [ch, n] of Object.entries(lettersOf(word))) {
    if ((rem[ch] ?? 0) < n) return false;
  }
  return true;
}

export function initAttempt(puzzle: Puzzle, dayId: string): AttemptState {
  return { puzzleId: puzzle.puzzleId, dayId, words: [], isComplete: false };
}

export function isWellFormed(word: string): boolean {
  return /^[A-Za-z]{2,}$/.test(word.trim());
}

export function isValidWord(word: string, dictionary: ReadonlySet<string>): boolean {
  return isWellFormed(word) && dictionary.has(word.trim().toUpperCase());
}

/** REQ-012/015 — coverage per target length: min(required, #words of that length). */
export function coverage(words: string[], targets: TargetBucket[]): Record<number, number> {
  const byLen: Record<number, number> = {};
  for (const w of words) byLen[w.length] = (byLen[w.length] ?? 0) + 1;
  const cov: Record<number, number> = {};
  for (const t of targets) cov[t.length] = Math.min(t.count, byLen[t.length] ?? 0);
  return cov;
}

/** REQ-017 — histogram met: every target bucket satisfied. */
export function isHistogramMet(words: string[], targets: TargetBucket[]): boolean {
  const cov = coverage(words, targets);
  return targets.every((t) => (cov[t.length] ?? 0) >= t.count);
}

export type SubmitReason = "well-formed" | "dictionary" | "inventory" | "duplicate" | "complete";

export interface SubmitOutcome {
  state: AttemptState;
  accepted: boolean;
  reason?: SubmitReason;
  solved?: boolean;
}

/** REQ-006..017 — validate + spend + record + evaluate completion. */
export function submit(
  state: AttemptState,
  puzzle: Puzzle,
  dictionary: ReadonlySet<string>,
  word: string,
): SubmitOutcome {
  if (state.isComplete) return { state, accepted: false, reason: "complete" };
  if (!isWellFormed(word)) return { state, accepted: false, reason: "well-formed" };
  const norm = word.trim().toUpperCase();
  if (!dictionary.has(norm)) return { state, accepted: false, reason: "dictionary" };
  if (state.words.includes(norm)) return { state, accepted: false, reason: "duplicate" };
  if (!canAfford(puzzle, state.words, norm)) return { state, accepted: false, reason: "inventory" };

  const words = [...state.words, norm];
  const solved = isHistogramMet(words, puzzle.targets);
  return { state: { ...state, words, isComplete: solved }, accepted: true, solved };
}

/** REQ-015/016 — remove a word (restores its letters to the inventory). */
export function removeWord(state: AttemptState, word: string): AttemptState {
  if (state.isComplete) return state;
  const norm = word.trim().toUpperCase();
  if (!state.words.includes(norm)) return state;
  return { ...state, words: state.words.filter((w) => w !== norm) };
}

/** Score = total letters used across all words (TERM-013 default mode). */
export function score(words: string[]): number {
  return words.reduce((n, w) => n + w.length, 0);
}

export function canSubmit(state: AttemptState): boolean {
  return !state.isComplete;
}
