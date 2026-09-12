import { describe, it, expect } from "vitest";
import { validate, buildPuzzle, assertPuzzleValid, encrypt, invert, type RawPuzzle } from "../src/games/cipher-diary/content-build.ts";
import { buildShareText, isSpoilerSafe, progressBand } from "../src/games/cipher-diary/share.ts";
import { evaluate, initAttempt } from "../src/games/cipher-diary/engine.ts";

// plain->cipher: C->X A->Y T->Z D->P O->Q G->R (a partial derangement over used letters)
const p2c = { C: "X", A: "Y", T: "Z", D: "P", O: "Q", G: "R" };
function raw(): RawPuzzle {
  return { plaintext: "CAT DOG.", plainToCipher: p2c, revealCount: 2 };
}

describe("cipher-diary content-build — encrypt & invert", () => {
  it("encrypt substitutes letters and preserves non-letters", () => {
    expect(encrypt("CAT DOG.", p2c)).toBe("XYZ PQR.");
  });

  it("invert flips plain->cipher to cipher->plain", () => {
    expect(invert(p2c)).toEqual({ X: "C", Y: "A", Z: "T", P: "D", Q: "O", R: "G" });
  });
});

describe("cipher-diary content-build — fairness gate", () => {
  it("accepts a consistent puzzle and builds ciphertext + fragment", () => {
    expect(validate(raw())).toEqual([]);
    const p = buildPuzzle("puz-0000", raw())!;
    expect(p).not.toBeNull();
    expect(p.ciphertext).toBe("XYZ PQR.");
    expect(Object.keys(p.fragment)).toHaveLength(2);
    expect(() => assertPuzzleValid(raw())).not.toThrow();
  });

  it("rejects empty plaintext (REQ-016)", () => {
    const r = raw();
    r.plaintext = "   ";
    expect(validate(r)).toContain("plaintext must be non-empty");
  });

  it("rejects a non-bijective key (REQ-017)", () => {
    const r = raw();
    r.plainToCipher = { ...p2c, A: "X" }; // A and C both -> X
    expect(validate(r).some((x) => x.includes("not a bijection"))).toBe(true);
  });

  it("rejects an identity (self) mapping", () => {
    const r = raw();
    r.plainToCipher = { ...p2c, C: "C" };
    expect(validate(r).some((x) => x.includes("maps to itself"))).toBe(true);
  });

  it("rejects fragment revealing 0 or all used letters (REQ-020/021)", () => {
    const none = raw();
    none.revealCount = 0;
    expect(validate(none).some((x) => x.includes("at least one"))).toBe(true);
    const all = raw();
    all.revealCount = 6; // all used cipher letters
    expect(validate(all).some((x) => x.includes("not reveal all"))).toBe(true);
  });
});

describe("cipher-diary share — spoiler safety", () => {
  it("emits a band + lock glyph with no decoded letters", () => {
    const p = buildPuzzle("puz-0000", raw())!;
    const s = initAttempt(p, "2026-01-01");
    const r = evaluate(p, s.mapping);
    const text = buildShareText(r, "2026-01-01");
    expect(text).toContain("Cipher Diary 2026-01-01");
    expect(isSpoilerSafe(text)).toBe(true);
    // Only the fixed "Cipher Diary" words contain letters.
    expect(text.replace("Cipher Diary", "")).not.toMatch(/[A-Za-z]/);
  });

  it("progressBand maps fractions to bands", () => {
    expect(progressBand({ preview: "", correct: 0, total: 6, solved: false })).toBe("B0");
    expect(progressBand({ preview: "", correct: 6, total: 6, solved: true })).toBe("B5");
    expect(progressBand({ preview: "", correct: 3, total: 6, solved: false })).toBe("B2");
  });

  it("isSpoilerSafe flags leaked decoded text", () => {
    expect(isSpoilerSafe("Cipher Diary\nCAT DOG")).toBe(false);
  });
});
