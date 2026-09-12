import type { Coord, Puzzle } from "./types.ts";
import { isAdjacent, isShoreToShore, spelledText } from "./engine.ts";

// Build-time content generation + fairness gate for Isthmus. Pure + deterministic.

/**
 * Find one valid shore-to-shore word path in a grid: an 8-adjacent, no-reuse path
 * from a top-row tile to a bottom-row tile whose letters form a dictionary word of
 * length >= minLen. DFS with a node budget for determinism/termination.
 */
export function findSolution(
  grid: string[][],
  dictionary: ReadonlySet<string>,
  minLen: number,
  nodeBudget = 200000,
): Coord[] | null {
  const rows = grid.length;
  const cols = grid[0].length;
  let budget = nodeBudget;
  let result: Coord[] | null = null;

  const dfs = (path: Coord[], seen: Set<string>): void => {
    if (result || budget <= 0) return;
    budget--;
    const last = path[path.length - 1];
    // Check completion at a bottom tile.
    if (path.length >= minLen && last.row === rows - 1 && isShoreToShore(path, rows)) {
      const word = spelledText(path, grid);
      if (dictionary.has(word)) {
        result = [...path];
        return;
      }
    }
    if (path.length >= rows * cols) return;
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const nr = last.row + dr;
        const nc = last.col + dc;
        if (nr < 0 || nc < 0 || nr >= rows || nc >= cols) continue;
        const key = `${nr},${nc}`;
        if (seen.has(key)) continue;
        if (!isAdjacent(last, { row: nr, col: nc })) continue;
        seen.add(key);
        path.push({ row: nr, col: nc });
        dfs(path, seen);
        path.pop();
        seen.delete(key);
        if (result) return;
      }
    }
  };

  for (let c = 0; c < cols && !result; c++) {
    const start = { row: 0, col: c };
    dfs([start], new Set([`0,${c}`]));
  }
  return result;
}

/**
 * Build a validated puzzle from a grid. If a known candidate solution path is
 * supplied (from the embedder), it is verified directly (fast). Otherwise a DFS
 * search finds one. The fairness gate requires at least one shore-to-shore
 * dictionary word path of length >= minLen.
 */
export function buildPuzzle(
  grid: string[][],
  dictionary: ReadonlySet<string>,
  puzzleId: string,
  minLen: number,
  knownPath?: Coord[],
): Puzzle | null {
  let solution: Coord[] | null = null;
  if (knownPath && knownPath.length >= minLen && isShoreToShore(knownPath, grid.length)) {
    // Verify adjacency + dictionary of the known path (O(len)).
    let ok = true;
    for (let i = 1; i < knownPath.length; i++) {
      if (!isAdjacent(knownPath[i - 1], knownPath[i])) { ok = false; break; }
    }
    if (ok && dictionary.has(spelledText(knownPath, grid))) solution = knownPath;
  }
  if (solution === null) {
    solution = findSolution(grid, dictionary, minLen, 200000);
  }
  if (solution === null) return null;
  return {
    puzzleId,
    rows: grid.length,
    cols: grid[0].length,
    grid: grid.map((r) => r.map((ch) => ch.toUpperCase())),
    solution,
  };
}

/** Gate assertion: the stored solution is a valid shore-to-shore dictionary word. */
export function assertPuzzleValid(p: Puzzle, dictionary: ReadonlySet<string>): void {
  const path = p.solution;
  if (path.length < 2) throw new Error(`solution too short for ${p.puzzleId}`);
  for (let i = 1; i < path.length; i++) {
    if (!isAdjacent(path[i - 1], path[i])) throw new Error(`non-adjacent solution step in ${p.puzzleId}`);
  }
  if (!isShoreToShore(path, p.rows)) throw new Error(`solution not shore-to-shore in ${p.puzzleId}`);
  const word = spelledText(path, p.grid);
  if (!dictionary.has(word)) throw new Error(`solution word not in dictionary for ${p.puzzleId}`);
}
