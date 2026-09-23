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
  LeaderboardEntry,
} from "../../../src/games/lowball/mp-types.ts";
import type { Puzzle } from "../../../src/games/lowball/types.ts";
// REQ-029: content pack bundled at Worker build time.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — JSON import resolved via wrangler build
import CONTENT_PACK_RAW from "../../../public/lowball.json" assert { type: "json" };
import CONTENT_PACK_COUNTRIES_RAW from "../../../public/lowball-countries.json" assert { type: "json" };
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
const CONTENT_PACK_COUNTRIES = CONTENT_PACK_COUNTRIES_RAW as ContentPack;
if (!CONTENT_PACK || !Array.isArray(CONTENT_PACK.puzzles) || CONTENT_PACK.puzzles.length === 0) {
  throw new Error("[lowball-relay] Content pack missing or empty at startup");
}

function getPuzzleForDay(dayId: string, gameId: RoomState["gameId"]): Puzzle | null {
  const pack = gameId === "lowball-countries" ? CONTENT_PACK_COUNTRIES : CONTENT_PACK;
  const pid = selectDailyPuzzleId(
    dayId,
    pack.contentPackVersion,
    pack.datasetId,
    pack.puzzleCount,
  );
  if (!pid) return null;
  return pack.puzzles.find((p) => p.puzzleId === pid) ?? null;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_PLAYERS = 4;
const SWEEP_DEADLINE_MS = 30_000;
const BETWEEN_SWEEPS_MS = 5_000;
const SWEEPS_TOTAL = 2;
const MAX_TIEBREAK_ROUNDS = 2;

// ---------------------------------------------------------------------------
// Durable Object class
// ---------------------------------------------------------------------------

/** Storage key for the persisted room state. */
const ROOM_STATE_KEY = "roomState";

/**
 * JSON-safe mirror of RoomState. `usedWords` is a Set on the live object,
 * which does not survive JSON serialization, so it is stored as an array.
 */
interface PersistedRoomState extends Omit<RoomState, "players"> {
  players: (Omit<PlayerRecord, "usedWords"> & { usedWords: string[] })[];
}

function toPersisted(state: RoomState): PersistedRoomState {
  return {
    ...state,
    players: state.players.map((p) => ({ ...p, usedWords: [...p.usedWords] })),
  };
}

function fromPersisted(state: PersistedRoomState): RoomState {
  return {
    ...state,
    // Rooms created before variant routing was introduced are standard Lowball.
    gameId: state.gameId ?? "lowball",
    players: state.players.map((p) => ({ ...p, usedWords: new Set(p.usedWords) })),
  };
}

export class LowballRelayDO implements DurableObject {
  private state: DurableObjectState;
  private roomState: RoomState | null = null;
  private puzzle: Puzzle | null = null;
  /** True once roomState has been hydrated from storage in this wake cycle. */
  private loaded = false;
  // NOTE: wsToSlot removed — plain Map is lost on DO hibernation.
  // Slot indices are stored via ws.serializeAttachment() / deserializeAttachment().
  //
  // REQ-FIX-002 / BUG-3: roomState itself must ALSO survive hibernation. It was
  // previously an in-memory-only field, so when the DO hibernated (which happens
  // within seconds of idle — e.g. the host switching tabs to copy the invite link)
  // roomState reset to null while the sockets stayed open. The next joiner was then
  // treated as a brand-new host in an empty room, orphaning the real host.
  // roomState is now persisted to DO storage on every mutation and rehydrated on wake.

  constructor(state: DurableObjectState) {
    this.state = state;
  }

  // =========================================================================
  // State persistence (REQ-FIX-002)
  // =========================================================================

  /** Hydrate roomState from storage. Must be awaited before any handler reads it. */
  private async load(): Promise<void> {
    if (this.loaded) return;
    const stored = await this.state.storage.get<PersistedRoomState>(ROOM_STATE_KEY);
    this.roomState = stored ? fromPersisted(stored) : null;
    this.loaded = true;
  }

  /** Persist the current roomState. Call after every mutation. */
  private async save(): Promise<void> {
    if (this.roomState === null) {
      await this.state.storage.delete(ROOM_STATE_KEY);
      return;
    }
    await this.state.storage.put(ROOM_STATE_KEY, toPersisted(this.roomState));
  }

  // =========================================================================
  // Fetch — HTTP and WebSocket upgrade
  // =========================================================================

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // REQ-FIX-002: hydrate persisted state before ANY decision that depends on it
    // (notably the isHost determination below).
    await this.load();

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

    // REQ-006: room capacity — count CONNECTED players in the roster rather than
    // raw socket count, which can include sockets that are already closing.
    const connectedCount = this.roomState?.players.filter((p) => p.isConnected).length ?? 0;
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
    if (this.roomState === null) {
      const roomCode = url.pathname.split("/").pop() ?? "XXXXXX";
      const requestedGameId = url.searchParams.get("gameId");
      this.roomState = {
        roomCode,
        gameId: requestedGameId === "lowball-countries" ? "lowball-countries" : "lowball",
        players: [],
        phase: "lobby",
        sweepIndex: 0,
        tiebreakRoundNumber: 0,
        tiedPlayerSlots: [],
        puzzleId: null,
        activePlayerSlot: -1,
      };
      // REQ-047: lifecycle log
      console.log(`[lowball-relay] room-created roomCode=${roomCode}`);
    }

    const requestedGameId = url.searchParams.get("gameId") ?? "lowball";
    if (requestedGameId !== this.roomState.gameId) {
      const { 0: mismatchClient, 1: mismatchServer } = new WebSocketPair();
      this.state.acceptWebSocket(mismatchServer);
      mismatchServer.send(JSON.stringify({ type: "error", reason: "GAME_VARIANT_MISMATCH" } satisfies ServerMessage));
      mismatchServer.close(1008, "GAME_VARIANT_MISMATCH");
      return new Response(null, { status: 101, webSocket: mismatchClient });
    }

    const existingNames = this.roomState.players.map((p) => p.displayName);
    // REQ-051: disambiguate duplicate display names
    const resolvedName = disambiguateDisplayName(displayName, existingNames);

    // REQ-FIX-003: derive the slot from the lowest FREE index, not players.length.
    // decrPlayerCount marks departed players isConnected:false but keeps the record,
    // so players.length counts ghosts and would hand out a colliding slotIndex —
    // shadowing a live player (and making broadcastPlayerList, which filters on
    // isConnected, report a smaller count than reality).
    const usedSlots = new Set(
      this.roomState.players.filter((p) => p.isConnected).map((p) => p.slotIndex),
    );
    let slotIndex = 0;
    while (usedSlots.has(slotIndex)) slotIndex += 1;

    // REQ-FIX-003: host is whoever currently holds the host flag among CONNECTED
    // players. Deriving it from `roomState === null` was fragile: any state loss
    // silently promoted an arriving guest to host and orphaned the real one.
    // Electing only when no connected host exists makes that impossible.
    const hasLiveHost = this.roomState.players.some((p) => p.isConnected && p.isHost);
    const isHost = !hasLiveHost;

    const player: PlayerRecord = {
      slotIndex,
      displayName: resolvedName,
      isHost,
      sweeps: [],
      tiebreakSweeps: [],
      usedWords: new Set(),
      isConnected: true,
    };

    // REQ-FIX-003: drop any stale record occupying this slot before re-adding,
    // so repeated join/leave cycles cannot accumulate ghost players.
    const withoutStale = this.roomState.players.filter((p) => p.slotIndex !== slotIndex);
    this.roomState = { ...this.roomState, players: [...withoutStale, player] };
    // REQ-FIX-001: persist slot index on the WS so it survives DO hibernation.
    (server as unknown as { serializeAttachment(v: unknown): void }).serializeAttachment({ slotIndex });
    // REQ-FIX-002: persist the roster so the next wake sees this player.
    await this.save();

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

  async webSocketMessage(ws: WebSocket, messageData: string | ArrayBuffer): Promise<void> {
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

    // REQ-FIX-002: rehydrate state before handling (DO may have hibernated).
    await this.load();

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
      case "next":
        if (this.roomState.phase === "between-sweeps" && this.roomState.players.find((p) => p.slotIndex === slotIndex)?.isHost) {
          await this.beginNextSweep();
        }
        break;
      default:
        // Unknown message type — no-op
        break;
    }

    // REQ-FIX-002: persist any mutation the handler made.
    await this.save();
  }

  async webSocketClose(ws: WebSocket, code: number, _reason: string): Promise<void> {
    // REQ-FIX-002: rehydrate before mutating.
    await this.load();

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

    // If nobody is left connected, drop the room entirely so a stale roster
    // cannot outlive the session and block a fresh room on the same code.
    const anyConnected = this.roomState.players.some((p) => p.isConnected);
    if (!anyConnected) {
      this.roomState = null;
      console.log(`[lowball-relay] room-empty — state cleared`);
    }

    await this.save();
  }

  async webSocketError(ws: WebSocket, error: unknown): Promise<void> {
    console.error("[lowball-relay] ws error", error);
    await this.webSocketClose(ws, 1011, "error");
  }

  // =========================================================================
  // Alarm — sweep deadline enforcement (REQ-014, REQ-018)
  // =========================================================================

  async alarm(): Promise<void> {
    // REQ-FIX-002: the alarm fires on a cold DO after hibernation — hydrate first.
    await this.load();
    if (this.roomState === null) return;

    const phase = this.roomState.phase;
    if (phase === "between-sweeps") {
      await this.beginNextSweep();
      await this.save();
      return;
    }
    if (phase !== "sweep" && phase !== "tiebreak") return;

    // TURN-BASED: the alarm is the ACTIVE player's 30s expiring. Auto-blank only
    // that player (REQ-018) — everyone else still gets their own full window —
    // then hand on the turn.
    const active = this.roomState.activePlayerSlot;
    if (active < 0) return;
    this.autoBlankSlot(active);
    console.log(`[lowball-relay] turn-timeout slot=${active} phase=${phase}`);

    await this.advanceTurn();
    await this.save();
  }

  /** Record a timeout answer for one slot in the current phase (REQ-018). */
  private autoBlankSlot(slot: number): void {
    if (this.roomState === null) return;
    const isTiebreak = this.roomState.phase === "tiebreak";
    const need = this.expectedAnswers();
    const players = this.roomState.players.map((p) => {
      if (p.slotIndex !== slot) return p;
      const given = isTiebreak ? p.tiebreakSweeps.length : p.sweeps.length;
      if (given >= need) return p; // already answered
      const blank = applyAutoBlank();
      return isTiebreak
        ? { ...p, tiebreakSweeps: [...p.tiebreakSweeps, blank] }
        : { ...p, sweeps: [...p.sweeps, blank] };
    });
    this.roomState = { ...this.roomState, players };

    const p = this.roomState.players.find((x) => x.slotIndex === slot);
    if (!p) return;
    const list = isTiebreak ? p.tiebreakSweeps : p.sweeps;
    const last = list[list.length - 1];
    if (last?.verdict === "TIMEOUT") {
      this.broadcastAll({
        type: "reveal",
        reveal: {
          slotIndex: slot,
          displayName: p.displayName,
          submittedWord: null,
          panelScore: 100,
          verdict: "TIMEOUT",
          runningTotal: p.sweeps.reduce((sum, sw) => sum + sw.panelScore, 0),
        },
      });
    }
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
    const p = getPuzzleForDay(dayId, this.roomState.gameId);
    if (!p) {
      ws.send(JSON.stringify({ type: "error", reason: "PUZZLE_NOT_FOUND" } satisfies ServerMessage));
      return;
    }
    this.puzzle = p;
    this.roomState = { ...this.roomState, phase: "sweep", sweepIndex: 0, puzzleId: p.puzzleId, activePlayerSlot: -1 };

    // REQ-012: broadcast puzzle info
    this.broadcastAll({
      type: "start",
      puzzleId: p.puzzleId,
      categoryLabel: p.categoryLabel,
      parValue: p.parValue,
      rule: p.rule,
    });

    // TURN-BASED: hand the first turn to the lowest connected slot with its own
    // fresh 30s window. Each subsequent turn restarts the timer (see beginTurn).
    const first = this.nextTurnSlot(-1);
    if (first !== null) void this.beginTurn(first);
  }

  // =========================================================================
  // Handle submission (REQ-015, REQ-016, REQ-017, REQ-020, REQ-053)
  // =========================================================================

  /**
   * Resolve the active puzzle. `this.puzzle` is an in-memory cache that is lost
   * on hibernation, so fall back to looking it up from the persisted puzzleId.
   * (REQ-FIX-002)
   */
  private activePuzzle(): Puzzle | null {
    if (this.puzzle !== null) return this.puzzle;
    const pid = this.roomState?.puzzleId;
    if (!pid) return null;
    const pack = this.roomState?.gameId === "lowball-countries" ? CONTENT_PACK_COUNTRIES : CONTENT_PACK;
    this.puzzle = pack.puzzles.find((p) => p.puzzleId === pid) ?? null;
    return this.puzzle;
  }

  private handleSubmit(ws: WebSocket, slotIndex: number, rawWord: string): void {
    const puzzle = this.activePuzzle();
    if (this.roomState === null || puzzle === null) return;

    const phase = this.roomState.phase;
    // REQ-020: reject submissions outside active sweep
    if (phase !== "sweep" && phase !== "tiebreak") {
      ws.send(JSON.stringify({ type: "error", reason: "WRONG_PHASE" } satisfies ServerMessage));
      return;
    }

    const player = this.roomState.players.find((p) => p.slotIndex === slotIndex);
    if (!player) return;

    // TURN-BASED: reject submissions from anyone but the active player, so a
    // fast player cannot consume another player's turn or timer.
    if (this.roomState.activePlayerSlot !== slotIndex) {
      ws.send(JSON.stringify({ type: "error", reason: "NOT_YOUR_TURN" } satisfies ServerMessage));
      return;
    }

    // REQ-017: reject duplicate submission in same sweep
    const sweeps = phase === "sweep" ? player.sweeps : player.tiebreakSweeps;
    const currentSweepForPlayer = phase === "sweep" ? this.roomState.sweepIndex : this.roomState.tiebreakRoundNumber - 1;
    if (sweeps.length > currentSweepForPlayer) {
      ws.send(JSON.stringify({ type: "error", reason: "ALREADY_SUBMITTED" } satisfies ServerMessage));
      return;
    }

    // REQ-015: authoritative scoring (REQ-021 + REQ-025 handled inside scoreSubmission)
    const record = scoreSubmission(rawWord, puzzle, player.usedWords);

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

    // TURN-BASED: this player is done; give the next player a fresh 30s turn.
    void this.advanceTurn();
  }

  // =========================================================================
  // Sweep advance / end-of-round logic
  // =========================================================================

  // =========================================================================
  // TURN ORDER (turn-based play: one player at a time, 30s each)
  // =========================================================================

  /**
   * Slots eligible to take a turn in the current phase, in ascending slot order.
   * Main sweeps: every connected player. Tiebreak: only the tied players.
   */
  private turnOrder(): number[] {
    if (this.roomState === null) return [];
    const connected = this.roomState.players
      .filter((p) => p.isConnected)
      .map((p) => p.slotIndex)
      .sort((a, b) => a - b);
    if (this.roomState.phase === "tiebreak") {
      return connected.filter((slot) => this.roomState!.tiedPlayerSlots.includes(slot));
    }
    return connected;
  }

  /** How many answers `slot` has recorded for the current phase. */
  private answersGiven(slot: number): number {
    if (this.roomState === null) return 0;
    const p = this.roomState.players.find((x) => x.slotIndex === slot);
    if (!p) return 0;
    return this.roomState.phase === "tiebreak" ? p.tiebreakSweeps.length : p.sweeps.length;
  }

  /** Answers each eligible player should have once the current round is complete. */
  private expectedAnswers(): number {
    if (this.roomState === null) return 0;
    return this.roomState.phase === "tiebreak"
      ? this.roomState.tiebreakRoundNumber
      : this.roomState.sweepIndex + 1;
  }

  /**
   * Next slot still owing an answer this round, or null when everyone has gone.
   * Starts looking AFTER `afterSlot` so turns rotate in order.
   */
  private nextTurnSlot(afterSlot: number): number | null {
    const order = this.turnOrder();
    if (order.length === 0) return null;
    const need = this.expectedAnswers();
    const start = order.findIndex((s) => s > afterSlot);
    const rotated = start === -1 ? order : [...order.slice(start), ...order.slice(0, start)];
    for (const slot of rotated) {
      if (this.answersGiven(slot) < need) return slot;
    }
    return null;
  }

  /**
   * Give `slot` the turn with a FRESH 30s deadline, and tell every client.
   * This is the heart of turn-based play: the timer restarts per player, so a
   * later player never inherits a partially-elapsed window.
   */
  private async beginTurn(slot: number): Promise<void> {
    if (this.roomState === null) return;
    this.roomState = { ...this.roomState, activePlayerSlot: slot };
    const deadline = Date.now() + SWEEP_DEADLINE_MS;
    await this.state.storage.setAlarm(deadline);
    const isTiebreak = this.roomState.phase === "tiebreak";
    if (isTiebreak) {
      this.broadcastAll({
        type: "tiebreak-start",
        tiebreakRoundNumber: this.roomState.tiebreakRoundNumber,
        tiedSlots: this.roomState.tiedPlayerSlots,
        sweepDeadlineTimestamp: deadline,
        activeSlot: slot,
      });
    } else {
      this.broadcastAll({
        type: "sweep-start",
        sweepIndex: this.roomState.sweepIndex,
        sweepDeadlineTimestamp: deadline,
        activeSlot: slot,
      });
    }
    console.log(`[lowball-relay] turn-started slot=${slot} phase=${this.roomState.phase} deadline=${deadline}`);
  }

  /**
   * Hand the turn to the next player, or finish the round if nobody is left.
   * Called after a submission and after a turn times out.
   */
  private async advanceTurn(): Promise<void> {
    if (this.roomState === null) return;
    const next = this.nextTurnSlot(this.roomState.activePlayerSlot);
    if (next !== null) {
      await this.beginTurn(next);
      return;
    }
    // Everyone eligible has answered for this round.
    this.roomState = { ...this.roomState, activePlayerSlot: -1 };
    if (this.roomState.phase === "tiebreak") {
      await this.evaluateTiebreakEnd();
      return;
    }
    const nextSweep = this.roomState.sweepIndex + 1;
    if (nextSweep < SWEEPS_TOTAL) {
      this.roomState = { ...this.roomState, phase: "between-sweeps", activePlayerSlot: -1 };
      await this.state.storage.setAlarm(Date.now() + BETWEEN_SWEEPS_MS);
      this.broadcastAll({
        type: "between-sweeps",
        nextSweepIndex: nextSweep,
        deadlineTimestamp: Date.now() + BETWEEN_SWEEPS_MS,
        canAdvance: true,
      });
    } else {
      await this.evaluateRoundEnd();
    }
  }

  private async beginNextSweep(): Promise<void> {
    if (this.roomState === null || this.roomState.phase !== "between-sweeps") return;
    const nextSweep = this.roomState.sweepIndex + 1;
    this.roomState = { ...this.roomState, phase: "sweep", sweepIndex: nextSweep };
    const first = this.nextTurnSlot(-1);
    if (first !== null) await this.beginTurn(first);
  }

  private async evaluateRoundEnd(): Promise<void> {
    if (this.roomState === null || this.activePuzzle() === null) return;

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
        activePlayerSlot: -1,
      };
      // REQ-047
      console.log(`[lowball-relay] tiebreak-started round=1 tiedSlots=${JSON.stringify(result.tiedSlots)}`);
      // TURN-BASED: first tied player gets their own fresh 30s.
      const first = this.nextTurnSlot(-1);
      if (first !== null) await this.beginTurn(first);
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
        activePlayerSlot: -1,
      };
      // TURN-BASED: first tied player of the new round gets a fresh 30s.
      const firstR2 = this.nextTurnSlot(-1);
      if (firstR2 !== null) await this.beginTurn(firstR2);
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
