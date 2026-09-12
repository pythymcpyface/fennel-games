import type { Entry, Puzzle } from "./types.ts";
import { CANDIDATES_PER_ENTRY } from "./types.ts";
import { fnv1a32 } from "../../kit/selection.ts";

// Build-time content generation + fairness gate for Clueback (TERM-021). Pure +
// deterministic. The gate proves each entry is well-formed and fair:
//   - exactly 3 candidate clues, all distinct (FIELD-011)
//   - exactly one is marked correct; correctIndex in range (FIELD-007)
//   - no clue text leaks the answer (spoiler safety, FIELD-005 rule)
//   - the answer is non-empty letters/spaces (FIELD-005)

export interface RawEntry {
  entryId: string;
  answer: string;
  correctClue: string;
  distractors: [string, string];
}

export function normalizeAnswer(answer: string): string {
  return answer.trim().toUpperCase();
}

/** A clue must not contain the answer word (case-insensitive), else it spoils. */
export function clueLeaksAnswer(clue: string, answer: string): boolean {
  const a = normalizeAnswer(answer).replace(/\s+/g, "");
  if (!a) return false;
  return clue.toUpperCase().replace(/\s+/g, "").includes(a);
}

function isWellFormedAnswer(answer: string): boolean {
  return /^[A-Za-z][A-Za-z ]*$/.test(answer.trim());
}

/**
 * Deterministically shuffle the 3 candidate clues for an entry and report where
 * the correct one landed. Seed is derived from the entryId so the layout is
 * stable across builds/platforms (NFR-002).
 */
export function shuffleCandidates(
  correctClue: string,
  distractors: readonly string[],
  seed: string,
): { candidates: string[]; correctIndex: number } {
  const items = [correctClue, ...distractors];
  const order = Array.from({ length: items.length }, (_, i) => i);
  let s = fnv1a32(seed) >>> 0;
  for (let i = order.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) >>> 0;
    const j = Math.floor((s / 0x100000000) * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  const candidates = order.map((idx) => items[idx]);
  const correctIndex = order.indexOf(0);
  return { candidates, correctIndex };
}

/** Validate + assemble a single fair entry, or return null if it fails the gate. */
export function buildEntry(raw: RawEntry): Entry | null {
  const answer = normalizeAnswer(raw.answer);
  if (!isWellFormedAnswer(raw.answer)) return null;

  const clues = [raw.correctClue, ...raw.distractors].map((c) => c.trim());
  if (clues.some((c) => c.length < 1 || c.length > 160)) return null;
  // All three clues distinct.
  if (new Set(clues.map((c) => c.toUpperCase())).size !== CANDIDATES_PER_ENTRY) return null;
  // No clue may leak the answer.
  if (clues.some((c) => clueLeaksAnswer(c, answer))) return null;

  const { candidates, correctIndex } = shuffleCandidates(clues[0], [clues[1], clues[2]], raw.entryId);
  return { entryId: raw.entryId, answer, candidates, correctIndex };
}

export function buildPuzzle(puzzleId: string, rawEntries: readonly RawEntry[]): Puzzle | null {
  if (rawEntries.length < 3) return null;
  const entries: Entry[] = [];
  const seenIds = new Set<string>();
  for (const raw of rawEntries) {
    if (seenIds.has(raw.entryId)) return null;
    seenIds.add(raw.entryId);
    const entry = buildEntry(raw);
    if (entry === null) return null;
    entries.push(entry);
  }
  return { puzzleId, entries };
}

/** Fairness gate assertion for the build tool (TERM-021). Throws on violation. */
export function assertPuzzleValid(p: Puzzle): void {
  if (p.entries.length < 3) {
    throw new Error(`clueback ${p.puzzleId}: needs >=3 entries, got ${p.entries.length}`);
  }
  for (const e of p.entries) {
    if (e.candidates.length !== CANDIDATES_PER_ENTRY) {
      throw new Error(`clueback ${p.puzzleId}/${e.entryId}: must have exactly 3 candidates`);
    }
    if (new Set(e.candidates.map((c) => c.toUpperCase())).size !== CANDIDATES_PER_ENTRY) {
      throw new Error(`clueback ${p.puzzleId}/${e.entryId}: candidate clues not distinct`);
    }
    if (e.correctIndex < 0 || e.correctIndex >= CANDIDATES_PER_ENTRY) {
      throw new Error(`clueback ${p.puzzleId}/${e.entryId}: correctIndex out of range`);
    }
    if (e.candidates.some((c) => clueLeaksAnswer(c, e.answer))) {
      throw new Error(`clueback ${p.puzzleId}/${e.entryId}: a clue leaks the answer`);
    }
  }
}
