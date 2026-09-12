import { describe, it, expect } from "vitest";
import {
  invertGraph,
  commonBridges,
  isUniqueBridgePair,
  generatePuzzles,
  assertPuzzlesValid,
  type CompoundGraph,
} from "../src/games/overlap/content-build.ts";

// Phase 2 — content build + unique-bridge gate (REQ-023/024, JOURNEY-007).

// fire+cracker=firecracker, cream+cracker=cream cracker, fire+fly=firefly,
// butter+fly=butterfly, cream+cheese, mac+cheese
const graph: CompoundGraph = {
  fire: ["cracker", "fly", "place"],
  cream: ["cracker", "cheese"],
  butter: ["fly", "cup"],
  mac: ["cheese"],
};

describe("commonBridges / uniqueness (REQ-023)", () => {
  it("finds the shared bridge of two anchors", () => {
    expect(commonBridges(graph, "fire", "cream")).toEqual(["cracker"]);
  });
  it("fire+butter share exactly 'fly' => unique", () => {
    expect(commonBridges(graph, "fire", "butter")).toEqual(["fly"]);
    expect(isUniqueBridgePair(graph, "fire", "butter")).toBe(true);
  });
  it("cream+mac share exactly 'cheese' => unique", () => {
    expect(isUniqueBridgePair(graph, "cream", "mac")).toBe(true);
  });
  it("anchors with no shared bridge are not valid", () => {
    expect(commonBridges(graph, "mac", "butter")).toEqual([]);
    expect(isUniqueBridgePair(graph, "mac", "butter")).toBe(false);
  });
});

describe("generatePuzzles", () => {
  const puzzles = generatePuzzles(graph);

  it("emits only unique-bridge pairs", () => {
    // pairs with exactly one shared bridge:
    // fire/cream -> cracker ; fire/butter -> fly ; cream/mac -> cheese
    expect(puzzles).toHaveLength(3);
    for (const p of puzzles) expect(p.bridgeWord.length).toBe(p.bridgeLength);
  });

  it("uppercases anchors and bridge; assigns sequential ids", () => {
    const p = puzzles[0];
    expect(p.anchorA).toMatch(/^[A-Z]+$/);
    expect(p.bridgeWord).toMatch(/^[A-Z]+$/);
    expect(p.puzzleId).toMatch(/^puz-\d{4}$/);
  });

  it("is deterministic (stable ordering)", () => {
    const again = generatePuzzles(graph);
    expect(again).toEqual(puzzles);
  });

  it("passes the build-time validity gate", () => {
    expect(() => assertPuzzlesValid(graph, puzzles)).not.toThrow();
  });

  it("gate throws if a puzzle is not actually unique", () => {
    // craft a graph where a pair has 2 bridges
    const ambiguous: CompoundGraph = { x: ["a", "b"], y: ["a", "b"] };
    const bad = [{ puzzleId: "puz-0000", anchorA: "X", anchorB: "Y", bridgeWord: "A", bridgeLength: 1 }];
    expect(() => assertPuzzlesValid(ambiguous, bad)).toThrow();
  });
});

describe("invertGraph", () => {
  it("maps bridge -> anchors", () => {
    const inv = invertGraph(graph);
    expect(inv.get("cracker")).toEqual(new Set(["fire", "cream"]));
    expect(inv.get("fly")).toEqual(new Set(["fire", "butter"]));
  });
});
