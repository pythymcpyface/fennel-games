// Lowball multiplayer client — the ONLY file in the Lowball game that
// touches WebSocket APIs (REQ-042). All other modules (engine.ts, types.ts,
// share.ts, content-build.ts) remain network-free (REQ-060).
//
// This module owns:
// - WebSocket URL construction (REQ-038)
// - Room code normalization (REQ-046)
// - Client-side display name validation (REQ-004, REQ-062)
// - Message serialization / deserialization
// - WebSocket lifecycle (open, message, error, close)
// - Emitting typed ClientEvents to the plugin so plugin.ts stays WebSocket-free

import type { ServerMessage, ClientMessage } from "./mp-types.ts";

// Re-export wire types the plugin and share module need.
export type { ServerMessage, ClientMessage };

/** The leaderboard entry shape surfaced to the UI and share module. */
export interface MpLeaderboardEntry {
  slotIndex: number;
  displayName: string;
  roundTotal: number;
  rank: number;
  isJointWinner: boolean;
}

// ---------------------------------------------------------------------------
// REQ-038: Invite link / WebSocket URL construction
// ---------------------------------------------------------------------------

/** Construct the WebSocket URL for a room: wss://<base>/room/<code> */
export function buildWsUrl(relayBase: string, roomCode: string): string {
  const base = relayBase.endsWith("/") ? relayBase.slice(0, -1) : relayBase;
  return `${base}/room/${roomCode}`;
}

// ---------------------------------------------------------------------------
// REQ-046: Room code normalization (client-side, before WS open)
// ---------------------------------------------------------------------------

/** Trim and uppercase a manually-entered room code. */
export function normalizeRoomCode(raw: string): string {
  return raw.trim().toUpperCase();
}

// ---------------------------------------------------------------------------
// REQ-004 + REQ-062: Client-side display name validation
// ---------------------------------------------------------------------------

export interface ValidationResult {
  valid: boolean;
  error?: string;
  trimmed?: string;
}

export function validateDisplayName(raw: string): ValidationResult {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return { valid: false, error: "Display name cannot be empty." };
  }
  if (trimmed.length > 20) {
    return { valid: false, error: "Display name must be 20 characters or fewer." };
  }
  return { valid: true, trimmed };
}

// ---------------------------------------------------------------------------
// Message serialization helpers (pure JSON, no WS instance needed for tests)
// ---------------------------------------------------------------------------

/** Serialize a ClientMessage to a JSON string for sending over WS. */
export function serializeClientMessage(msg: ClientMessage): string {
  return JSON.stringify(msg);
}

/** Parse a raw WS message string into a ServerMessage. Returns null on malformed input. */
export function parseServerMessage(raw: string): ServerMessage | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;
    if (!("type" in parsed) || typeof (parsed as Record<string, unknown>)["type"] !== "string") {
      return null;
    }
    return parsed as ServerMessage;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// WebSocket lifecycle — MultiplayerClient class
// ---------------------------------------------------------------------------

/** Typed events emitted to the plugin. */
export type ClientEvent =
  | { kind: "open" }
  | { kind: "joined"; slotIndex: number; displayName: string; isHost: boolean }
  | { kind: "player-list"; players: { slotIndex: number; displayName: string; isHost: boolean }[]; count: number }
  | { kind: "start"; categoryLabel: string; parValue: number; affixType: string; affixValue: string }
  | { kind: "sweep-start"; sweepIndex: number; deadlineTs: number }
  | { kind: "tiebreak-start"; round: number; tiedSlots: number[]; deadlineTs: number }
  | { kind: "reveal"; slotIndex: number; displayName: string; word: string | null; score: number; verdict: string; runningTotal: number }
  | { kind: "leaderboard"; board: MpLeaderboardEntry[] }
  | { kind: "host-left" }
  | { kind: "error"; reason: string }
  | { kind: "close"; reason: string; code: number };

export type ClientEventHandler = (event: ClientEvent) => void;

/**
 * MultiplayerClient wraps a single WebSocket connection to the relay.
 * The plugin creates one instance per multiplayer session.
 *
 * NOTE: This class is the ONLY place in the lowball game codebase that
 * references the WebSocket constructor (REQ-042).
 */
export class MultiplayerClient {
  private ws: WebSocket | null = null;
  private handler: ClientEventHandler;

  constructor(handler: ClientEventHandler) {
    this.handler = handler;
  }

  /** Open a WebSocket to the relay, creating or joining a room. */
  connect(wsUrl: string): void {
    if (this.ws !== null) this.close();
    const ws = new WebSocket(wsUrl);
    this.ws = ws;

    ws.addEventListener("open", () => {
      this.handler({ kind: "open" });
    });

    ws.addEventListener("message", (event: MessageEvent<string>) => {
      const msg = parseServerMessage(event.data);
      if (msg === null) {
        // REQ-057: malformed message — log and ignore silently on client side
        console.warn("[lowball-mp] malformed server message:", event.data?.slice(0, 100));
        return;
      }
      this.dispatchServerMessage(msg);
    });

    ws.addEventListener("error", () => {
      this.handler({ kind: "error", reason: "WebSocket error" });
    });

    ws.addEventListener("close", (event: CloseEvent) => {
      this.ws = null;
      this.handler({ kind: "close", reason: event.reason ?? "", code: event.code });
    });
  }

  /** Send a typed message to the relay. */
  send(msg: ClientMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(serializeClientMessage(msg));
    }
  }

  /** Close the connection gracefully. */
  close(): void {
    this.ws?.close();
    this.ws = null;
  }

  // -------------------------------------------------------------------------
  // Dispatch: translate ServerMessage → ClientEvent
  // -------------------------------------------------------------------------

  private dispatchServerMessage(msg: ServerMessage): void {
    switch (msg.type) {
      case "joined":
        this.handler({ kind: "joined", slotIndex: msg.slotIndex, displayName: msg.displayName, isHost: msg.isHost });
        // Also emit initial player list
        this.handler({ kind: "player-list", players: msg.players, count: msg.players.length });
        break;

      case "player-list":
        this.handler({ kind: "player-list", players: msg.players, count: msg.roomPlayerCount });
        break;

      case "start":
        this.handler({
          kind: "start",
          categoryLabel: msg.categoryLabel,
          parValue: msg.parValue,
          affixType: msg.affixType,
          affixValue: msg.affixValue,
        });
        break;

      case "sweep-start":
        this.handler({ kind: "sweep-start", sweepIndex: msg.sweepIndex, deadlineTs: msg.sweepDeadlineTimestamp });
        break;

      case "tiebreak-start":
        this.handler({ kind: "tiebreak-start", round: msg.tiebreakRoundNumber, tiedSlots: msg.tiedSlots, deadlineTs: msg.sweepDeadlineTimestamp });
        break;

      case "reveal":
        this.handler({
          kind: "reveal",
          slotIndex: msg.reveal.slotIndex,
          displayName: msg.reveal.displayName,
          word: msg.reveal.submittedWord,
          score: msg.reveal.panelScore,
          verdict: msg.reveal.verdict,
          runningTotal: msg.reveal.runningTotal,
        });
        break;

      case "leaderboard":
        this.handler({
          kind: "leaderboard",
          board: msg.board.map((e: import("./mp-types.ts").LeaderboardEntry) => ({
            slotIndex: e.slotIndex,
            displayName: e.displayName,
            roundTotal: e.roundTotal,
            rank: e.rank,
            isJointWinner: e.isJointWinner,
          })),
        });
        break;

      case "host-left":
        this.handler({ kind: "host-left" });
        break;

      case "error":
        this.handler({ kind: "error", reason: msg.reason });
        break;
    }
  }
}
