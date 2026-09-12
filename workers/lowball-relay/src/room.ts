// LowballRelayDO — Cloudflare Durable Object that coordinates one multiplayer room.
//
// Architecture decisions:
// - All state in memory only (REQ-056: no Storage API calls).
// - WebSocket Hibernation API throughout (REQ-055: ctx.acceptWebSocket, not ws.accept()).
// - DO alarm() for sweep deadline (REQ-014, REQ-019).
// - Authoritative scoring via engine.ts imported from the main app (REQ-015).
// - Malformed messages send an error reply and are silently logged (REQ-057).
// - Content pack bundled at build time via wrangler import (REQ-029).
//
// State machine transitions:
// lobby → sweep(0) → sweep(1) → [tiebreak-1 →] [tiebreak-2 →] done
//
// REQs implemented: REQ-003, REQ-005, REQ-006, REQ-007, REQ-008, REQ-009,
// REQ-010, REQ-011, REQ-012, REQ-013, REQ-014, REQ-015, REQ-016, REQ-017,
// REQ-018, REQ-019, REQ-020, REQ-021, REQ-022, REQ-023, REQ-024, REQ-025,
// REQ-026, REQ-027, REQ-028, REQ-029, REQ-030, REQ-031, REQ-033, REQ-034,
// REQ-035, REQ-045, REQ-047, REQ-051, REQ-052, REQ-053, REQ-054, REQ-055,
// REQ-056, REQ-057, REQ-058, REQ-059

import type { DurableObject } from "@cloudflare/workers-types";
import {
  scoreSubmission,
  applyAutoBlank,
  computeRoundTotals,
  determineWinner,
  buildLeaderboard,
  recordUsedWord,
  decrPlayerCount,
  validateDisplayNameAtDo,
  disambiguateDisplayName,
  canStartGame,
} from "./room-logic.ts";
import type {
  PlayerRecord,
  RoomState,
  ServerMessage,
  ClientMessage,
  SweepRecord,
  LeaderboardEntry,
} from "../../../src/games/lowball/mp-types.ts";
import type { Puzzle } from "../../../src/games/lowball/types.ts";
// REQ-029: content pack bundled at Worker build time.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — JSON import resolved via wrangler build
import CONTENT_PACK_RAW from "../../../public/lowball.json" assert { type: "json" };
import { selectDailyPuzzleId } from "../../../src/games/lowball/engine.ts";

// ---------------------------------------------------------------------------
// Content pack types (mirrors ContentPack in plugin.ts)
// ---------------------------------------------------------------------------

interface ContentPack {
  contentPackVersion: string;
  datasetId: string;
  puzzleCount: number;
  puzzles: Puzzle[];
}

// REQ-029: fail fast if pack is unavailable at startup
const CONTENT_PACK = CONTENT_PACK_RAW as ContentPack;
if (!CONTENT_PACK || !Array.isArray(CONTENT_PACK.puzzles) || CONTENT_PACK.puzzles.length === 0) {
  throw new Error("[lowball-relay] Content pack missing or empty at startup");
}

function getPuzzleForDay(dayId: string): Puzzle | null {
  const pid = selectDailyPuzzleId(
    dayId,
    CONTENT_PACK.contentPackVersion,
    CONTENT_PACK.datasetId,
    CONTENT_PACK.puzzleCount,
  );
  if (!pid) return null;
  return CONTENT_PACK.puzzles.find((p) => p.puzzleId === pid) ?? null;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_PLAYERS = 4;
const SWEEP_DEADLINE_MS = 30_000;
const SWEEPS_TOTAL = 2;
const MAX_TIEBREAK_ROUNDS = 2;

// ---------------------------------------------------------------------------
// Durable Object class
// ---------------------------------------------------------------------------

export class LowballRelayDO implements DurableObject {
  private state: DurableObjectState;
  private roomState: RoomState | null = null;
  private puzzle: Puzzle | null = null;
  // NOTE: wsToSlot removed — plain Map is lost on DO hibernation.
  // Slot indices are now stored via ws.serializeAttachment() and read with
  // ws.deserializeAttachment() so they survive across hibernation/wake cycles.
  // (REQ-FIX-001 / BUG-1 root cause fix)

  constructor(state: DurableObjectState) {
    this.state = state;
  }

  // =========================================================================
  // Fetch — HTTP and WebSocket upgrade
  // =========================================================================

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // Lightweight probe used by the Worker to check room existence (REQ-007)
    if (url.pathname.startsWith("/probe/")) {
      const exists = this.roomState !== null;
      return new Response(exists ? "ok" : "not found", { status: exists ? 200 : 404 });
    }

    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("Expected WebSocket upgrade", { status: 426 });
    }

    // Parse display name from header (set by the Worker entry before routing)
    const rawName = request.headers.get("X-Display-Name") ?? url.searchParams.get("name") ?? "";
    const nameValidation = validateDisplayNameAtDo(rawName);
    if (!nameValidation.ok) {
      // REQ-005: INVALID_NAME — cannot close a WS before accepting it, so accept + close
      const { 0: client, 1: server } = new WebSocketPair();
      this.state.acceptWebSocket(server);
      server.send(JSON.stringify({ type: "error", reason: "INVALID_NAME" } satisfies ServerMessage));
      server.close(1008, "INVALID_NAME");
      return new Response(null, { status: 101, webSocket: client });
    }
    const displayName = nameValidation.name;

    // REQ-011: join-after-round-start
    if (this.roomState !== null && this.roomState.phase !== "lobby") {
      const { 0: client, 1: server } = new WebSocketPair();
      this.state.acceptWebSocket(server);
      server.send(JSON.stringify({ type: "error", reason: "ROOM_IN_PROGRESS" } satisfies ServerMessage));
      server.close(1008, "ROOM_IN_PROGRESS");
      return new Response(null, { status: 101, webSocket: client });
    }

    // REQ-006: room capacity
    const connectedCount = this.state.getWebSockets().length;
    if (connectedCount >= MAX_PLAYERS) {
      const { 0: client, 1: server } = new WebSocketPair();
      this.state.acceptWebSocket(server);
      server.send(JSON.stringify({ type: "error", reason: "ROOM_FULL" } satisfies ServerMessage));
      server.close(1008, "ROOM_FULL");
      return new Response(null, { status: 101, webSocket: client });
    }

    const { 0: client, 1: server } = new WebSocketPair();
    // REQ-055: use hibernation API
    this.state.acceptWebSocket(server);

    // Initialise room state on first connection
    const isHost = this.roomState === null;
    if (this.roomState === null) {
      const roomCode = url.pathname.split("/").pop() ?? "XXXXXX";
      this.roomState = {
        roomCode,
        players: [],
        phase: "lobby",
        sweepIndex: 0,
        tiebreakRoundNumber: 0,
        tiedPlayerSlots: [],
        puzzleId: null,
      };
      // REQ-047: lifecycle log
      console.log(`[lowball-relay] room-created roomCode=${roomCode}`);
    }

    const existingNames = this.roomState.players.map((p) => p.displayName);
    // REQ-051: disambiguate duplicate display names
    const resolvedName = disambiguateDisplayName(displayName, existingNames);

    const slotIndex = this.roomState.players.length; // 0-based, max 3
    const player: PlayerRecord = {
      slotIndex,
      displayName: resolvedName,
      isHost,
      sweeps: [],
      tiebreakSweeps: [],
      usedWords: new Set(),
      isConnected: true,
    };

    this.roomState = { ...this.roomState, players: [...this.roomState.players, player] };
    // REQ-FIX-001: persist slot index on the WS so it survives DO hibernation.
    // Previously used a plain Map (this.wsToSlot) which was wiped on every wake.
    (server as unknown as { serializeAttachment(v: unknown): void }).serializeAttachment({ slotIndex });

    // Confirm join to the new player
    const joinMsg: ServerMessage = {
      type: "joined",
      slotIndex,
      displayName: resolvedName,
      isHost,
      players: this.roomState.players.map((p) => ({
        slotIndex: p.slotIndex,
        displayName: p.displayName,
        isHost: p.isHost,
      })),
    };
    server.send(JSON.stringify(joinMsg));

    // REQ-008/REQ-059: broadcast updated player list to all
    this.broadcastPlayerList();
    // REQ-047
    console.log(`[lowball-relay] player-joined slot=${slotIndex} name=${resolvedName}`);

    return new Response(null, { status: 101, webSocket: client });
  }

  // =========================================================================
  // WebSocket Hibernation API handlers
  // =========================================================================

  webSocketMessage(ws: WebSocket, messageData: string | ArrayBuffer): void {
    // REQ-057: guard against non-string frames
    if (typeof messageData !== "string") {
      ws.send(JSON.stringify({ type: "error", reason: "Binary frames not supported" } satisfies ServerMessage));
      return;
    }

    let msg: ClientMessage;
    try {
      const raw: unknown = JSON.parse(messageData);
      if (typeof raw !== "object" || raw === null || typeof (raw as Record<string, unknown>)["type"] !== "string") {
        throw new Error("missing type");
      }
      msg = raw as ClientMessage;
    } catch {
      // REQ-057: malformed message — send error reply, do not crash
      ws.send(JSON.stringify({ type: "error", reason: "Malformed message" } satisfies ServerMessage));
      console.warn("[lowball-relay] malformed message received");
      return;
    }

    // REQ-FIX-001: read slotIndex from WS attachment (survives hibernation).
    const attachment = (ws as unknown as { deserializeAttachment(): unknown }).deserializeAttachment() as { slotIndex?: number } | null;
    const slotIndex = attachment?.slotIndex;
    if (slotIndex === undefined || this.roomState === null) return;

    switch (msg.type) {
      case "start":
        this.handleStart(ws, slotIndex);
        break;
      case "submit":
        this.handleSubmit(ws, slotIndex, msg.word);
        break;
      default:
        // Unknown message type — no-op
        break;
    }
  }

  webSocketClose(ws: WebSocket, code: number, reason: string): void {
    // REQ-FIX-001: read slotIndex from attachment (survives hibernation).
    const attachment = (ws as unknown as { deserializeAttachment(): unknown }).deserializeAttachment() as { slotIndex?: number } | null;
    const slotIndex = attachment?.slotIndex;
    if (slotIndex === undefined || this.roomState === null) return;

    const player = this.roomState.players.find((p) => p.slotIndex === slotIndex);
    if (!player) return;

    // REQ-047
    console.log(`[lowball-relay] player-disconnected slot=${slotIndex} code=${code}`);

    if (this.roomState.phase === "lobby") {
      // REQ-033: decrement count; REQ-059: broadcast updated list
      this.roomState = decrPlayerCount(this.roomState, slotIndex);
      this.broadcastPlayerList();
    } else {
      // In-round: auto-blank will fire at deadline (REQ-034).
      this.roomState = decrPlayerCount(this.roomState, slotIndex);
      if (player.isHost) {
        // REQ-035: host left during round — notify remaining players
        this.broadcastAll({ type: "host-left" });
        console.log(`[lowball-relay] host-left roomCode=${this.roomState.roomCode}`);
      }
    }
  }

  webSocketError(ws: WebSocket, error: unknown): void {
    console.error("[lowball-relay] ws error", error);
    this.webSocketClose(ws, 1011, "error");
  }

  // =========================================================================
  // Alarm — sweep deadline enforcement (REQ-014, REQ-018)
  // =========================================================================

  async alarm(): Promise<void> {
    if (this.roomState === null) return;

    const phase = this.roomState.phase;
    if (phase !== "sweep" && phase !== "tiebreak") return;

    // REQ-018: auto-blank all players who have not submitted this sweep
    this.applyPendingAutoBlanks();
    // REQ-047
    console.log(`[lowball-relay] sweep-completed sweepIndex=${this.roomState.sweepIndex} phase=${phase}`);

    await this.advanceSweepOrEnd();
  }

  // =========================================================================
  // Handle start-game (REQ-010, REQ-012, REQ-013)
  // =========================================================================

  private handleStart(ws: WebSocket, slotIndex: number): void {
    if (this.roomState === null) return;
    if (!canStartGame(this.roomState, slotIndex)) {
      ws.send(JSON.stringify({ type: "error", reason: slotIndex !== 0 ? "NOT_HOST" : "NEED_MORE_PLAYERS" } satisfies ServerMessage));
      return;
    }

    // Select today's puzzle
    const dayId = this.todayId();
    const p = getPuzzleForDay(dayId);
    if (!p) {
      ws.send(JSON.stringify({ type: "error", reason: "PUZZLE_NOT_FOUND" } satisfies ServerMessage));
      return;
    }
    this.puzzle = p;
    this.roomState = { ...this.roomState, phase: "sweep", sweepIndex: 0, puzzleId: p.puzzleId };

    // REQ-012: broadcast puzzle info
    this.broadcastAll({
      type: "start",
      puzzleId: p.puzzleId,
      categoryLabel: p.categoryLabel,
      parValue: p.parValue,
      affixType: p.affixType,
      affixValue: p.affixValue,
    });

    // REQ-013: broadcast sweep-start with deadline
    this.broadcastSweepStart(0);
  }

  // =========================================================================
  // Handle submission (REQ-015, REQ-016, REQ-017, REQ-020, REQ-053)
  // =========================================================================

  private handleSubmit(ws: WebSocket, slotIndex: number, rawWord: string): void {
    if (this.roomState === null || this.puzzle === null) return;

    const phase = this.roomState.phase;
    // REQ-020: reject submissions outside active sweep
    if (phase !== "sweep" && phase !== "tiebreak") {
      ws.send(JSON.stringify({ type: "error", reason: "WRONG_PHASE" } satisfies ServerMessage));
      return;
    }

    const player = this.roomState.players.find((p) => p.slotIndex === slotIndex);
    if (!player) return;

    // REQ-017: reject duplicate submission in same sweep
    const sweeps = phase === "sweep" ? player.sweeps : player.tiebreakSweeps;
    const currentSweepForPlayer = phase === "sweep" ? this.roomState.sweepIndex : this.roomState.tiebreakRoundNumber - 1;
    if (sweeps.length > currentSweepForPlayer) {
      ws.send(JSON.stringify({ type: "error", reason: "ALREADY_SUBMITTED" } satisfies ServerMessage));
      return;
    }

    // REQ-015: authoritative scoring (REQ-021 + REQ-025 handled inside scoreSubmission)
    const record = scoreSubmission(rawWord, this.puzzle, player.usedWords);

    // REQ-053: track used words
    const updatedPlayer = recordUsedWord(player, record.submittedWord);

    // Append sweep record
    const updatedSweeps = phase === "sweep"
      ? [...updatedPlayer.sweeps, record]
      : updatedPlayer.sweeps;
    const updatedTbSweeps = phase === "tiebreak"
      ? [...updatedPlayer.tiebreakSweeps, record]
      : updatedPlayer.tiebreakSweeps;

    const finalPlayer: PlayerRecord = { ...updatedPlayer, sweeps: updatedSweeps, tiebreakSweeps: updatedTbSweeps };
    this.roomState = {
      ...this.roomState,
      players: this.roomState.players.map((p) => p.slotIndex === slotIndex ? finalPlayer : p),
    };

    // REQ-016: live reveal broadcast
    const runningTotal = finalPlayer.sweeps.reduce((sum, s) => sum + s.panelScore, 0);
    this.broadcastAll({
      type: "reveal",
      reveal: {
        slotIndex,
        displayName: finalPlayer.displayName,
        submittedWord: record.submittedWord,
        panelScore: record.panelScore,
        verdict: record.verdict,
        runningTotal,
      },
    });

    // REQ-019: early advance when all active players have submitted
    this.checkEarlyAdvance();
  }

  // =========================================================================
  // Sweep advance / end-of-round logic
  // =========================================================================

  private async broadcastSweepStart(sweepIndex: number): Promise<void> {
    const now = Date.now();
    const deadline = now + SWEEP_DEADLINE_MS;
    // REQ-014: schedule alarm
    await this.state.storage.setAlarm(deadline);
    this.broadcastAll({ type: "sweep-start", sweepIndex, sweepDeadlineTimestamp: deadline });
    // REQ-047
    console.log(`[lowball-relay] sweep-started sweepIndex=${sweepIndex} deadline=${deadline}`);
  }

  private applyPendingAutoBlanks(): void {
    if (this.roomState === null) return;
    const phase = this.roomState.phase;
    const updatedPlayers = this.roomState.players.map((p) => {
      if (!p.isConnected) {
        // Player already disconnected — auto-blank applies at deadline (REQ-034)
      }
      const sweeps = phase === "sweep" ? p.sweeps : p.tiebreakSweeps;
      const expectedLength = phase === "sweep"
        ? this.roomState!.sweepIndex + 1
        : this.roomState!.tiebreakRoundNumber;

      if (sweeps.length >= expectedLength) return p; // already submitted

      const blank = applyAutoBlank();
      // REQ-053: null word not recorded in usedWords (applyAutoBlank returns submittedWord=null)
      if (phase === "sweep") {
        return { ...p, sweeps: [...p.sweeps, blank] };
      } else {
        return { ...p, tiebreakSweeps: [...p.tiebreakSweeps, blank] };
      }
    });

    this.roomState = { ...this.roomState, players: updatedPlayers };

    // Broadcast auto-blanks (REQ-016 — same broadcast path as normal submissions)
    for (const p of updatedPlayers) {
      const sweeps = phase === "sweep" ? p.sweeps : p.tiebreakSweeps;
      const last = sweeps[sweeps.length - 1];
      if (last?.verdict === "TIMEOUT") {
        this.broadcastAll({
          type: "reveal",
          reveal: {
            slotIndex: p.slotIndex,
            displayName: p.displayName,
            submittedWord: null,
            panelScore: 100,
            verdict: "TIMEOUT",
            runningTotal: p.sweeps.reduce((s, sw) => s + sw.panelScore, 0),
          },
        });
      }
    }
  }

  private checkEarlyAdvance(): void {
    if (this.roomState === null) return;
    const phase = this.roomState.phase;
    if (phase !== "sweep" && phase !== "tiebreak") return; // guard: already advancing
    const connectedPlayers = this.roomState.players.filter((p) => p.isConnected);

    const allSubmitted = connectedPlayers.every((p) => {
      const sweeps = phase === "sweep" ? p.sweeps : p.tiebreakSweeps;
      const expected = phase === "sweep"
        ? this.roomState!.sweepIndex + 1
        : this.roomState!.tiebreakRoundNumber;
      return sweeps.length >= expected;
    });

    if (allSubmitted) {
      // Cancel alarm and advance immediately (REQ-019).
      // Mark phase as "between-sweeps" before the async advance to prevent the
      // alarm callback from triggering a second advance if it fires concurrently.
      // Cloudflare DO guarantees serial event-loop execution, but the explicit guard
      // makes the intent unambiguous.
      this.roomState = { ...this.roomState, phase: "between-sweeps" };
      void this.state.storage.deleteAlarm?.();
      void this.advanceSweepOrEnd();
    }
  }

  private async advanceSweepOrEnd(): Promise<void> {
    if (this.roomState === null) return;

    // Accept both "sweep" and "between-sweeps" (the guard phase set by checkEarlyAdvance)
    if (this.roomState.phase === "sweep" || this.roomState.phase === "between-sweeps") {
      const nextSweep = this.roomState.sweepIndex + 1;
      if (nextSweep < SWEEPS_TOTAL) {
        this.roomState = { ...this.roomState, phase: "sweep", sweepIndex: nextSweep };
        await this.broadcastSweepStart(nextSweep);
      } else {
        // Both sweeps complete — evaluate winner
        await this.evaluateRoundEnd();
      }
    } else if (this.roomState.phase === "tiebreak") {
      await this.evaluateTiebreakEnd();
    }
  }

  private async evaluateRoundEnd(): Promise<void> {
    if (this.roomState === null || this.puzzle === null) return;

    const totals = computeRoundTotals(this.roomState.players);
    const result = determineWinner(totals);

    if (result.type === "winner") {
      // REQ-023: unique lowest total → leaderboard
      const board = buildLeaderboard(this.roomState.players, totals, null, false);
      this.roomState = { ...this.roomState, phase: "done" };
      this.broadcastLeaderboard(board);
    } else {
      // REQ-024: tie → enter tiebreak round 1
      this.roomState = {
        ...this.roomState,
        phase: "tiebreak",
        tiebreakRoundNumber: 1,
        tiedPlayerSlots: result.tiedSlots,
      };
      const now = Date.now();
      const deadline = now + SWEEP_DEADLINE_MS;
      await this.state.storage.setAlarm(deadline);
      this.broadcastAll({
        type: "tiebreak-start",
        tiebreakRoundNumber: 1,
        tiedSlots: result.tiedSlots,
        sweepDeadlineTimestamp: deadline,
      });
      // REQ-047
      console.log(`[lowball-relay] tiebreak-started round=1 tiedSlots=${JSON.stringify(result.tiedSlots)}`);
    }
  }

  private async evaluateTiebreakEnd(): Promise<void> {
    if (this.roomState === null) return;

    const tiedPlayers = this.roomState.players.filter((p) =>
      this.roomState!.tiedPlayerSlots.includes(p.slotIndex),
    );
    const tbScores = tiedPlayers.map((p) => {
      const round = this.roomState!.tiebreakRoundNumber;
      return p.tiebreakSweeps[round - 1]?.panelScore ?? 100;
    });

    const result = determineWinner(tbScores);
    const mainTotals = computeRoundTotals(this.roomState.players);

    if (result.type === "winner") {
      // Map local-index winner back to global slot
      const winnerSlot = tiedPlayers[result.winnerSlot]?.slotIndex ?? 0;
      // Build leaderboard using adjustedTotals so the tiebreak winner ranks above
      // the other tied players even though their main-round totals are equal.
      // The tiny +0.001 nudge is only for ordering — never displayed.
      const adjustedTotals = mainTotals.map((t, i) =>
        tiedPlayers.some((p) => p.slotIndex === i && i !== winnerSlot) ? t + 0.001 : t,
      );
      const board = buildLeaderboard(
        this.roomState.players,
        adjustedTotals,          // use adjusted totals for rank ordering
        null,
        false,
      );
      // Rewrite display totals back to the true main-round values (no fractions shown)
      const finalBoard = board.map((e) => ({
        ...e,
        roundTotal: mainTotals[e.slotIndex] ?? e.roundTotal,
        rank: e.slotIndex === winnerSlot ? 1 : e.rank <= 1 ? 2 : e.rank,
        isJointWinner: false,
      }));
      this.roomState = { ...this.roomState, phase: "done" };
      this.broadcastLeaderboard(finalBoard);
    } else if (this.roomState.tiebreakRoundNumber < MAX_TIEBREAK_ROUNDS) {
      // REQ-027: advance to round 2
      const nextRound = this.roomState.tiebreakRoundNumber + 1;
      this.roomState = {
        ...this.roomState,
        tiebreakRoundNumber: nextRound,
        tiedPlayerSlots: result.tiedSlots.map((i) => tiedPlayers[i]?.slotIndex ?? i),
      };
      const now = Date.now();
      const deadline = now + SWEEP_DEADLINE_MS;
      await this.state.storage.setAlarm(deadline);
      this.broadcastAll({
        type: "tiebreak-start",
        tiebreakRoundNumber: nextRound,
        tiedSlots: this.roomState.tiedPlayerSlots,
        sweepDeadlineTimestamp: deadline,
      });
    } else {
      // REQ-028: 2 rounds exhausted → joint winners
      const jointSlots = result.tiedSlots.map((i) => tiedPlayers[i]?.slotIndex ?? i);
      const board = buildLeaderboard(this.roomState.players, mainTotals, jointSlots, true);
      this.roomState = { ...this.roomState, phase: "done" };
      this.broadcastLeaderboard(board);
    }

    console.log(`[lowball-relay] round-complete roomCode=${this.roomState.roomCode}`);
  }

  // =========================================================================
  // Broadcast helpers
  // =========================================================================

  private broadcastAll(msg: ServerMessage): void {
    const json = JSON.stringify(msg);
    for (const ws of this.state.getWebSockets()) {
      try { ws.send(json); } catch { /* ignore closed sockets */ }
    }
  }

  private broadcastPlayerList(): void {
    if (this.roomState === null) return;
    const players = this.roomState.players
      .filter((p) => p.isConnected)
      .map((p) => ({ slotIndex: p.slotIndex, displayName: p.displayName, isHost: p.isHost }));
    this.broadcastAll({
      type: "player-list",
      players,
      roomPlayerCount: players.length,
    });
  }

  private broadcastLeaderboard(board: LeaderboardEntry[]): void {
    this.broadcastAll({ type: "leaderboard", board });
    console.log(`[lowball-relay] leaderboard-broadcast roomCode=${this.roomState?.roomCode}`);
  }

  // =========================================================================
  // Helpers
  // =========================================================================

  private todayId(): string {
    const d = new Date();
    const y = d.getUTCFullYear().toString().padStart(4, "0");
    const m = (d.getUTCMonth() + 1).toString().padStart(2, "0");
    const day = d.getUTCDate().toString().padStart(2, "0");
    return `${y}-${m}-${day}`;
  }
}
