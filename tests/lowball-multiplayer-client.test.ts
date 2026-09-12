// Tests for multiplayer-client.ts — message serialization, URL construction,
// and client-side validation (display name, room code normalization).
//
// REQs covered: REQ-004, REQ-038, REQ-046, REQ-042, REQ-056, REQ-060, REQ-062

import { describe, it, expect } from "vitest";
import {
  buildWsUrl,
  normalizeRoomCode,
  validateDisplayName,
  serializeClientMessage,
  parseServerMessage,
} from "../src/games/lowball/multiplayer-client.ts";

// ---------------------------------------------------------------------------
// REQ-038: Invite link format
// ---------------------------------------------------------------------------

describe("buildWsUrl — REQ-038, REQ-036", () => {
  it("TEST-051: constructs a valid WebSocket URL from relay base and room code", () => {
    const url = buildWsUrl("wss://relay.example.workers.dev", "ABC123");
    expect(url).toBe("wss://relay.example.workers.dev/room/ABC123");
  });

  it("handles trailing slash in base URL", () => {
    const url = buildWsUrl("wss://relay.example.workers.dev/", "DEF456");
    expect(url).toBe("wss://relay.example.workers.dev/room/DEF456");
  });
});

// ---------------------------------------------------------------------------
// REQ-046: Room code lowercase normalization
// ---------------------------------------------------------------------------

describe("normalizeRoomCode — REQ-046", () => {
  it("TEST-060: lowercase code is converted to uppercase", () => {
    expect(normalizeRoomCode("abc123")).toBe("ABC123");
  });

  it("already-uppercase code is unchanged", () => {
    expect(normalizeRoomCode("ABC123")).toBe("ABC123");
  });

  it("mixed case is fully uppercased", () => {
    expect(normalizeRoomCode("AbC1z9")).toBe("ABC1Z9");
  });

  it("trims surrounding whitespace", () => {
    expect(normalizeRoomCode("  abc123  ")).toBe("ABC123");
  });
});

// ---------------------------------------------------------------------------
// REQ-004 + REQ-062: Display name validation
// ---------------------------------------------------------------------------

describe("validateDisplayName — REQ-004, REQ-062", () => {
  it("TEST-005: whitespace-only name returns validation error", () => {
    const result = validateDisplayName("   ");
    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
  });

  it("TEST-006: 1-character name is valid (boundary)", () => {
    const result = validateDisplayName("A");
    expect(result.valid).toBe(true);
  });

  it("TEST-007 / TEST-008: 20-character name is valid (boundary)", () => {
    const result = validateDisplayName("A".repeat(20));
    expect(result.valid).toBe(true);
  });

  it("21-character name is invalid (exceeds max)", () => {
    const result = validateDisplayName("A".repeat(21));
    expect(result.valid).toBe(false);
  });

  it("empty string is invalid", () => {
    const result = validateDisplayName("");
    expect(result.valid).toBe(false);
  });

  it("trims before length check", () => {
    // name with only leading space + 1 real char is valid
    const result = validateDisplayName(" A");
    expect(result.valid).toBe(true);
    expect(result.trimmed).toBe("A");
  });

  it("name that is whitespace only after trim is invalid", () => {
    const result = validateDisplayName("\t\n ");
    expect(result.valid).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// REQ-042/REQ-060: Message serialization (no WebSocket in engine)
// The functions below are pure JSON helpers — no actual WebSocket
// ---------------------------------------------------------------------------

describe("serializeClientMessage / parseServerMessage — REQ-042", () => {
  it("serialize submit message produces correct JSON", () => {
    const msg = serializeClientMessage({ type: "submit", word: "rough" });
    const parsed = JSON.parse(msg) as { type: string; word: string };
    expect(parsed.type).toBe("submit");
    expect(parsed.word).toBe("rough");
  });

  it("serialize join message includes displayName", () => {
    const msg = serializeClientMessage({ type: "join", displayName: "Alice" });
    const parsed = JSON.parse(msg) as { type: string; displayName: string };
    expect(parsed.type).toBe("join");
    expect(parsed.displayName).toBe("Alice");
  });

  it("parseServerMessage handles valid sweep-start JSON", () => {
    const raw = JSON.stringify({ type: "sweep-start", sweepIndex: 0, sweepDeadlineTimestamp: 9999999 });
    const msg = parseServerMessage(raw);
    expect(msg?.type).toBe("sweep-start");
  });

  it("parseServerMessage returns null on invalid JSON", () => {
    const msg = parseServerMessage("not valid json {{{");
    expect(msg).toBeNull();
  });

  it("parseServerMessage returns null on missing type field", () => {
    const msg = parseServerMessage(JSON.stringify({ foo: "bar" }));
    expect(msg).toBeNull();
  });
});
