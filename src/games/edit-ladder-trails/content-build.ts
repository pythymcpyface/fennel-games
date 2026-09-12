import type { Answer, Puzzle } from "./types.ts";
import { COLS, ROWS, CELL_COUNT } from "./types.ts";

// Build-time content generation: the deterministic 8-direction perfect-cover
// PACKER + the fairness/uniqueness GATE. Pure (no fs, no wordkit import here —
// the build tool supplies the ladder/spangram/filler words and a seeded PRNG).
// Proven feasible by the spike (116/120 boards, ~65ms/day, all valid).

// ---------- geometry ----------
const DIRS8: ReadonlyArray<readonly [number, number]> = [
  [-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1],
];

export function neighbours(cell: number): number[] {
  const r = Math.floor(cell / COLS), c = cell % COLS;
  const out: number[] = [];
  for (const [dr, dc] of DIRS8) {
    const nr = r + dr, nc = c + dc;
    if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS) out.push(nr * COLS + nc);
  }
  return out;
}

/** Deterministic PRNG (mulberry32) — build-time seeded shuffles. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function shuffled<T>(arr: readonly T[], rand: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

interface Budget { nodes: number; }

/** Place `word` as an 8-dir simple path over `free`; node-budgeted to fail fast. */
function placeWord(
  wordLen: number,
  free: Set<number>,
  rand: () => number,
  budget: Budget,
  startCandidates?: number[],
): number[] | null {
  const starts = shuffled(startCandidates ? startCandidates.filter((c) => free.has(c)) : [...free], rand);
  for (const s of starts) {
    const path = [s];
    const used = new Set<number>([s]);
    const step = (): boolean => {
      if (budget.nodes-- <= 0) return false;
      if (path.length === wordLen) return true;
      for (const nb of shuffled(neighbours(path[path.length - 1]), rand)) {
        if (free.has(nb) && !used.has(nb)) {
          path.push(nb); used.add(nb);
          if (step()) return true;
          path.pop(); used.delete(nb);
        }
      }
      return false;
    };
    if (step()) return path;
    if (budget.nodes <= 0) return null;
  }
  return null;
}

const topRow = (): number[] => Array.from({ length: COLS }, (_, c) => c);
const isBottomRow = (cell: number): boolean => Math.floor(cell / COLS) === ROWS - 1;

export interface PackInput {
  ladder: string[];   // 4 rungs (5 letters each) in chain order
  spangram: string;   // 8 letters
  filler: string[];   // 2 fillers (4 letters each)
}

/**
 * Pack the answer set into a perfect-cover 6x6 grid. The spangram is placed first,
 * anchored on the top row and required to end on the bottom row (spans opposite
 * sides). Remaining words are packed longest-first with bounded backtracking so
 * every cell is covered exactly once. Returns placements + letters, or null if the
 * node budget is exhausted (caller retries with a fresh seed).
 */
export function packBoard(input: PackInput, rand: () => number, budget: Budget): { letters: string[]; answers: Answer[] } | null {
  const { ladder, spangram, filler } = input;
  if (spangram.length + ladder.reduce((s, w) => s + w.length, 0) + filler.reduce((s, w) => s + w.length, 0) !== CELL_COUNT) {
    return null; // words don't exactly tile the grid
  }
  const free = new Set<number>(Array.from({ length: CELL_COUNT }, (_, i) => i));
  const placements: Array<{ word: string; type: Answer["type"]; path: number[] }> = [];

  // 1) spangram: start on top row, must end on bottom row.
  let span: number[] | null = null;
  for (let t = 0; t < 12 && !span && budget.nodes > 0; t++) {
    const cand = placeWord(spangram.length, free, rand, budget, topRow());
    if (cand && isBottomRow(cand[cand.length - 1])) span = cand;
  }
  if (!span) return null;
  for (const c of span) free.delete(c);
  placements.push({ word: spangram, type: "spangram", path: span });

  // 2) rungs + fillers, longest first.
  const rest = [
    ...ladder.map((w) => ({ word: w, type: "rung" as const })),
    ...filler.map((w) => ({ word: w, type: "filler" as const })),
  ].sort((a, b) => b.word.length - a.word.length);

  const rec = (idx: number): boolean => {
    if (budget.nodes <= 0) return false;
    if (idx === rest.length) return free.size === 0;
    for (let attempt = 0; attempt < 12 && budget.nodes > 0; attempt++) {
      const cells = placeWord(rest[idx].word.length, free, rand, budget);
      if (!cells) break;
      for (const c of cells) free.delete(c);
      placements.push({ word: rest[idx].word, type: rest[idx].type, path: cells });
      if (rec(idx + 1)) return true;
      placements.pop();
      for (const c of cells) free.add(c);
    }
    return false;
  };
  if (!rec(0)) return null;

  const letters = new Array<string>(CELL_COUNT).fill("");
  for (const p of placements) p.path.forEach((cell, i) => { letters[cell] = p.word[i].toUpperCase(); });
  if (letters.some((x) => x === "")) return null;

  // stable answer ids: spangram, rungs r0..r3, fillers f0..f1
  let ri = 0, fi = 0;
  const answers: Answer[] = placements.map((p) => {
    const id = p.type === "spangram" ? "spangram" : p.type === "rung" ? `rung-${ri++}` : `filler-${fi++}`;
    return { id, type: p.type, word: p.word, path: p.path };
  });
  return { letters, answers };
}

// ---------- fairness / uniqueness gate ----------

/** A ladder is valid iff it is 4 distinct 5-letter words each one substitution apart. */
export function isValidLadder(ladder: readonly string[]): boolean {
  if (ladder.length !== 4) return false;
  if (new Set(ladder).size !== 4) return false;
  if (!ladder.every((w) => w.length === 5)) return false;
  for (let i = 1; i < ladder.length; i++) {
    let diff = 0;
    for (let k = 0; k < 5; k++) if (ladder[i][k] !== ladder[i - 1][k]) diff++;
    if (diff !== 1) return false;               // exactly one substitution (edit-distance-1)
  }
  return true;
}

/**
 * NFR-006/008/009 + REQ-009 — validate a built puzzle:
 *  - perfect cover: every cell used exactly once;
 *  - each placement is a contiguous 8-neighbour path spelling its word;
 *  - the spangram touches the top row AND the bottom row (spans opposite sides);
 *  - the ladder is a valid edit-distance-1 chain;
 *  - exactly 1 spangram, 4 rungs, 2 fillers.
 * Returns null if fair, else a reason string.
 */
export function validatePuzzle(p: Puzzle): string | null {
  if (p.letters.length !== CELL_COUNT) return "grid size";
  const cover = new Array<number>(CELL_COUNT).fill(0);
  for (const a of p.answers) {
    if (a.path.length !== a.word.length) return `len ${a.id}`;
    for (let i = 0; i < a.path.length; i++) {
      const cell = a.path[i];
      if (cell < 0 || cell >= CELL_COUNT) return `oob ${a.id}`;
      if (p.letters[cell] !== a.word[i].toUpperCase()) return `letter ${a.id}@${i}`;
      cover[cell]++;
      if (i > 0) {
        const pr = Math.floor(a.path[i - 1] / COLS), pc = a.path[i - 1] % COLS;
        const cr = Math.floor(cell / COLS), cc = cell % COLS;
        if (Math.abs(pr - cr) > 1 || Math.abs(pc - cc) > 1 || (pr === cr && pc === cc)) return `adj ${a.id}@${i}`;
      }
    }
  }
  if (cover.some((c) => c !== 1)) return "not perfect cover";       // NFR-006
  const span = p.answers.find((a) => a.type === "spangram");
  if (!span) return "no spangram";
  const rows = new Set(span.path.map((c) => Math.floor(c / COLS)));
  if (!rows.has(0)) return "spangram misses top row";               // NFR-008
  if (!rows.has(ROWS - 1)) return "spangram misses bottom row";     // NFR-009
  if (p.answers.filter((a) => a.type === "rung").length !== 4) return "need 4 rungs";
  if (p.answers.filter((a) => a.type === "filler").length !== 2) return "need 2 fillers";
  if (!isValidLadder(p.ladder)) return "invalid ladder";
  return null;
}
