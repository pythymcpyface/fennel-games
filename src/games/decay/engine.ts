import type { AttemptState, CompletionStatus, OutcomeTier, Puzzle, Target, WordState } from "./types.ts";

// Pure Decay engine. No storage, no clock, no timers. Turn-based decay: the
// per-word visibility is derived from the current tick and the word's decay order.

export function normalizeSubmission(text: string): string {
  return text.replace(/[^A-Za-z]/g, "").toLowerCase();
}

/**
 * REQ-003 — visible letter positions for a word at a given effective tick. A
 * word hides its first `min(tick, len)` letters per its decay order. For a locked
 * word, pass the tick it was locked at (frozen). Returns a boolean mask.
 */
export function visibleMask(target: Target, effectiveTick: number): boolean[] {
  const len = target.word.length;
  const hidden = new Set<number>();
  const hideN = Math.min(Math.max(effectiveTick, 0), len);
  for (let i = 0; i < hideN; i++) hidden.add(target.decayOrder[i]);
  return Array.from({ length: len }, (_, i) => !hidden.has(i));
}

/** FIELD-013 visibleCount — number of visible letters. */
export function visibleCount(target: Target, effectiveTick: number): number {
  return visibleMask(target, effectiveTick).filter(Boolean).length;
}

/** The effective tick a word "sees": frozen at lock/lost tick, else current tick. */
export function effectiveTick(state: AttemptState, index: number): number {
  const w = state.words[index];
  return w.atTick !== null ? w.atTick : state.tick;
}

/** Render a word's display string given a mask (visible letter or underscore). */
export function renderWord(target: Target, mask: readonly boolean[]): string {
  return target.word.toUpperCase().split("").map((ch, i) => (mask[i] ? ch : "_")).join(" ");
}

/** REQ-009 — lock score from visibility at lock time. Monotonic in visibleCount. */
export function lockScore(vis: number): number {
  return vis; // 1 point per still-visible letter
}

export function initAttempt(puzzle: Puzzle, dayId: string): AttemptState {
  return {
    puzzleId: puzzle.puzzleId,
    dayId,
    tick: 0,
    words: puzzle.targets.map<WordState>(() => ({ status: "UNLOCKED", atTick: null, lockedVisibility: null })),
    score: 0,
    status: "IN_PROGRESS",
  };
}

function lockCount(state: AttemptState): number {
  return state.words.filter((w) => w.status === "LOCKED").length;
}

function anyUnlocked(state: AttemptState): boolean {
  return state.words.some((w) => w.status === "UNLOCKED");
}

/** Recompute the terminal completion status (REQ-013/015). */
function completion(state: AttemptState, puzzle: Puzzle): CompletionStatus {
  if (lockCount(state) >= puzzle.lockThreshold) return "SOLVED";
  if (!anyUnlocked(state)) return "FAILED";
  return "IN_PROGRESS";
}

export interface SubmitOutcome {
  state: AttemptState;
  accepted: boolean;
  reason?: "empty" | "complete";
  lockedIndex?: number;
  matched: boolean;
}

/**
 * REQ-005..015 — process a submission. Empty (after normalize) is rejected and
 * does NOT advance the tick. Otherwise: lock a matching unlocked word (scored at
 * current visibility, BEFORE the tick's decay — BRANCH-003), then advance one
 * tick, then mark any unlocked word now fully hidden as LOST, then recompute
 * completion.
 */
export function submit(state: AttemptState, puzzle: Puzzle, rawText: string): SubmitOutcome {
  if (state.status !== "IN_PROGRESS") return { state, accepted: false, reason: "complete", matched: false };
  const guess = normalizeSubmission(rawText);
  if (guess.length === 0) return { state, accepted: false, reason: "empty", matched: false };

  const words = state.words.map((w) => ({ ...w }));
  let score = state.score;
  let lockedIndex: number | undefined;

  // Lock a matching unlocked word at CURRENT visibility (before decay).
  for (let i = 0; i < puzzle.targets.length; i++) {
    if (words[i].status !== "UNLOCKED") continue;
    if (puzzle.targets[i].word.toLowerCase() === guess) {
      const vis = visibleCount(puzzle.targets[i], state.tick);
      words[i] = { status: "LOCKED", atTick: state.tick, lockedVisibility: vis };
      score += lockScore(vis);
      lockedIndex = i;
      break; // targets are distinct, at most one match
    }
  }

  // Advance one tick.
  const tick = state.tick + 1;

  // Mark newly fully-hidden unlocked words as LOST (at the new tick).
  for (let i = 0; i < puzzle.targets.length; i++) {
    if (words[i].status !== "UNLOCKED") continue;
    if (visibleCount(puzzle.targets[i], tick) === 0) {
      words[i] = { status: "LOST", atTick: tick, lockedVisibility: null };
    }
  }

  let next: AttemptState = { ...state, tick, words, score };
  next = { ...next, status: completion(next, puzzle) };
  return { state: next, accepted: true, lockedIndex, matched: lockedIndex !== undefined };
}

export function lockedCount(state: AttemptState): number {
  return lockCount(state);
}
export function lostCount(state: AttemptState): number {
  return state.words.filter((w) => w.status === "LOST").length;
}
export function isSolved(state: AttemptState): boolean {
  return state.status === "SOLVED";
}

/** FIELD-025 — outcome tier for share (HIGH_LOCK if >=50% visible at lock). */
export function outcomeTier(state: AttemptState, puzzle: Puzzle, index: number): OutcomeTier {
  const w = state.words[index];
  if (w.status === "LOST") return "LOST";
  if (w.status === "UNLOCKED") return "UNLOCKED";
  const len = puzzle.targets[index].word.length;
  const vis = w.lockedVisibility ?? 0;
  return vis * 2 >= len ? "HIGH_LOCK" : "LOW_LOCK";
}
