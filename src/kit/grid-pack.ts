// Shared build-time grid packer for Strands-style games (perfect-cover of an
// R×C letter grid by disjoint 8-direction snaking paths). Pure; no fs, no wordkit.
// Generalised from the Edit-Ladder Trails spike (node-budgeted, fail-fast) so that
// Boundary Spangram, Semantic Gradient, Mirror Routes, Semantic Constellation and
// Interlock Weave can all reuse one proven packer. Build-time only.

export interface GridDims { rows: number; cols: number; }

const DIRS8: ReadonlyArray<readonly [number, number]> = [
  [-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1],
];

export function neighboursOf(cell: number, g: GridDims): number[] {
  const r = Math.floor(cell / g.cols), c = cell % g.cols;
  const out: number[] = [];
  for (const [dr, dc] of DIRS8) {
    const nr = r + dr, nc = c + dc;
    if (nr >= 0 && nr < g.rows && nc >= 0 && nc < g.cols) out.push(nr * g.cols + nc);
  }
  return out;
}

export function areAdjacentIn(a: number, b: number, g: GridDims): boolean {
  if (a === b) return false;
  const dr = Math.abs(Math.floor(a / g.cols) - Math.floor(b / g.cols));
  const dc = Math.abs((a % g.cols) - (b % g.cols));
  return dr <= 1 && dc <= 1;
}

/** Deterministic PRNG (mulberry32). */
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

export interface Budget { nodes: number; }

/** Per-word placement constraint (all optional). */
export interface WordSpec {
  word: string;
  /** cells the FIRST letter may occupy (default: any free cell). */
  startCells?: number[];
  /** predicate the LAST cell must satisfy (e.g. bottom row for a spangram). */
  endPredicate?: (cell: number, g: GridDims) => boolean;
}

/** Place one word as an 8-dir simple path over `free`; node-budgeted. */
export function placePath(
  spec: WordSpec,
  g: GridDims,
  free: Set<number>,
  rand: () => number,
  budget: Budget,
): number[] | null {
  const starts = shuffled(spec.startCells ? spec.startCells.filter((c) => free.has(c)) : [...free], rand);
  for (const s of starts) {
    const path = [s];
    const used = new Set<number>([s]);
    const step = (): boolean => {
      if (budget.nodes-- <= 0) return false;
      if (path.length === spec.word.length) {
        return spec.endPredicate ? spec.endPredicate(path[path.length - 1], g) : true;
      }
      for (const nb of shuffled(neighboursOf(path[path.length - 1], g), rand)) {
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

export interface PackedWord { word: string; path: number[]; }

/**
 * Pack an ORDERED list of word specs into a perfect cover of the grid. The first
 * word is placed first (use it for a constrained anchor such as a spangram); the
 * rest are placed in the given order with bounded backtracking. Sum of word
 * lengths MUST equal rows*cols. Returns placements (parallel to `specs`) or null
 * if the node budget is exhausted.
 */
export function packPerfectCover(
  specs: WordSpec[],
  g: GridDims,
  rand: () => number,
  budget: Budget,
): PackedWord[] | null {
  const total = g.rows * g.cols;
  if (specs.reduce((s, w) => s + w.word.length, 0) !== total) return null;
  const free = new Set<number>(Array.from({ length: total }, (_, i) => i));
  const placed: PackedWord[] = [];

  const rec = (idx: number): boolean => {
    if (budget.nodes <= 0) return false;
    if (idx === specs.length) return free.size === 0;
    // a constrained anchor (startCells/endPredicate) gets more restart attempts.
    const attempts = specs[idx].startCells || specs[idx].endPredicate ? 16 : 12;
    for (let a = 0; a < attempts && budget.nodes > 0; a++) {
      const path = placePath(specs[idx], g, free, rand, budget);
      if (!path) break;
      for (const c of path) free.delete(c);
      placed.push({ word: specs[idx].word, path });
      if (rec(idx + 1)) return true;
      placed.pop();
      for (const c of path) free.add(c);
    }
    return false;
  };
  if (!rec(0)) return null;
  return placed;
}

/** Materialise the grid letters (uppercase) from placements over an R×C grid. */
export function lettersFromPlacements(placed: PackedWord[], g: GridDims): string[] | null {
  const letters = new Array<string>(g.rows * g.cols).fill("");
  for (const p of placed) p.path.forEach((cell, i) => { letters[cell] = p.word[i].toUpperCase(); });
  return letters.some((x) => x === "") ? null : letters;
}

/**
 * Generic perfect-cover validator shared by every Strands-style game. Checks:
 *  - grid size; each placement spells its word along a contiguous 8-neighbour path;
 *  - every cell covered exactly once.
 * Game-specific gates (spangram spanning, symmetry, ladder validity, …) run on top.
 */
export function validatePerfectCover(
  letters: readonly string[],
  placements: ReadonlyArray<{ word: string; path: number[] }>,
  g: GridDims,
): string | null {
  const total = g.rows * g.cols;
  if (letters.length !== total) return "grid size";
  const cover = new Array<number>(total).fill(0);
  for (const a of placements) {
    if (a.path.length !== a.word.length) return `len ${a.word}`;
    for (let i = 0; i < a.path.length; i++) {
      const cell = a.path[i];
      if (cell < 0 || cell >= total) return `oob ${a.word}`;
      if (letters[cell] !== a.word[i].toUpperCase()) return `letter ${a.word}@${i}`;
      cover[cell]++;
      if (i > 0 && !areAdjacentIn(a.path[i - 1], cell, g)) return `adj ${a.word}@${i}`;
    }
  }
  if (cover.some((c) => c !== 1)) return "not perfect cover";
  return null;
}

export const rowOfIn = (cell: number, g: GridDims): number => Math.floor(cell / g.cols);
export const colOfIn = (cell: number, g: GridDims): number => cell % g.cols;
export const topRowCells = (g: GridDims): number[] => Array.from({ length: g.cols }, (_, c) => c);
export const bottomRowCells = (g: GridDims): number[] => Array.from({ length: g.cols }, (_, c) => (g.rows - 1) * g.cols + c);
export const leftColCells = (g: GridDims): number[] => Array.from({ length: g.rows }, (_, r) => r * g.cols);
export const rightColCells = (g: GridDims): number[] => Array.from({ length: g.rows }, (_, r) => r * g.cols + g.cols - 1);
