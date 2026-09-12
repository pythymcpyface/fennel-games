// Pure room-logic functions — zero DO / WebSocket / Cloudflare APIs.
// These are the testable business-logic layer that room.ts calls.
// Importing engine.ts here gives the DO server-side the same deterministic
// scoring as the single-player client (REQ-015, REQ-042, REQ-060).

import {
  normalize,
  lookupAnswer,
} from "../../../src/games/lowball/engine.ts";
import {
  MAX_PANEL_SCORE,
  matchesAffix,
  type Puzzle,
} from "../../../src/games/lowball/types.ts";
import type {
  LeaderboardEntry,
  PlayerRecord,
  RoomState,
  SweepRecord,
} from "../../../src/games/lowball/mp-types.ts";

// ---------------------------------------------------------------------------
// REQ-001/002: Room code generation (crypto.randomUUID available in Workers)
// In tests the global crypto shim from jsdom is used.
// ---------------------------------------------------------------------------

export function generateRoomCode(): string {
  // Use 4 random bytes encoded as base-36, take last 6 chars, uppercase
  const bytes = new Uint8Array(4);
  (typeof crypto !== "undefined" ? crypto : globalThis.crypto).getRandomValues(bytes);
  const n = (bytes[0]! * 16777216 + bytes[1]! * 65536 + bytes[2]! * 256 + bytes[3]!) >>> 0;
  return n.toString(36).toUpperCase().padStart(6, "0").slice(-6);
}

// ---------------------------------------------------------------------------
// REQ-010: Can the host start the game?
// ---------------------------------------------------------------------------

export function canStartGame(state: RoomState, senderSlotIndex: number): boolean {
  const sender = state.players.find((p) => p.slotIndex === senderSlotIndex);
  if (!sender?.isHost) return false;
  const connected = state.players.filter((p) => p.isConnected);
  return connected.length >= 2;
}

// ---------------------------------------------------------------------------
// REQ-015: Authoritative scoring
// Checks word length cap (REQ-021), used-word set (REQ-025), then delegates
// to the shared engine for affix/answer-list validation.
// ---------------------------------------------------------------------------

export function scoreSubmission(
  rawWord: string,
  puzzle: Puzzle,
  usedWords: Set<string>,
): SweepRecord {
  const word = normalize(rawWord);

  // REQ-021: word length cap at 50 chars
  if (word.length > 50) {
    return { submittedWord: word, panelScore: MAX_PANEL_SCORE, verdict: "INVALID" };
  }

  // Empty / all-whitespace input
  if (word === "") {
    return { submittedWord: word, panelScore: MAX_PANEL_SCORE, verdict: "INVALID" };
  }

  // REQ-025: word used in an earlier sweep or tiebreak in this round
  if (usedWords.has(word)) {
    return { submittedWord: word, panelScore: MAX_PANEL_SCORE, verdict: "INVALID" };
  }

  // Affix mismatch
  if (!matchesAffix(word, puzzle.affixType, puzzle.affixValue)) {
    return { submittedWord: word, panelScore: MAX_PANEL_SCORE, verdict: "INVALID" };
  }

  // Not in answer list
  const answer = lookupAnswer(puzzle, word);
  if (!answer) {
    return { submittedWord: word, panelScore: MAX_PANEL_SCORE, verdict: "INVALID" };
  }

  return { submittedWord: word, panelScore: answer.panelScore, verdict: "VALID" };
}

// ---------------------------------------------------------------------------
// REQ-018: Auto-blank insertion (alarm timeout)
// ---------------------------------------------------------------------------

export function applyAutoBlank(): SweepRecord {
  return { submittedWord: null, panelScore: MAX_PANEL_SCORE, verdict: "TIMEOUT" };
}

// ---------------------------------------------------------------------------
// REQ-022: Round total computation
// ---------------------------------------------------------------------------

export function computeRoundTotals(players: PlayerRecord[]): number[] {
  return players.map((p) =>
    p.sweeps.reduce((sum, s) => sum + s.panelScore, 0),
  );
}

// ---------------------------------------------------------------------------
// REQ-023/024: Winner determination (also used for tiebreak rounds REQ-026/027)
// Accepts an array of scores indexed by "slot" positions (may be a subset
// of all slots when tiedSlots is active). Returns either a sole winner or a
// tie with the tied slot indices.
// ---------------------------------------------------------------------------

export type WinnerResult =
  | { type: "winner"; winnerSlot: number }
  | { type: "tie"; tiedSlots: number[] };

export function determineWinner(scores: number[]): WinnerResult {
  const min = Math.min(...scores);
  const tiedSlots = scores
    .map((s, i) => (s === min ? i : -1))
    .filter((i) => i !== -1);

  if (tiedSlots.length === 1) {
    return { type: "winner", winnerSlot: tiedSlots[0]! };
  }
  return { type: "tie", tiedSlots };
}

// ---------------------------------------------------------------------------
// REQ-030: Leaderboard rank assignment (standard competition ranking: 1,2,2,4)
// tiedWinnerSlots and isJointWinner come from the caller who tracks tiebreak state.
// ---------------------------------------------------------------------------

export function buildLeaderboard(
  players: PlayerRecord[],
  totals: number[],
  tiedWinnerSlots: number[] | null,
  isJointWinnerRound: boolean,
): LeaderboardEntry[] {
  const indexed = players.map((p, i) => ({
    slotIndex: p.slotIndex,
    displayName: p.displayName,
    roundTotal: totals[i] ?? 0,
    isJointWinner: isJointWinnerRound && (tiedWinnerSlots?.includes(p.slotIndex) ?? false),
    tiebreakRoundsPlayed: p.tiebreakSweeps.length,
  }));

  // Sort by total ascending
  const sorted = [...indexed].sort((a, b) => a.roundTotal - b.roundTotal);

  // Assign standard competition ranks
  const ranked: LeaderboardEntry[] = [];
  let rank = 1;
  for (let i = 0; i < sorted.length; i++) {
    const entry = sorted[i]!;
    // If same total as previous, carry the same rank
    if (i > 0 && entry.roundTotal === sorted[i - 1]!.roundTotal) {
      ranked.push({ ...entry, rank: ranked[i - 1]!.rank });
    } else {
      ranked.push({ ...entry, rank });
    }
    rank = i + 2; // next rank after ties = position after all ties
  }

  // Return sorted by original slot order for stable display
  return players.map((p) => {
    const e = ranked.find((r) => r.slotIndex === p.slotIndex)!;
    return e;
  });
}

// ---------------------------------------------------------------------------
// REQ-053: usedWords tracking
// ---------------------------------------------------------------------------

export function recordUsedWord(player: PlayerRecord, word: string | null): PlayerRecord {
  if (word === null) return player; // auto-blank not tracked
  const usedWords = new Set(player.usedWords);
  usedWords.add(normalize(word));
  return { ...player, usedWords };
}

export function isWordUsedByPlayer(player: PlayerRecord, word: string): boolean {
  return player.usedWords.has(normalize(word));
}

// ---------------------------------------------------------------------------
// REQ-033: Guest disconnect decrements connected count
// ---------------------------------------------------------------------------

export function decrPlayerCount(state: RoomState, slotIndex: number): RoomState {
  const players = state.players.map((p) =>
    p.slotIndex === slotIndex ? { ...p, isConnected: false } : p,
  );
  return { ...state, players };
}

// ---------------------------------------------------------------------------
// REQ-005: Display name validation at DO level
// ---------------------------------------------------------------------------

export function validateDisplayNameAtDo(rawName: string): { ok: true; name: string } | { ok: false } {
  const name = rawName.trim();
  if (name.length === 0 || name.length > 20) return { ok: false };
  return { ok: true, name };
}

// ---------------------------------------------------------------------------
// REQ-051: Display name duplicate disambiguation
// ---------------------------------------------------------------------------

export function disambiguateDisplayName(
  desiredName: string,
  existingNames: string[],
): string {
  const lower = existingNames.map((n) => n.toLowerCase());
  if (!lower.includes(desiredName.toLowerCase())) return desiredName;
  for (let suffix = 2; suffix <= 4; suffix++) {
    const candidate = `${desiredName}-${suffix}`;
    if (!lower.includes(candidate.toLowerCase())) return candidate;
  }
  return `${desiredName}-4`; // fallback (room has ≤4 players, so -4 is always free)
}
