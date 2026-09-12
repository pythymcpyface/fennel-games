import { describe, it, expect } from "vitest";
import { validate, buildPuzzle, assertPuzzleValid, type RawPuzzle } from "../src/games/marginalia/content-build.ts";
import { buildShareText, isSpoilerSafe } from "../src/games/marginalia/share.ts";
import { initAttempt, choose } from "../src/games/marginalia/engine.ts";
import type { Node } from "../src/games/marginalia/types.ts";

function raw(): RawPuzzle {
  const nodes: Record<string, Node> = {
    s0: { id: "s0", prompt: "Pick a [[BLANK]].", choices: [{ word: "key", next: "s1" }, { word: "rock", next: "endA" }, { word: "leaf", next: "endB" }] },
    s1: { id: "s1", prompt: "Open the [[BLANK]].", choices: [{ word: "door", next: "gEnd" }, { word: "trap", next: "endC" }, { word: "void", next: "endD" }] },
    gEnd: { id: "gEnd", prompt: "You [[BLANK]] escape!", choices: [] },
    endA: { id: "endA", prompt: "A dull [[BLANK]].", choices: [] },
    endB: { id: "endB", prompt: "A dull [[BLANK]].", choices: [] },
    endC: { id: "endC", prompt: "A dull [[BLANK]].", choices: [] },
    endD: { id: "endD", prompt: "A dull [[BLANK]].", choices: [] },
  };
  return { nodes, startNodeId: "s0", goldenNodeId: "gEnd" };
}

describe("marginalia content-build — fairness gate", () => {
  it("accepts a well-formed DAG with exactly one golden path", () => {
    expect(validate(raw())).toEqual([]);
    const p = buildPuzzle("puz-0000", raw())!;
    expect(p).not.toBeNull();
    expect(() => assertPuzzleValid(raw())).not.toThrow();
  });

  it("rejects a non-terminal node without exactly 3 choices (REQ-019)", () => {
    const r = raw();
    r.nodes.s0.choices = r.nodes.s0.choices.slice(0, 2);
    expect(validate(r).some((x) => x.includes("exactly 3 choices"))).toBe(true);
  });

  it("rejects a choice pointing to a missing node (REQ-020)", () => {
    const r = raw();
    r.nodes.s0.choices[0].next = "ghost";
    expect(validate(r).some((x) => x.includes("missing node"))).toBe(true);
  });

  it("rejects a cycle (REQ-017)", () => {
    const r = raw();
    r.nodes.gEnd.choices = [
      { word: "a", next: "s0" }, { word: "b", next: "s1" }, { word: "c", next: "endA" },
    ]; // gEnd -> s0 makes a cycle and gEnd non-terminal
    expect(validate(r).some((x) => x.includes("cycle"))).toBe(true);
  });

  it("rejects an unreachable node (REQ-018)", () => {
    const r = raw();
    r.nodes.orphan = { id: "orphan", prompt: "Lost [[BLANK]].", choices: [] };
    expect(validate(r).some((x) => x.includes("unreachable"))).toBe(true);
  });

  it("rejects a non-terminal golden node (REQ-022)", () => {
    const r = raw();
    r.nodes.gEnd.choices = [
      { word: "a", next: "endA" }, { word: "b", next: "endB" }, { word: "c", next: "endC" },
    ];
    expect(validate(r).some((x) => x.includes("golden node must be terminal"))).toBe(true);
  });

  it("rejects a prompt without exactly one blank (REQ-024)", () => {
    const r = raw();
    r.nodes.s0.prompt = "No blank here.";
    expect(validate(r).some((x) => x.includes("exactly one"))).toBe(true);
  });

  it("rejects more than one golden path (REQ-025)", () => {
    const r = raw();
    // Make s0's second choice also route into s1, creating two paths to gEnd.
    r.nodes.s0.choices[1].next = "s1";
    expect(validate(r).some((x) => x.includes("golden path"))).toBe(true);
  });
});

describe("marginalia share — spoiler safety", () => {
  it("emits a path-shape + result without story words", () => {
    const p = buildPuzzle("puz-0000", raw())!;
    let s = initAttempt(p, "2026-01-01");
    s = choose(s, p, 0).state;
    s = choose(s, p, 0).state; // golden
    const text = buildShareText(s, p, "2026-01-01");
    expect(text).toContain("Marginalia 2026-01-01 🏆");
    expect(text).toContain("🔹");
    expect(isSpoilerSafe(text, p)).toBe(true);
    expect(text.toUpperCase()).not.toContain("DOOR");
    expect(text.toUpperCase()).not.toContain("KEY");
  });

  it("isSpoilerSafe flags text containing a choice word", () => {
    const p = buildPuzzle("puz-0000", raw())!;
    expect(isSpoilerSafe("Marginalia door", p)).toBe(false);
  });
});
