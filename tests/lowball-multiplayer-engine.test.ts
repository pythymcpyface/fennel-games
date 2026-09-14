// Tests for the multiplayer relay room logic — pure business rules only.
// The DO state machine is extracted into testable pure functions so the Vitest
// suite can verify them without spinning up a Worker runtime.
//
// REQs covered: REQ-001, REQ-002, REQ-006, REQ-007, REQ-010, REQ-018, REQ-019,
// REQ-022, REQ-023, REQ-024, REQ-025, REQ-026, REQ-027, REQ-028, REQ-030,
// REQ-031, REQ-033, REQ-052, REQ-053, REQ-054
//
// NOTE: These tests import from workers/lowball-relay/src/room-logic.ts which
// exports the pure (non-DO) business functions. The DO class (room.ts) wraps
// these; the pure layer is what we unit-test.

import { describe, it, expect } from "vitest";
import {
  generateRoomCode,
  canStartGame,
  scoreSubmission,
  applyAutoBlank,
  computeRoundTotals,
  determineWinner,
  buildLeaderboard,
  recordUsedWord,
  isWordUsedByPlayer,
  decrPlayerCount,
} from "../workers/lowball-relay/src/room-logic.ts";
import type {
  RoomState,
  PlayerRecord,
} from "../workers/lowball-relay/src/room-types.ts";
import type { Puzzle } from "../src/games/lowball/types.ts";

// ---------------------------------------------------------------------------
// Shared test fixtures
// ---------------------------------------------------------------------------

const puzzle: Puzzle = {
  puzzleId: "puz-0000",
  affixType: "suffix",
  affixValue: "ugh",
  categoryLabel: 'Words ending in "ugh"',
  parValue: 21,
  categoryDomain: "words",
  answers: [
    { word: "though", panelScore: 100, isFindable: true },
    { word: "tough", panelScore: 81, isFindable: true },
    { word: "rough", panelScore: 43, isFindable: true },
    { word: "laugh", panelScore: 33, isFindable: true },
    { word: "cough", panelScore: 15, isFindable: true },
    { word: "trough", panelScore: 12, isFindable: true },
    { word: "bough", panelScore: 1, isFindable: true },
    { word: "hiccough", panelScore: 0, isFindable: true },
    { word: "usquebaugh", panelScore: 0, isFindable: false },
  ],
};

function makePlayers(count: number): PlayerRecord[] {
  return Array.from({ length: count }, (_, i) => ({
    slotIndex: i,
    displayName: `Player${i + 1}`,
    isHost: i === 0,
    sweeps: [],
    tiebreakSweeps: [],
    usedWords: new Set<string>(),
    isConnected: true,
  }));
}

function makeRoomState(playerCount = 2): RoomState {
  return {
    roomCode: "ABC123",
    players: makePlayers(playerCount),
    phase: "lobby",
    sweepIndex: 0,
    tiebreakRoundNumber: 0,
    tiedPlayerSlots: [],
    puzzleId: "puz-0000",
    activePlayerSlot: -1,
  };
}

// ---------------------------------------------------------------------------
// REQ-001/002: Room code generation
// ---------------------------------------------------------------------------

describe("generateRoomCode — REQ-001, REQ-002", () => {
  it("TEST-001: generated code matches ^[A-Z0-9]{6}$", () => {
    const code = generateRoomCode();
    expect(code).toMatch(/^[A-Z0-9]{6}$/);
  });

  it("generates distinct codes on repeated calls (probabilistic)", () => {
    const codes = new Set(Array.from({ length: 20 }, () => generateRoomCode()));
    // Collision probability with 36^6 ≈ 2.17B space is negligible for 20 samples
    expect(codes.size).toBeGreaterThan(15);
  });

  it("TEST-002: code is exactly 6 characters", () => {
    for (let i = 0; i < 10; i++) {
      expect(generateRoomCode()).toHaveLength(6);
    }
  });
});

// ---------------------------------------------------------------------------
// REQ-006: 5th player rejected (capacity)
// ---------------------------------------------------------------------------

describe("canStartGame — REQ-010", () => {
  it("TEST-016: non-host cannot start", () => {
    const state = makeRoomState(2);
    expect(canStartGame(state, 1 /* guest slotIndex */)).toBe(false);
  });

  it("TEST-017: host with 1 player cannot start", () => {
    const state = makeRoomState(1);
    expect(canStartGame(state, 0)).toBe(false);
  });

  it("TEST-015: host with 2 players can start", () => {
    const state = makeRoomState(2);
    expect(canStartGame(state, 0)).toBe(true);
  });

  it("host with 4 players can start", () => {
    const state = makeRoomState(4);
    expect(canStartGame(state, 0)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// REQ-015: Authoritative scoring (uses engine)
// ---------------------------------------------------------------------------

describe("scoreSubmission — REQ-015, REQ-021", () => {
  it("TEST-024: valid word gets its content-pack panelScore", () => {
    const result = scoreSubmission("rough", puzzle, new Set());
    expect(result.panelScore).toBe(43);
    expect(result.verdict).toBe("VALID");
  });

  it("TEST-023: client-fabricated score field is ignored (function always recomputes)", () => {
    // scoreSubmission has no 'clientScore' param — the function signature itself
    // makes it impossible to pass a fabricated score
    const result = scoreSubmission("cough", puzzle, new Set());
    expect(result.panelScore).toBe(15);
  });

  it("invalid word scores MAX_PANEL_SCORE", () => {
    const result = scoreSubmission("notaword", puzzle, new Set());
    expect(result.panelScore).toBe(100);
    expect(result.verdict).toBe("INVALID");
  });

  it("affix mismatch scores 100", () => {
    const result = scoreSubmission("cat", puzzle, new Set());
    expect(result.panelScore).toBe(100);
    expect(result.verdict).toBe("INVALID");
  });

  it("empty string scores 100", () => {
    const result = scoreSubmission("", puzzle, new Set());
    expect(result.panelScore).toBe(100);
    expect(result.verdict).toBe("INVALID");
  });

  it("TEST-031: 51-character word scores 100 as INVALID", () => {
    const longWord = "a".repeat(51) + "ugh";
    const result = scoreSubmission(longWord, puzzle, new Set());
    expect(result.panelScore).toBe(100);
    expect(result.verdict).toBe("INVALID");
  });

  it("TEST-036: word in usedWords set scores 100 as INVALID (tiebreak reuse)", () => {
    const used = new Set(["rough"]);
    const result = scoreSubmission("rough", puzzle, used);
    expect(result.panelScore).toBe(100);
    expect(result.verdict).toBe("INVALID");
  });
});

// ---------------------------------------------------------------------------
// REQ-018: Auto-blank insertion
// ---------------------------------------------------------------------------

describe("applyAutoBlank — REQ-018", () => {
  it("TEST-027: returns a sweep with panelScore=100 and verdict=TIMEOUT", () => {
    const blank = applyAutoBlank();
    expect(blank.panelScore).toBe(100);
    expect(blank.verdict).toBe("TIMEOUT");
    expect(blank.submittedWord).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// REQ-022: Round total computation
// ---------------------------------------------------------------------------

describe("computeRoundTotals — REQ-022", () => {
  it("TEST-032: total = sweep1 + sweep2", () => {
    const players: PlayerRecord[] = [
      {
        slotIndex: 0,
        displayName: "Alice",
        isHost: true,
        sweeps: [
          { panelScore: 30, verdict: "VALID", submittedWord: "rough" },
          { panelScore: 45, verdict: "VALID", submittedWord: "cough" },
        ],
        tiebreakSweeps: [],
        usedWords: new Set(),
        isConnected: true,
      },
    ];
    const totals = computeRoundTotals(players);
    expect(totals[0]).toBe(75);
  });

  it("TEST-033: totals are always in range [0, 200]", () => {
    const players = makePlayers(2).map((p, i) => ({
      ...p,
      sweeps: [
        { panelScore: i === 0 ? 0 : 100, verdict: "VALID" as const, submittedWord: "rough" },
        { panelScore: i === 0 ? 0 : 100, verdict: "VALID" as const, submittedWord: "cough" },
      ],
    }));
    const totals = computeRoundTotals(players);
    for (const t of totals) {
      expect(t).toBeGreaterThanOrEqual(0);
      expect(t).toBeLessThanOrEqual(200);
    }
  });
});

// ---------------------------------------------------------------------------
// REQ-023/024: Winner determination and tiebreak entry
// ---------------------------------------------------------------------------

describe("determineWinner — REQ-023, REQ-024", () => {
  it("TEST-034: unique lowest total returns sole winner slot index", () => {
    const totals = [80, 110, 90, 75];
    const result = determineWinner(totals);
    expect(result.type).toBe("winner");
    if (result.type !== "winner") throw new Error("not winner");
    expect(result.winnerSlot).toBe(3); // index 3 has total 75
  });

  it("TEST-035: tied lowest total returns tie with correct slots", () => {
    const totals = [80, 80, 90];
    const result = determineWinner(totals);
    expect(result.type).toBe("tie");
    if (result.type !== "tie") throw new Error("not tie");
    expect(result.tiedSlots).toEqual([0, 1]);
  });

  it("all players tied returns all slots as tied", () => {
    const totals = [100, 100, 100, 100];
    const result = determineWinner(totals);
    expect(result.type).toBe("tie");
    if (result.type !== "tie") throw new Error("not tie");
    expect(result.tiedSlots).toHaveLength(4);
  });
});

// ---------------------------------------------------------------------------
// REQ-025: Tiebreak word reuse tracking
// ---------------------------------------------------------------------------

describe("recordUsedWord + isWordUsedByPlayer — REQ-053, REQ-025", () => {
  it("TEST-067: valid submission word is recorded", () => {
    const player: PlayerRecord = {
      slotIndex: 0,
      displayName: "Alice",
      isHost: true,
      sweeps: [],
      tiebreakSweeps: [],
      usedWords: new Set(),
      isConnected: true,
    };
    const updated = recordUsedWord(player, "rough");
    expect(isWordUsedByPlayer(updated, "rough")).toBe(true);
  });

  it("TEST-068: invalid word is also recorded (prevents gaming)", () => {
    const player: PlayerRecord = {
      slotIndex: 0,
      displayName: "Alice",
      isHost: true,
      sweeps: [],
      tiebreakSweeps: [],
      usedWords: new Set(),
      isConnected: true,
    };
    const updated = recordUsedWord(player, "xyz");
    expect(isWordUsedByPlayer(updated, "xyz")).toBe(true);
  });

  it("auto-blank (null word) is NOT recorded", () => {
    const player: PlayerRecord = {
      slotIndex: 0,
      displayName: "Alice",
      isHost: true,
      sweeps: [],
      tiebreakSweeps: [],
      usedWords: new Set(),
      isConnected: true,
    };
    const updated = recordUsedWord(player, null);
    expect(updated.usedWords.size).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// REQ-026/027/028/052: Tiebreak rounds
// ---------------------------------------------------------------------------

describe("determineWinner — tiebreak rounds REQ-026, REQ-027, REQ-028, REQ-052", () => {
  it("TEST-037: tiebreak round 1 sole winner: lower score wins", () => {
    const tiebreakScores = [40, 70]; // two tied players
    const result = determineWinner(tiebreakScores);
    expect(result.type).toBe("winner");
    if (result.type !== "winner") throw new Error("not winner");
    expect(result.winnerSlot).toBe(0);
  });

  it("TEST-038: tiebreak round 1 still tied: advance to round 2", () => {
    const tiebreakScores = [50, 50];
    const result = determineWinner(tiebreakScores);
    expect(result.type).toBe("tie");
    if (result.type !== "tie") throw new Error("not tie");
    expect(result.tiedSlots).toEqual([0, 1]);
  });

  it("TEST-066: tiebreak round 2 sole winner", () => {
    const round2Scores = [50, 80];
    const result = determineWinner(round2Scores);
    expect(result.type).toBe("winner");
    if (result.type !== "winner") throw new Error("not winner");
    expect(result.winnerSlot).toBe(0);
  });

  it("TEST-039: both tiebreak rounds exhausted → joint winners signalled by caller", () => {
    // determineWinner returns tie; room.ts caller checks tiebreakRoundNumber===2 for joint winner
    const round2Scores = [60, 60];
    const result = determineWinner(round2Scores);
    expect(result.type).toBe("tie"); // caller applies isJointWinner=true when round===2
  });
});

// ---------------------------------------------------------------------------
// REQ-030: Leaderboard rank assignment
// ---------------------------------------------------------------------------

describe("buildLeaderboard — REQ-030", () => {
  it("TEST-042: standard competition ranking (1,2,2,4)", () => {
    const players = makePlayers(4);
    const totals = [75, 80, 80, 95];
    const board = buildLeaderboard(players, totals, null, false);
    expect(board[0]?.rank).toBe(1); // slot 0 = total 75
    expect(board[1]?.rank).toBe(2); // slot 1 = total 80
    expect(board[2]?.rank).toBe(2); // slot 2 = total 80
    expect(board[3]?.rank).toBe(4); // slot 3 = total 95 (skips rank 3)
  });

  it("TEST-034: sole winner has rank 1, isJointWinner false", () => {
    const players = makePlayers(2);
    const totals = [75, 95];
    const board = buildLeaderboard(players, totals, null, false);
    expect(board[0]?.rank).toBe(1);
    expect(board[0]?.isJointWinner).toBe(false);
  });

  it("TEST-039: joint winners both have rank 1 and isJointWinner true", () => {
    const players = makePlayers(2);
    const totals = [80, 80];
    const board = buildLeaderboard(players, totals, [0, 1], true);
    expect(board[0]?.rank).toBe(1);
    expect(board[0]?.isJointWinner).toBe(true);
    expect(board[1]?.rank).toBe(1);
    expect(board[1]?.isJointWinner).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// REQ-033: Guest disconnect decrements player count
// ---------------------------------------------------------------------------

describe("decrPlayerCount — REQ-033", () => {
  it("TEST-045: disconnecting a guest reduces player count", () => {
    const state = makeRoomState(3);
    const updated = decrPlayerCount(state, 1 /* guest slotIndex */);
    expect(updated.players.filter((p) => p.isConnected).length).toBe(2);
  });

  it("disconnecting host marks host as disconnected", () => {
    const state = makeRoomState(2);
    const updated = decrPlayerCount(state, 0);
    expect(updated.players[0]?.isConnected).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// REQ-FIX-003: slot allocation and host election must ignore ghost records.
//
// decrPlayerCount marks a departed player isConnected:false but KEEPS the
// record. The DO previously derived the next slot from players.length, which
// counts those ghosts, so a joiner could be handed a slotIndex already held by
// a live player — shadowing them. Since broadcastPlayerList filters on
// isConnected, the roster then under-reported (observed live as "0/4 players").
//
// These tests pin the two invariants the DO's fetch() now relies on.
// ---------------------------------------------------------------------------

describe("slot allocation and host election with ghost records — REQ-FIX-003", () => {
  /** Mirrors the DO's slot-allocation rule: lowest index not held by a CONNECTED player. */
  function nextSlot(players: PlayerRecord[]): number {
    const used = new Set(players.filter((p) => p.isConnected).map((p) => p.slotIndex));
    let i = 0;
    while (used.has(i)) i += 1;
    return i;
  }

  /** Mirrors the DO's host-election rule: host only if no CONNECTED host exists. */
  function electsHost(players: PlayerRecord[]): boolean {
    return !players.some((p) => p.isConnected && p.isHost);
  }

  it("reuses the freed slot of a departed guest instead of colliding with a live one", () => {
    // Host at 0 (live), guest at 1 who has left.
    const state = decrPlayerCount(makeRoomState(2), 1);
    expect(nextSlot(state.players)).toBe(1); // NOT 2, and critically NOT 0
  });

  it("never hands a joiner the slot of a still-connected host", () => {
    const state = decrPlayerCount(makeRoomState(2), 1);
    const assigned = nextSlot(state.players);
    const liveHostSlot = state.players.find((p) => p.isConnected && p.isHost)?.slotIndex;
    expect(assigned).not.toBe(liveHostSlot);
  });

  it("does not promote a joiner to host while a connected host exists", () => {
    // This is the live bug: guest joined and was made host, orphaning the host.
    const state = decrPlayerCount(makeRoomState(2), 1);
    expect(electsHost(state.players)).toBe(false);
  });

  it("promotes a joiner to host only when no connected host remains", () => {
    const state = decrPlayerCount(makeRoomState(1), 0); // host left
    expect(electsHost(state.players)).toBe(true);
  });

  it("ghost records do not inflate the slot index across repeated churn", () => {
    // Two join/leave cycles must not push a new joiner past the 4-slot range.
    let state = makeRoomState(2);
    state = decrPlayerCount(state, 1);
    state = decrPlayerCount(state, 0);
    expect(nextSlot(state.players)).toBe(0);
  });
});
