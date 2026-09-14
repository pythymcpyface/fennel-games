// Shared types for the Lowball multiplayer relay — used by room-logic.ts (pure)
// and room.ts (DO class). No DOM, no Worker APIs.

import type { CategoryRule } from "./types.ts";

export type RoomPhase =
  | "lobby"
  | "sweep"
  | "between-sweeps"
  | "tiebreak"
  | "done";

export interface SweepRecord {
  submittedWord: string | null; // null = auto-blank / timeout
  panelScore: number; // 0–100; always 100 for auto-blank
  verdict: "VALID" | "INVALID" | "TIMEOUT";
}

export interface PlayerRecord {
  slotIndex: number; // 0–3
  displayName: string; // 1–20 chars, trimmed, disambiguated
  isHost: boolean;
  sweeps: SweepRecord[]; // length 0–2 (SWEEPS_TOTAL)
  tiebreakSweeps: SweepRecord[]; // length 0–2 (up to 2 tiebreak rounds)
  usedWords: Set<string>; // normalized words used across all sweeps + tiebreaks
  isConnected: boolean;
}

export interface RoomState {
  roomCode: string;
  players: PlayerRecord[];
  phase: RoomPhase;
  sweepIndex: number; // 0 or 1 for main sweeps
  tiebreakRoundNumber: number; // 0 = none, 1 = round 1, 2 = round 2
  tiedPlayerSlots: number[]; // slot indices of tied players (only populated during tiebreak)
  puzzleId: string | null;
  /**
   * TURN-BASED: slot index of the player whose turn it is right now.
   * Each turn gets its own fresh 30s deadline; the turn advances on submit or
   * timeout. -1 means no turn is active (lobby / between phases / done).
   */
  activePlayerSlot: number;
}

// ---------------------------------------------------------------------------
// Wire protocol — messages sent from DO to clients
// ---------------------------------------------------------------------------

export interface PlayerInfo {
  slotIndex: number;
  displayName: string;
  isHost: boolean;
}

export interface SweepReveal {
  slotIndex: number;
  displayName: string;
  submittedWord: string | null;
  panelScore: number;
  verdict: "VALID" | "INVALID" | "TIMEOUT";
  runningTotal: number;
}

export interface LeaderboardEntry {
  slotIndex: number;
  displayName: string;
  roundTotal: number;
  rank: number;
  isJointWinner: boolean;
  tiebreakRoundsPlayed: number;
}

export type ServerMessage =
  | { type: "joined"; slotIndex: number; displayName: string; isHost: boolean; players: PlayerInfo[] }
  | { type: "player-list"; players: PlayerInfo[]; roomPlayerCount: number }
  | { type: "start"; puzzleId: string; categoryLabel: string; parValue: number; rule: CategoryRule }
  | { type: "sweep-start"; sweepIndex: number; sweepDeadlineTimestamp: number; activeSlot: number }
  | { type: "tiebreak-start"; tiebreakRoundNumber: number; tiedSlots: number[]; sweepDeadlineTimestamp: number; activeSlot: number }
  | { type: "reveal"; reveal: SweepReveal }
  | { type: "leaderboard"; board: LeaderboardEntry[] }
  | { type: "host-left" }
  | { type: "error"; reason: string };

// ---------------------------------------------------------------------------
// Wire protocol — messages sent from clients to DO
// ---------------------------------------------------------------------------

export type ClientMessage =
  | { type: "create"; displayName: string }
  | { type: "join"; displayName: string }
  | { type: "start" }
  | { type: "submit"; word: string };
