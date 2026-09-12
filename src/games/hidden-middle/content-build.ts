import type { Puzzle } from "./types.ts";

// Build-time content generation + uniqueness gate (TERM-015/016, JOURNEY-006). Pure.

export interface CandidatePuzzle {
  carrierWord: string;
  clue: string;
  answerWord: string;
}

/** All contiguous substrings of `carrier` (length ≥ 2) that are dictionary words. */
export function dictionarySubstrings(carrier: string, dictionary: ReadonlySet<string>): string[] {
  const found = new Set<string>();
  for (let i = 0; i < carrier.length; i++) {
    for (let j = i + 2; j <= carrier.length; j++) {
      const sub = carrier.slice(i, j);
      if (dictionary.has(sub)) found.add(sub);
    }
  }
  return [...found].sort();
}

/**
 * REQ (JOURNEY-006 gate) — a candidate is fair iff the answer is a dictionary-word
 * substring of the carrier AND, among substrings the clue could match, exactly one
 * (the answer) qualifies. Here the clue→answers index carries the intended mapping;
 * the gate rejects carriers where >1 dictionary substring is listed for the clue.
 */
export function isFair(
  cand: CandidatePuzzle,
  dictionary: ReadonlySet<string>,
  clueIndex: Record<string, string[]>,
): boolean {
  const carrier = cand.carrierWord.toUpperCase();
  const answer = cand.answerWord.toUpperCase();
  if (!carrier.includes(answer)) return false;
  if (!dictionary.has(answer)) return false;
  // Candidate answers for this clue that are ALSO dictionary substrings of the carrier.
  const subs = new Set(dictionarySubstrings(carrier, dictionary));
  const clueAnswers = (clueIndex[cand.clue] ?? []).map((w) => w.toUpperCase()).filter((w) => subs.has(w));
  return clueAnswers.length === 1 && clueAnswers[0] === answer;
}

export function buildPuzzles(
  candidates: CandidatePuzzle[],
  dictionary: ReadonlySet<string>,
  clueIndex: Record<string, string[]>,
): Puzzle[] {
  const out: Puzzle[] = [];
  for (const c of candidates) {
    if (!isFair(c, dictionary, clueIndex)) continue;
    out.push({ puzzleId: "", carrierWord: c.carrierWord.toUpperCase(), clue: c.clue, answerWord: c.answerWord.toUpperCase() });
  }
  out.sort((a, b) => (a.carrierWord < b.carrierWord ? -1 : a.carrierWord > b.carrierWord ? 1 : 0));
  return out.map((p, i) => ({ ...p, puzzleId: `puz-${i.toString().padStart(4, "0")}` }));
}

export function assertPuzzlesValid(puzzles: Puzzle[], dictionary: ReadonlySet<string>, clueIndex: Record<string, string[]>): void {
  for (const p of puzzles) {
    if (!isFair({ carrierWord: p.carrierWord, clue: p.clue, answerWord: p.answerWord }, dictionary, clueIndex)) {
      throw new Error(`unfair puzzle ${p.puzzleId}`);
    }
  }
}
