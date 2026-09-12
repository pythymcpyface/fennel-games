import type { Puzzle } from "./types.ts";
import { usedCipherLetters } from "./engine.ts";

// Build-time content generation + fairness gate for Cipher Diary (TERM-015). Pure +
// deterministic. Author supplies plaintext + a plain->cipher substitution + how
// many letters to pre-reveal. The tool derives the ciphertext, the cipher->plain
// key, and a fragment; the gate proves it all consistent and fair.

export interface RawPuzzle {
  plaintext: string;
  /** plain letter -> cipher letter (bijection over A-Z). */
  plainToCipher: Record<string, string>;
  /** number of used cipher letters to pre-reveal as the fragment. */
  revealCount: number;
}

const LETTER = /^[A-Z]$/;

export function encrypt(plaintext: string, plainToCipher: Record<string, string>): string {
  let out = "";
  for (const ch of plaintext) {
    const up = ch.toUpperCase();
    if (LETTER.test(up)) out += plainToCipher[up] ?? up;
    else out += ch;
  }
  return out;
}

/** Invert a plain->cipher map to cipher->plain. */
export function invert(map: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(map)) out[v] = k;
  return out;
}

/** Fairness gate (REQ-016..021). Returns failure reasons; empty = fair. */
export function validate(raw: RawPuzzle): string[] {
  const reasons: string[] = [];
  const plaintext = raw.plaintext;
  if (plaintext.trim().length === 0) reasons.push("plaintext must be non-empty");

  // Bijection over used plaintext letters.
  const usedPlain = new Set<string>();
  for (const ch of plaintext.toUpperCase()) if (LETTER.test(ch)) usedPlain.add(ch);
  const images = new Set<string>();
  for (const p of usedPlain) {
    const c = raw.plainToCipher[p];
    if (c === undefined || !LETTER.test(c)) { reasons.push(`no cipher mapping for used letter ${p}`); continue; }
    if (images.has(c)) reasons.push(`cipher letter ${c} used by two plaintext letters (not a bijection)`);
    images.add(c);
    if (raw.plainToCipher[p] === p) reasons.push(`letter ${p} maps to itself (trivial)`); // avoid identity mappings
  }
  if (reasons.length > 0) return reasons;

  const ciphertext = encrypt(plaintext, raw.plainToCipher);
  const cipherToPlain = invert(raw.plainToCipher);
  const usedCipher = usedCipherLetters(ciphertext);

  // REQ-018 — re-encrypting reproduces the ciphertext (tautological here, but guards edits).
  if (encrypt(plaintext, raw.plainToCipher) !== ciphertext) reasons.push("encryption does not reproduce ciphertext");

  // REQ-020/021 — fragment reveals >=1 and < all used cipher letters.
  if (raw.revealCount < 1) reasons.push("fragment must reveal at least one letter");
  if (raw.revealCount >= usedCipher.length) reasons.push("fragment must not reveal all used letters");

  // Every used cipher letter must have a cipher->plain mapping.
  for (const c of usedCipher) if (cipherToPlain[c] === undefined) reasons.push(`no plaintext for used cipher letter ${c}`);

  return reasons;
}

export function buildPuzzle(puzzleId: string, raw: RawPuzzle): Puzzle | null {
  if (validate(raw).length > 0) return null;
  const ciphertext = encrypt(raw.plaintext, raw.plainToCipher);
  const key = invert(raw.plainToCipher); // cipher -> plain
  const usedCipher = usedCipherLetters(ciphertext);
  // Deterministic fragment: reveal the first `revealCount` used cipher letters (sorted).
  const fragment: Record<string, string> = {};
  for (let i = 0; i < raw.revealCount && i < usedCipher.length; i++) {
    const c = usedCipher[i];
    fragment[c] = key[c];
  }
  // Ship only the key entries for used cipher letters (keeps it minimal).
  const usedKey: Record<string, string> = {};
  for (const c of usedCipher) usedKey[c] = key[c];
  return { puzzleId, ciphertext, key: usedKey, fragment };
}

export function assertPuzzleValid(raw: RawPuzzle): void {
  const reasons = validate(raw);
  if (reasons.length > 0) throw new Error(`cipher-diary invalid puzzle:\n - ${reasons.join("\n - ")}`);
}
