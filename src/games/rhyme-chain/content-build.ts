import type { Puzzle, ClueSlot, RhymeDict } from "./types.ts";
import { rhymes } from "./engine.ts";

// Build-time content generation + gate (TERM-040/041, JOURNEY-005). Pure.

export interface CandidatePuzzle {
  seedWord: string;
  slots: ClueSlot[];
}

/**
 * REQ-020 — each slot's intended answer must rhyme with the previous word
 * (seed for slot 1). REQ-019 — the clue must map to exactly one dictionary word
 * carrying the required rime (checked against a provided clue→words index).
 */
export function isValidChain(
  cand: CandidatePuzzle,
  dict: RhymeDict,
  clueIndex: Record<string, string[]>,
): boolean {
  if (cand.slots.length === 0) return false;
  let prev = cand.seedWord.toLowerCase();
  if (dict[prev] === undefined) return false;
  for (const slot of cand.slots) {
    const ans = slot.answer.toLowerCase();
    if (dict[ans] === undefined) return false;
    // rhyme chain unbroken
    if (!rhymes(ans, prev, dict)) return false;
    // clue maps to exactly one word with the required rime (unambiguous)
    const candidates = (clueIndex[slot.clue] ?? []).filter((w) => rhymes(w, prev, dict));
    if (candidates.length !== 1 || candidates[0].toLowerCase() !== ans) return false;
    prev = ans;
  }
  return true;
}

/** Build validated puzzles from candidates, applying the gate. */
export function buildPuzzles(
  candidates: CandidatePuzzle[],
  dict: RhymeDict,
  clueIndex: Record<string, string[]>,
): Puzzle[] {
  const out: Puzzle[] = [];
  for (const c of candidates) {
    if (!isValidChain(c, dict, clueIndex)) continue;
    out.push({
      puzzleId: "",
      seedWord: c.seedWord.toLowerCase(),
      slots: c.slots.map((s) => ({ clue: s.clue, answer: s.answer.toLowerCase() })),
    });
  }
  out.sort((a, b) => (a.seedWord < b.seedWord ? -1 : a.seedWord > b.seedWord ? 1 : 0));
  return out.map((p, i) => ({ ...p, puzzleId: `puz-${i.toString().padStart(4, "0")}` }));
}

export function assertPuzzlesValid(puzzles: Puzzle[], dict: RhymeDict, clueIndex: Record<string, string[]>): void {
  for (const p of puzzles) {
    if (!isValidChain({ seedWord: p.seedWord, slots: p.slots }, dict, clueIndex)) {
      throw new Error(`invalid chain for ${p.puzzleId}`);
    }
  }
}
