import type { Puzzle } from "./types.ts";
import { DEFAULT_SUBSTITUTIONS, WORDS_COUNT, type SubstitutionMap } from "./types.ts";
import { encodings } from "./engine.ts";

// Build-time content generation + uniqueness gate. Pure.

export interface CandidateItem {
  clue: string; // numeronym, uppercase
  answer: string; // expansion, uppercase
}
export interface CandidateSet {
  items: CandidateItem[]; // 5
  themeLabel: string;
}

/**
 * REQ-026 — a clue is unambiguous within the theme iff, among the theme's answers,
 * exactly one produces that clue as a valid encoding. Also the clue must actually be
 * a valid encoding of its own answer.
 */
export function isFairSet(cand: CandidateSet, dictionary: ReadonlySet<string>, map: SubstitutionMap = DEFAULT_SUBSTITUTIONS): boolean {
  if (cand.items.length !== WORDS_COUNT) return false;
  if (!cand.themeLabel.trim()) return false;
  const answers = cand.items.map((it) => it.answer.toUpperCase());
  if (new Set(answers).size !== WORDS_COUNT) return false;
  for (const it of cand.items) {
    const clue = it.clue.toUpperCase();
    const answer = it.answer.toUpperCase();
    if (!/^[A-Z]+$/.test(answer) || !dictionary.has(answer)) return false;
    // clue must be a valid encoding of its answer
    if (!encodings(answer, map).has(clue)) return false;
    // exactly one theme answer yields this clue
    const matches = answers.filter((a) => encodings(a, map).has(clue));
    if (matches.length !== 1 || matches[0] !== answer) return false;
  }
  return true;
}

export function buildPuzzles(candidates: CandidateSet[], dictionary: ReadonlySet<string>, map: SubstitutionMap = DEFAULT_SUBSTITUTIONS): Puzzle[] {
  const out: Puzzle[] = [];
  for (const c of candidates) {
    if (!isFairSet(c, dictionary, map)) continue;
    out.push({
      puzzleId: "",
      clues: c.items.map((it) => it.clue.toUpperCase()),
      answers: c.items.map((it) => it.answer.toUpperCase()),
      themeLabel: c.themeLabel,
    });
  }
  out.sort((a, b) => (a.answers.join() < b.answers.join() ? -1 : 1));
  return out.map((p, i) => ({ ...p, puzzleId: `puz-${i.toString().padStart(4, "0")}` }));
}

export function assertPuzzlesValid(puzzles: Puzzle[], dictionary: ReadonlySet<string>, map: SubstitutionMap = DEFAULT_SUBSTITUTIONS): void {
  for (const p of puzzles) {
    const cand: CandidateSet = { items: p.clues.map((c, i) => ({ clue: c, answer: p.answers[i] })), themeLabel: p.themeLabel };
    if (!isFairSet(cand, dictionary, map)) throw new Error(`unfair set ${p.puzzleId}`);
  }
}
