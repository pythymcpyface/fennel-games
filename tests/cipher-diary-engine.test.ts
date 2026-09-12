import { describe, it, expect } from "vitest";
import {
  usedCipherLetters,
  decode,
  evaluate,
  initAttempt,
  assign,
  normalizeLetter,
  isSolved,
} from "../src/games/cipher-diary/engine.ts";
import type { Puzzle } from "../src/games/cipher-diary/types.ts";

// Plaintext "CAT DOG." with cipher C->X A->Y T->Z D->P O->Q G->R.
// key is cipher->plain: X->C Y->A Z->T P->D Q->O R->G. ciphertext = "XYZ PQR."
const puzzle: Puzzle = {
  puzzleId: "puz-0000",
  ciphertext: "XYZ PQR.",
  key: { X: "C", Y: "A", Z: "T", P: "D", Q: "O", R: "G" },
  fragment: { X: "C", Y: "A" }, // 2 of 6 revealed
};

describe("cipher-diary engine — decode & count", () => {
  it("usedCipherLetters returns distinct letters in the ciphertext", () => {
    expect(usedCipherLetters("XYZ PQR.")).toEqual(["P", "Q", "R", "X", "Y", "Z"]);
  });

  it("decode applies mapping and preserves non-letters, placeholders unmapped", () => {
    expect(decode("XYZ PQR.", { X: "C", Y: "A", Z: "T" })).toBe("CAT ···.");
  });

  it("normalizeLetter accepts A-Z and rejects others", () => {
    expect(normalizeLetter("c")).toBe("C");
    expect(normalizeLetter("3")).toBeNull();
  });

  it("evaluate counts correct used letters vs the true key", () => {
    const s = initAttempt(puzzle, "2026-01-01"); // fragment X,Y correct
    const r = evaluate(puzzle, s.mapping);
    expect(r.total).toBe(6);
    expect(r.correct).toBe(2);
    expect(r.solved).toBe(false);
  });

  it("full correct mapping is solved and decodes fully", () => {
    const r = evaluate(puzzle, puzzle.key);
    expect(r.solved).toBe(true);
    expect(r.preview).toBe("CAT DOG.");
  });
});

describe("cipher-diary engine — assignment rules", () => {
  it("assigns a guess to an unlocked cipher letter", () => {
    let s = initAttempt(puzzle, "2026-01-01");
    s = assign(s, puzzle, "Z", "T").state;
    expect(s.mapping.Z).toBe("T");
  });

  it("rejects editing a locked fragment letter", () => {
    const s = initAttempt(puzzle, "2026-01-01");
    const out = assign(s, puzzle, "X", "Q");
    expect(out.accepted).toBe(false);
    expect(out.reason).toBe("fragment-locked");
  });

  it("rejects a duplicate plaintext assignment (bijection)", () => {
    let s = initAttempt(puzzle, "2026-01-01"); // X->C already
    const out = assign(s, puzzle, "Z", "C"); // C already used by X
    expect(out.accepted).toBe(false);
    expect(out.reason).toBe("conflict");
  });

  it("rejects invalid characters", () => {
    const s = initAttempt(puzzle, "2026-01-01");
    expect(assign(s, puzzle, "Z", "3").reason).toBe("invalid-letter");
  });

  it("clearing a mapping with null removes it", () => {
    let s = initAttempt(puzzle, "2026-01-01");
    s = assign(s, puzzle, "Z", "T").state;
    s = assign(s, puzzle, "Z", null).state;
    expect(s.mapping.Z).toBeUndefined();
  });

  it("reaches solved when all used letters correctly mapped", () => {
    let s = initAttempt(puzzle, "2026-01-01");
    for (const [c, p] of Object.entries(puzzle.key)) {
      if (puzzle.fragment[c]) continue;
      s = assign(s, puzzle, c, p).state;
    }
    expect(isSolved(s, puzzle)).toBe(true);
    expect(s.isComplete).toBe(true);
  });
});
