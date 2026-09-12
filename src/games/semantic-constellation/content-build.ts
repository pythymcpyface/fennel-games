import type { Answer, Cluster, Puzzle } from "./types.ts";
import { CELL_COUNT, COLS, ROWS } from "./types.ts";
import { validatePerfectCover, rowOfIn, type GridDims } from "../../kit/grid-pack.ts";

// Build-time content shaping + fairness gate for Semantic Constellation. Pure.
// The build tool supplies packed placements + each theme word's signed rank margin
// (rankB - rankA); this module assigns clusters, shapes the Puzzle, and validates.

const G: GridDims = { rows: ROWS, cols: COLS };

export interface ThemePick { word: string; margin: number; }   // margin = rankB - rankA (>0 => cluster A)

/**
 * Assign clusters from signed rank margins. Cluster A = decisively closer to
 * anchor A (margin >= +minMargin); cluster B = decisively closer to B
 * (margin <= -minMargin). Requires exactly 2 A and 2 B, each decisive; else null.
 */
export function assignClusters(picks: ThemePick[], minMargin = 25): Record<string, Cluster> | null {
  if (picks.length !== 4) return null;
  const out: Record<string, Cluster> = {};
  let a = 0, b = 0;
  for (const p of picks) {
    if (p.margin >= minMargin) { out[p.word] = "A"; a++; }
    else if (p.margin <= -minMargin) { out[p.word] = "B"; b++; }
    else return null;                          // coin-flip word — reject
  }
  if (a !== 2 || b !== 2) return null;          // balanced 2/2 split
  return out;
}

export interface CandidatePuzzle {
  anchorA: string;
  anchorB: string;
  spangram: string;
  themes: ThemePick[];       // 4 (2 A + 2 B)
  fillers: string[];         // 2
  placements: Array<{ word: string; type: Answer["type"]; path: number[] }>;
  letters: string[];
}

export function toPuzzle(c: CandidatePuzzle, puzzleId: string): Puzzle | null {
  const clusters = assignClusters(c.themes);
  if (!clusters) return null;
  let ti = 0, fi = 0;
  const answers: Answer[] = c.placements.map((p) => {
    if (p.type === "spangram") return { id: "spangram", type: "spangram", word: p.word, path: p.path };
    if (p.type === "theme") { const id = `theme-${ti++}`; return { id, type: "theme", word: p.word, path: p.path, cluster: clusters[p.word] }; }
    return { id: `filler-${fi++}`, type: "filler", word: p.word, path: p.path };
  });
  return { puzzleId, letters: c.letters, answers, anchorA: c.anchorA, anchorB: c.anchorB };
}

/**
 * Fairness gate: perfect cover + contiguous paths (shared kit) PLUS
 *  - exactly 1 spangram / 4 theme / 2 filler;
 *  - spangram spans top row AND bottom row;
 *  - themes split decisively 2 (cluster A) + 2 (cluster B).
 */
export function validatePuzzle(p: Puzzle): string | null {
  const cover = validatePerfectCover(p.letters, p.answers, G);
  if (cover) return cover;
  if (p.answers.filter((a) => a.type === "spangram").length !== 1) return "need 1 spangram";
  const themes = p.answers.filter((a) => a.type === "theme");
  if (themes.length !== 4) return "need 4 theme";
  if (p.answers.filter((a) => a.type === "filler").length !== 2) return "need 2 filler";
  const span = p.answers.find((a) => a.type === "spangram")!;
  const rows = new Set(span.path.map((c) => rowOfIn(c, G)));
  if (!rows.has(0)) return "spangram misses top row";
  if (!rows.has(ROWS - 1)) return "spangram misses bottom row";
  if (themes.some((a) => a.cluster !== "A" && a.cluster !== "B")) return "theme missing cluster";
  if (themes.filter((a) => a.cluster === "A").length !== 2) return "cluster A not 2";
  if (themes.filter((a) => a.cluster === "B").length !== 2) return "cluster B not 2";
  if (!p.anchorA || !p.anchorB || p.anchorA === p.anchorB) return "bad anchors";
  return null;
}

export { CELL_COUNT };
