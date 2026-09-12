import type { Node, Puzzle } from "./types.ts";
import { BLANK_MARKER } from "./types.ts";

// Build-time content generation + fairness gate for Marginalia (TERM-019). Pure +
// deterministic. Validates the story graph: DAG, full reachability from start,
// exactly-3 choices on non-terminals pointing to existing nodes, golden node is
// terminal + reachable, exactly one path start->golden, one blank per prompt,
// non-empty prompts/choices.

export interface RawPuzzle {
  nodes: Record<string, Node>;
  startNodeId: string;
  goldenNodeId: string;
}

function isTerminal(node: Node): boolean {
  return node.choices.length === 0;
}

function countOccurrences(haystack: string, needle: string): number {
  let n = 0;
  let i = haystack.indexOf(needle);
  while (i !== -1) { n++; i = haystack.indexOf(needle, i + needle.length); }
  return n;
}

/** Reachable node ids from start via choice edges. */
function reachableFrom(nodes: Record<string, Node>, start: string): Set<string> {
  const seen = new Set<string>();
  const stack = [start];
  while (stack.length) {
    const id = stack.pop()!;
    if (seen.has(id) || !nodes[id]) continue;
    seen.add(id);
    for (const c of nodes[id].choices) stack.push(c.next);
  }
  return seen;
}

/** Detect a cycle reachable from start (DFS with colours). */
function hasCycle(nodes: Record<string, Node>, start: string): boolean {
  const WHITE = 0, GREY = 1, BLACK = 2;
  const colour = new Map<string, number>();
  const visit = (id: string): boolean => {
    if (!nodes[id]) return false;
    colour.set(id, GREY);
    for (const c of nodes[id].choices) {
      const state = colour.get(c.next) ?? WHITE;
      if (state === GREY) return true;
      if (state === WHITE && visit(c.next)) return true;
    }
    colour.set(id, BLACK);
    return false;
  };
  return visit(start);
}

/** Count distinct directed paths start->golden (assumes DAG). */
function countPaths(nodes: Record<string, Node>, from: string, golden: string, memo = new Map<string, number>()): number {
  if (from === golden) return 1;
  if (memo.has(from)) return memo.get(from)!;
  const node = nodes[from];
  let total = 0;
  if (node) for (const c of node.choices) total += countPaths(nodes, c.next, golden, memo);
  memo.set(from, total);
  return total;
}

/** Fairness gate (REQ-017..025). Returns failure reasons; empty = fair. */
export function validate(raw: RawPuzzle): string[] {
  const reasons: string[] = [];
  const { nodes, startNodeId, goldenNodeId } = raw;

  if (!nodes[startNodeId]) reasons.push(`start node "${startNodeId}" missing`);
  if (!nodes[goldenNodeId]) reasons.push(`golden node "${goldenNodeId}" missing`);
  if (reasons.length > 0) return reasons;

  for (const [id, node] of Object.entries(nodes)) {
    if (node.id !== id) reasons.push(`node "${id}": id field mismatch`);
    // REQ-023 — non-empty prompt.
    if (node.prompt.trim().length === 0) reasons.push(`node "${id}": empty prompt`);
    // REQ-024 — exactly one blank marker.
    if (countOccurrences(node.prompt, BLANK_MARKER) !== 1) reasons.push(`node "${id}": prompt must contain exactly one ${BLANK_MARKER}`);
    if (!isTerminal(node)) {
      // REQ-019 — exactly 3 choices.
      if (node.choices.length !== 3) reasons.push(`node "${id}": non-terminal must have exactly 3 choices`);
      for (const c of node.choices) {
        if (c.word.trim().length === 0) reasons.push(`node "${id}": empty choice word`);
        // REQ-020 — next node exists.
        if (!nodes[c.next]) reasons.push(`node "${id}": choice points to missing node "${c.next}"`);
      }
    }
  }

  // REQ-017 — DAG (no cycles).
  if (hasCycle(nodes, startNodeId)) reasons.push("story graph contains a cycle (must be a DAG)");

  // REQ-018 — all nodes reachable from start.
  const reachable = reachableFrom(nodes, startNodeId);
  for (const id of Object.keys(nodes)) if (!reachable.has(id)) reasons.push(`node "${id}" unreachable from start`);

  // REQ-021/022 — golden reachable + terminal.
  if (!reachable.has(goldenNodeId)) reasons.push("golden node unreachable from start");
  if (!isTerminal(nodes[goldenNodeId])) reasons.push("golden node must be terminal");

  // REQ-025 — exactly one path start->golden (only meaningful if DAG).
  if (!hasCycle(nodes, startNodeId)) {
    const paths = countPaths(nodes, startNodeId, goldenNodeId);
    if (paths !== 1) reasons.push(`exactly one golden path required, found ${paths}`);
  }

  return reasons;
}

export function buildPuzzle(puzzleId: string, raw: RawPuzzle): Puzzle | null {
  if (validate(raw).length > 0) return null;
  return { puzzleId, nodes: raw.nodes, startNodeId: raw.startNodeId, goldenNodeId: raw.goldenNodeId };
}

export function assertPuzzleValid(raw: RawPuzzle): void {
  const reasons = validate(raw);
  if (reasons.length > 0) throw new Error(`marginalia invalid puzzle:\n - ${reasons.join("\n - ")}`);
}
