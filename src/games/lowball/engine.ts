// Lowball — pure round engine. No DOM, no storage, no clock: every function is a
// deterministic transform of its arguments, returning new state (REQ-056). This is
// what makes verdicts byte-identical across iOS WKWebView, Android WebView and
// desktop browsers, and what makes the tension-counter drain unit-testable.

import { derivePuzzleId, fnv1a32 } from "../../kit/selection.ts";
import {
  MAX_PANEL_SCORE,
  SWEEPS_TOTAL,
  matchesRule,
  type Answer,
  type AttemptState,
  type PlayerState,
  type Puzzle,
  type RoundMode,
  type SubmitResult,
  type Sweep,
  type Verdict,
} from "./types.ts";

/** Options a caller may pass in rather than the engine reading the environment. */
export interface SubmitOptions {
  /** When true the tension counter jumps straight to the score (REQ-021). */
  reducedMotion?: boolean;
}

/**
 * Canonical form of a raw submission (REQ-005): NFC-normalised, decomposed so
 * accents can be stripped, lowercased, and reduced to a-z only. Idempotent.
 */
export function normalize(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z]/g, "");
}

/** The Answer List is the validator: absence means invalid (ADR-002). */
export function lookupAnswer(puzzle: Puzzle, word: string): Answer | null {
  return puzzle.answers.find((a) => a.word === word) ?? null;
}

/** A fresh round. */
export function initAttempt(puzzle: Puzzle, dayId: string, mode: RoundMode = "daily"): AttemptState {
  return {
    puzzleId: puzzle.puzzleId,
    dayId,
    mode,
    players: [{ playerId: 0, sweeps: [] }],
    activePlayerIndex: 0,
    sweepIndex: 0,
    verdict: "pending",
    tickCounter: MAX_PANEL_SCORE,
    tickTarget: null,
  };
}

/** Are there sweeps left to play? */
export function canSubmit(state: AttemptState): boolean {
  return state.sweepIndex < SWEEPS_TOTAL;
}

/** Sum of a player's sweep scores. Deliberately uncapped (REQ-014). */
export function totalFor(player: PlayerState): number {
  return player.sweeps.reduce((sum, s) => sum + s.panelScore, 0);
}

/**
 * Beat-par: strictly below par wins, equal-or-above loses (REQ-015, REQ-016).
 * Equality losing is deliberate — par is the bar to beat, not to match.
 */
export function computeVerdict(total: number, parValue: number): Verdict {
  return total < parValue ? "win" : "loss";
}

/**
 * Score one submission and consume a sweep.
 *
 * Invalid input is never an exception: an unlisted word, an affix mismatch, a
 * repeat of the player's own earlier answer, and an empty submission all resolve to
 * the maximum penalty (REQ-006..009). The only refusal is submitting after both
 * sweeps are spent, which returns an error marker and the state untouched (REQ-012).
 */
export function submitAnswer(
  state: AttemptState,
  puzzle: Puzzle,
  rawInput: string,
  opts: SubmitOptions = {},
): SubmitResult {
  if (!canSubmit(state)) {
    return { state, error: "no_sweeps_remaining", sweep: null };
  }

  const player = state.players[state.activePlayerIndex];
  const word = normalize(rawInput);
  const alreadyGiven = player.sweeps.some((s) => s.answerWord === word && word !== "");

  let panelScore = MAX_PANEL_SCORE;
  let invalidReason: Sweep["invalidReason"] = null;

  if (word === "") {
    invalidReason = "empty";
  } else if (alreadyGiven) {
    invalidReason = "duplicate";
  } else if (!matchesRule(word, puzzle.rule)) {
    invalidReason = "affix_mismatch";
  } else {
    const answer = lookupAnswer(puzzle, word);
    if (answer === null) {
      invalidReason = "not_in_list";
    } else {
      panelScore = answer.panelScore;
    }
  }

  const sweep: Sweep = {
    answerWord: word,
    panelScore,
    invalidReason,
    isDuplicateOfEarlierAnswer: invalidReason === "duplicate",
  };

  const players = state.players.map((p, i) =>
    i === state.activePlayerIndex ? { ...p, sweeps: [...p.sweeps, sweep] } : p,
  );
  const sweepIndex = state.sweepIndex + 1;
  const updatedPlayer = players[state.activePlayerIndex];
  const verdict =
    sweepIndex >= SWEEPS_TOTAL ? computeVerdict(totalFor(updatedPlayer), puzzle.parValue) : "pending";

  return {
    state: {
      ...state,
      players,
      sweepIndex,
      verdict,
      // Seed the drain at 100 and let the view step it down, unless reduced motion
      // is preferred, in which case the outcome is shown immediately (REQ-018/021).
      tickCounter: opts.reducedMotion === true ? panelScore : MAX_PANEL_SCORE,
      tickTarget: panelScore,
    },
    error: null,
    sweep,
  };
}

/**
 * Is the bar at `index` lit, in a single column drawn top-down where index 0 is the
 * topmost bar?
 *
 * The column drains downwards: it starts full and empties from the TOP, so the
 * remaining `tickCounter` bars always sit at the BOTTOM. Lighting `index <
 * tickCounter` instead would empty the column from the bottom up, which reads as
 * the score climbing rather than falling.
 *
 * Pure and exported so the direction is unit-tested; an off-by-one here is
 * invisible in a screenshot but inverts the whole feel of the counter.
 */
export function isBarLit(index: number, tickCounter: number): boolean {
  return index >= MAX_PANEL_SCORE - tickCounter;
}

/**
 * One discrete step of the tension counter (REQ-019, REQ-020). A logical tick, not
 * wall-clock time: the view decides when to call this, the engine only decides what
 * the next value is. Idempotent once the target is reached, so over-advancing is safe.
 */
export function advanceTick(state: AttemptState): AttemptState {
  if (state.tickTarget === null) return state;
  if (state.tickCounter <= state.tickTarget) return state;
  return { ...state, tickCounter: state.tickCounter - 1 };
}

// --- Daily and practice selection -------------------------------------------

/**
 * Today's category (REQ-001, REQ-004). Delegates to the hub's existing FNV-1a
 * selection so all 51 games share one determinism guarantee. Returns null rather
 * than throwing when a pack declares no categories (REQ-004 / TEST-007).
 */
export function selectDailyPuzzleId(
  dayId: string,
  packVersion: string,
  datasetId: string,
  puzzleCount: number,
): string | null {
  if (!Number.isInteger(puzzleCount) || puzzleCount <= 0) return null;
  return derivePuzzleId(dayId, packVersion, datasetId, puzzleCount);
}

/**
 * A practice category (REQ-024, REQ-025). Seeded on the day plus the attempt
 * ordinal so it is reproducible without a random source, and stepped forward when
 * it collides with today's daily category so practice never duplicates the daily
 * round — unless the pack holds only one category, where collision is unavoidable.
 */
export function selectPracticePuzzleId(
  dayId: string,
  ordinal: number,
  puzzleCount: number,
  dailyPuzzleId: string | null,
): string | null {
  if (!Number.isInteger(puzzleCount) || puzzleCount <= 0) return null;
  const index = fnv1a32(`${dayId}|practice|${ordinal}`) % puzzleCount;
  const id = (i: number): string => `puz-${i.toString().padStart(4, "0")}`;
  if (puzzleCount === 1 || id(index) !== dailyPuzzleId) return id(index);
  return id((index + 1) % puzzleCount);
}

// --- Persistence repair ------------------------------------------------------

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

function repairSweep(raw: unknown): Sweep | null {
  if (!isRecord(raw)) return null;
  if (typeof raw.answerWord !== "string") return null;
  const score = typeof raw.panelScore === "number" && Number.isFinite(raw.panelScore) ? raw.panelScore : MAX_PANEL_SCORE;
  return {
    answerWord: raw.answerWord,
    panelScore: Math.min(MAX_PANEL_SCORE, Math.max(0, Math.round(score))),
    invalidReason: (raw.invalidReason ?? null) as Sweep["invalidReason"],
    isDuplicateOfEarlierAnswer: raw.isDuplicateOfEarlierAnswer === true,
  };
}

/**
 * Validate and clamp state loaded from storage (REQ-028, REQ-058). Returns null when
 * the record cannot be trusted, so the caller starts a fresh round rather than
 * crashing. A tampered players array is clamped to the single slot v1 plays.
 */
export function repairState(raw: unknown): AttemptState | null {
  if (!isRecord(raw)) return null;
  if (typeof raw.puzzleId !== "string" || typeof raw.dayId !== "string") return null;
  if (!Array.isArray(raw.players) || raw.players.length === 0) return null;

  const firstPlayer = raw.players[0];
  if (!isRecord(firstPlayer) || !Array.isArray(firstPlayer.sweeps)) return null;
  // Clamp to the two sweeps a round allows. A tampered save carrying more would
  // otherwise leave sweeps.length above sweepIndex, handing the player extra turns.
  const sweeps = firstPlayer.sweeps
    .map(repairSweep)
    .filter((s): s is Sweep => s !== null)
    .slice(0, SWEEPS_TOTAL);

  const mode: RoundMode = raw.mode === "practice" ? "practice" : "daily";
  // sweepIndex is derived from the surviving sweeps rather than trusted from the
  // record, so the two can never disagree.
  const sweepIndex = sweeps.length;
  // A terminal verdict is only credible once both sweeps exist; otherwise a
  // tampered save could claim a win with no answers given.
  const claimed = raw.verdict;
  const verdict: Verdict =
    sweepIndex >= SWEEPS_TOTAL && (claimed === "win" || claimed === "loss") ? claimed : "pending";
  const rawTick = typeof raw.tickCounter === "number" ? raw.tickCounter : MAX_PANEL_SCORE;
  const rawTarget = typeof raw.tickTarget === "number" ? raw.tickTarget : null;

  return {
    puzzleId: raw.puzzleId,
    dayId: raw.dayId,
    mode,
    // v1 plays a single slot; extra entries can only come from tampering or a
    // future multiplayer save loaded by an older build.
    players: [{ playerId: 0, sweeps }],
    activePlayerIndex: 0,
    sweepIndex,
    verdict,
    tickCounter: Math.min(MAX_PANEL_SCORE, Math.max(0, Math.round(rawTick))),
    tickTarget: rawTarget === null ? null : Math.min(MAX_PANEL_SCORE, Math.max(0, Math.round(rawTarget))),
  };
}
