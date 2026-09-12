import { readFileSync } from "node:fs";
import type { SimilarityProvider } from "../types.ts";

// GloVe vector loader + cosine similarity provider. Reads the pre-trained
// glove.6B.50d.txt (downloaded by scripts/fetch-glove.ts; build-machine only,
// never shipped). Each line: `word f1 f2 ... fN`.

function dot(a: Float32Array, b: Float32Array): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

/**
 * Load GloVe vectors from a text file into an in-memory cosine provider.
 * Vectors are L2-normalised at load so cosine == dot product.
 */
export function loadGloveVectors(path: string): SimilarityProvider {
  const raw = readFileSync(path, "utf8");
  const vecs = new Map<string, Float32Array>();

  for (const line of raw.split("\n")) {
    if (line.length === 0) continue;
    const parts = line.split(" ");
    const word = parts[0];
    const dims = parts.length - 1;
    const v = new Float32Array(dims);
    let norm = 0;
    for (let i = 0; i < dims; i++) {
      const x = Number(parts[i + 1]);
      v[i] = x;
      norm += x * x;
    }
    norm = Math.sqrt(norm);
    if (norm > 0) {
      for (let i = 0; i < dims; i++) v[i] /= norm;
    }
    vecs.set(word, v);
  }

  return {
    has: (word) => vecs.has(word),
    cosine: (a, b) => {
      const va = vecs.get(a);
      const vb = vecs.get(b);
      if (va === undefined || vb === undefined) return -Infinity;
      return dot(va, vb);
    },
  };
}
