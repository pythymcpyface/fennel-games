import type { Answer, Band, Puzzle } from "./types.ts";
import { BANDS, CELL_COUNT, COLS, ROWS } from "./types.ts";
import { validatePerfectCover, rowOfIn, type GridDims } from "../../kit/grid-pack.ts";

// Build-time content shaping + fairness gate for Semantic Gradient. Pure. The
// build tool supplies the packed placements (via shared kit/grid-pack) plus each
// theme word's neighbour RANK to the anchor; this module assigns closeness bands,
// shapes the Puzzle, and validates fairness.

const G: GridDims = { rows: ROWS, cols: COLS };

export interface ThemePick { word: string; rank: number; }   // rank to the anchor (1 = closest)

/**
 * Assign the four theme picks (sorted by ascending rank = closeness) to the four
 * distinct bands hot→cold. Requires exactly 4 picks; returns null if not decisive
 * (adjacent ranks must differ by >= minMargin so temperatures are meaningful, not
 * a coin-flip — RISK: 50d GloVe noise).
 */
export function assignBands(picks: ThemePick[], minMargin = 8): Record<string, Band> | null {
  if (picks.length !== 4) return null;
  const sorted = [...picks].sort((a, b) => a.rank - b.rank);
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].rank - sorted[i - 1].rank < minMargin) return null;   // decisive separation
  }
  const out: Record<string, Band> = {};
  sorted.forEach((p, i) => { out[p.word] = BANDS[i]; });
  return out;
}

export interface CandidatePuzzle {
  anchor: string;
  spangram: string;
  themes: ThemePick[];       // 4
  fillers: string[];         // 2
  placements: Array<{ word: string; type: Answer["type"]; path: number[] }>;
  letters: string[];
}

/** Shape a validated candidate into a Puzzle with band-annotated theme answers. */
export function toPuzzle(c: CandidatePuzzle, puzzleId: string): Puzzle | null {
  const bands = assignBands(c.themes);
  if (!bands) return null;
  let ti = 0, fi = 0;
  const answers: Answer[] = c.placements.map((p) => {
    if (p.type === "spangram") return { id: "spangram", type: "spangram", word: p.word, path: p.path };
    if (p.type === "theme") { const id = `theme-${ti++}`; return { id, type: "theme", word: p.word, path: p.path, band: bands[p.word] }; }
    return { id: `filler-${fi++}`, type: "filler", word: p.word, path: p.path };
  });
  return { puzzleId, letters: c.letters, answers, anchor: c.anchor };
}

/**
 * Fairness gate: perfect cover + contiguous paths (shared kit) PLUS
 *  - exactly 1 spangram / 4 theme / 2 filler;
 *  - spangram spans top row AND bottom row;
 *  - the four theme words carry four DISTINCT bands (decisive separation).
 * Returns null if fair, else a reason.
 */
export function validatePuzzle(p: Puzzle): string | null {
  const cover = validatePerfectCover(p.letters, p.answers, G);
  if (cover) return cover;
  if (p.answers.filter((a) => a.type === "spangram").length !== 1) return "need 1 spangram";
  if (p.answers.filter((a) => a.type === "theme").length !== 4) return "need 4 theme";
  if (p.answers.filter((a) => a.type === "filler").length !== 2) return "need 2 filler";
  const span = p.answers.find((a) => a.type === "spangram")!;
  const rows = new Set(span.path.map((c) => rowOfIn(c, G)));
  if (!rows.has(0)) return "spangram misses top row";
  if (!rows.has(ROWS - 1)) return "spangram misses bottom row";
  const bands = p.answers.filter((a) => a.type === "theme").map((a) => a.band);
  if (bands.some((b) => !b)) return "theme missing band";
  if (new Set(bands).size !== 4) return "theme bands not distinct";
  if (!p.anchor) return "no anchor";
  return null;
}

export { CELL_COUNT };
