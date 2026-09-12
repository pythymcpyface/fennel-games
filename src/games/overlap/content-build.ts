import type { Puzzle } from "./types.ts";

// Build-time content generation (JOURNEY-007, TERM-016). Pure + deterministic.
// Model: a bipartite "compounds-with" relation between anchor words and bridge words.
// A puzzle is valid iff a chosen anchor pair (A,B) shares EXACTLY ONE bridge X.

/** Adjacency: anchor -> set of bridge words that compound with it. */
export type CompoundGraph = Record<string, string[]>;

/** Invert to bridge -> anchors that it compounds with. */
export function invertGraph(graph: CompoundGraph): Map<string, Set<string>> {
  const byBridge = new Map<string, Set<string>>();
  for (const [anchor, bridges] of Object.entries(graph)) {
    for (const b of bridges) {
      if (!byBridge.has(b)) byBridge.set(b, new Set());
      byBridge.get(b)!.add(anchor);
    }
  }
  return byBridge;
}

/**
 * REQ-023 — the set of bridges shared by anchors A and B (neighbour intersection).
 */
export function commonBridges(graph: CompoundGraph, a: string, b: string): string[] {
  const bs = new Set(graph[b] ?? []);
  return (graph[a] ?? []).filter((x) => bs.has(x)).sort();
}

/** REQ-023 — an anchor pair is puzzle-valid iff exactly one common bridge exists. */
export function isUniqueBridgePair(graph: CompoundGraph, a: string, b: string): boolean {
  return commonBridges(graph, a, b).length === 1;
}

/**
 * Enumerate all unique-bridge puzzles from the graph, deterministically ordered.
 * Each anchor pair (A<B lexicographically) with exactly one common bridge yields a
 * Puzzle. Anchors are uppercased.
 */
export function generatePuzzles(graph: CompoundGraph): Puzzle[] {
  const anchors = Object.keys(graph).sort();
  const puzzles: Puzzle[] = [];
  for (let i = 0; i < anchors.length; i++) {
    for (let j = i + 1; j < anchors.length; j++) {
      const a = anchors[i];
      const b = anchors[j];
      const common = commonBridges(graph, a, b);
      if (common.length === 1) {
        const bridge = common[0].toUpperCase();
        puzzles.push({
          puzzleId: "", // assigned by the pack builder
          anchorA: a.toUpperCase(),
          anchorB: b.toUpperCase(),
          bridgeWord: bridge,
          bridgeLength: bridge.length,
        });
      }
    }
  }
  // Deterministic order by (anchorA, anchorB).
  puzzles.sort((p, q) =>
    p.anchorA === q.anchorA ? (p.anchorB < q.anchorB ? -1 : 1) : p.anchorA < q.anchorA ? -1 : 1,
  );
  return puzzles.map((p, i) => ({ ...p, puzzleId: `puz-${i.toString().padStart(4, "0")}` }));
}

/** Build-time gate: assert every emitted puzzle truly has a unique bridge (REQ-023). */
export function assertPuzzlesValid(graph: CompoundGraph, puzzles: Puzzle[]): void {
  for (const p of puzzles) {
    const common = commonBridges(graph, p.anchorA.toLowerCase(), p.anchorB.toLowerCase());
    if (common.length !== 1) {
      throw new Error(`non-unique bridge for ${p.anchorA}/${p.anchorB}: [${common.join(",")}]`);
    }
    if (common[0].toUpperCase() !== p.bridgeWord) {
      throw new Error(`bridge mismatch for ${p.anchorA}/${p.anchorB}`);
    }
  }
}
