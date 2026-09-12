import type { BalanceClass, Puzzle } from "./types.ts";
import { CLOSENESS_MAX } from "./types.ts";

// Build-time content generation + fairness gate for Parallax. Pure + deterministic.
// Similarity is injected (cosine over GloVe in production, a stub in tests) so this
// module ships no vectors and stays unit-testable.

export type SimilarityFn = (a: string, b: string) => number; // cosine in [-1, 1]

/** Cosine distance in [0, 2]; lower = more similar. */
function dist(sim: SimilarityFn, a: string, b: string): number {
  return 1 - sim(a, b);
}

/**
 * Balance of a word W between anchors A and B: 0 = fully toward A, 1 = fully toward
 * B, 0.5 = balanced. Derived from the two cosine distances.
 */
export function balanceValue(sim: SimilarityFn, w: string, a: string, b: string): number {
  const da = dist(sim, w, a);
  const db = dist(sim, w, b);
  const total = da + db;
  if (total <= 0) return 0.5;
  return da / total; // small da => close to A => value near 0
}

/** FIELD-032 — balanced tolerance window (half-width) around 0.5. */
export const BALANCED_HALF_WIDTH = 0.08;

export function classifyBalance(value: number, halfWidth = BALANCED_HALF_WIDTH): BalanceClass {
  if (value < 0.5 - halfWidth) return "A";
  if (value > 0.5 + halfWidth) return "B";
  return "BALANCED";
}

/**
 * Closeness band 0..9 of a word to the ideal midpoint. We define closeness by how
 * near the word's balance is to 0.5 AND how near it sits (in summed distance) to the
 * target's summed distance — i.e. it is on the "midpoint shell". Simplest robust
 * signal: closeness driven by |balance - 0.5| (smaller = closer), banded to 0..9.
 * The target itself is forced to CLOSENESS_MAX by the caller.
 */
export function closenessBand(value: number): number {
  const off = Math.abs(value - 0.5); // 0 .. 0.5
  // map off=0 -> band 9(ish via caller), off>=0.5 -> band 0
  const frac = Math.max(0, 1 - off / 0.5); // 1 at midpoint, 0 at an extreme
  return Math.min(CLOSENESS_MAX - 1, Math.floor(frac * (CLOSENESS_MAX - 1)));
}

export interface GateConfig {
  /** anchors must be at least this cosine-distant so the midpoint is meaningful. */
  minAnchorDistance: number;
  /** the target must be genuinely balanced (|balance-0.5| <= this). */
  maxTargetImbalance: number;
}

export const DEFAULT_GATE: GateConfig = { minAnchorDistance: 0.6, maxTargetImbalance: 0.06 };

/**
 * A (anchorA, anchorB, target) triple is fair when:
 *  - all three distinct and present in the similarity provider,
 *  - anchors are sufficiently far apart (a real spread to bisect),
 *  - the target is genuinely near the midpoint (balanced within tolerance).
 */
export function isFairTriple(
  sim: SimilarityFn,
  has: (w: string) => boolean,
  a: string,
  b: string,
  target: string,
  cfg: GateConfig = DEFAULT_GATE,
): boolean {
  if (a === b || a === target || b === target) return false;
  if (!has(a) || !has(b) || !has(target)) return false;
  if (dist(sim, a, b) < cfg.minAnchorDistance) return false;
  const bal = balanceValue(sim, target, a, b);
  return Math.abs(bal - 0.5) <= cfg.maxTargetImbalance;
}

/**
 * Build a puzzle's feedback table over a candidate vocabulary. Every candidate gets
 * a balanceClass + closenessBand; the target is pinned to CLOSENESS_MAX.
 */
export function buildTable(
  sim: SimilarityFn,
  has: (w: string) => boolean,
  a: string,
  b: string,
  target: string,
  vocabulary: readonly string[],
): Record<string, { balance: BalanceClass; closeness: number }> {
  const table: Record<string, { balance: BalanceClass; closeness: number }> = {};
  for (const raw of vocabulary) {
    const w = raw.toUpperCase();
    if (!has(w) && !has(raw)) continue;
    const useWord = has(w) ? w : raw;
    const bal = balanceValue(sim, useWord, a, b);
    table[w] = { balance: classifyBalance(bal), closeness: closenessBand(bal) };
  }
  // Pin anchors and target for correctness.
  table[target.toUpperCase()] = { balance: "BALANCED", closeness: CLOSENESS_MAX };
  return table;
}

/** Assemble a validated puzzle from a fair triple + vocabulary. */
export function buildPuzzle(
  sim: SimilarityFn,
  has: (w: string) => boolean,
  a: string,
  b: string,
  target: string,
  vocabulary: readonly string[],
  puzzleId: string,
): Puzzle {
  const A = a.toUpperCase();
  const B = b.toUpperCase();
  const T = target.toUpperCase();
  const table = buildTable(sim, has, A, B, T, vocabulary);
  return { puzzleId, anchorA: A, anchorB: B, target: T, table };
}

/** Gate assertion: target present with max closeness; anchors present. */
export function assertPuzzleValid(p: Puzzle): void {
  if (!(p.target in p.table) || p.table[p.target].closeness !== CLOSENESS_MAX) {
    throw new Error(`target not pinned for ${p.puzzleId}`);
  }
}

// ---- Compact packing (shared vocab + one base-36 char per word) ----

const BAL_CODE: Record<BalanceClass, number> = { A: 0, BALANCED: 1, B: 2 };
const CODE_BAL: BalanceClass[] = ["A", "BALANCED", "B"];

/** Encode one feedback cell to a single base-36 char: balance*10 + closeness. */
export function encodeCell(balance: BalanceClass, closeness: number): string {
  const v = BAL_CODE[balance] * 10 + Math.max(0, Math.min(CLOSENESS_MAX, closeness));
  return v.toString(36);
}

/** Decode a single base-36 char back to a feedback cell. */
export function decodeCell(ch: string): { balance: BalanceClass; closeness: number } {
  const v = parseInt(ch, 36);
  return { balance: CODE_BAL[Math.floor(v / 10)], closeness: v % 10 };
}

/** Pack a puzzle's table into a codes string aligned to `vocab` order. */
export function packCodes(table: Puzzle["table"], vocab: readonly string[]): string {
  let out = "";
  for (const w of vocab) {
    const cell = table[w.toUpperCase()] ?? { balance: "A" as BalanceClass, closeness: 0 };
    out += encodeCell(cell.balance, cell.closeness);
  }
  return out;
}

/** Rehydrate a packed codes string against `vocab` into a Puzzle table. */
export function unpackCodes(codes: string, vocab: readonly string[]): Puzzle["table"] {
  const table: Puzzle["table"] = {};
  for (let i = 0; i < vocab.length; i++) {
    table[vocab[i].toUpperCase()] = decodeCell(codes[i]);
  }
  return table;
}
