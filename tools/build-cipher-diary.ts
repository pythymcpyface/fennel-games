import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { fnv1a32 } from "../src/kit/selection.ts";
import { buildPuzzle, assertPuzzleValid, type RawPuzzle } from "../src/games/cipher-diary/content-build.ts";
import type { Puzzle } from "../src/games/cipher-diary/types.ts";

// Cipher Diary build tool. Authored diary entries, each encrypted with a
// deterministic derangement of A-Z (no letter maps to itself), revealing a few
// of the used cipher letters as the carried-over key fragment. The fairness gate
// re-verifies bijection, encryption consistency, and fragment bounds.

const PACK_VERSION = "1.0.0";
const DATASET_ID = "cipher-diary.curated.v1";
const REVEAL = 4;

const ENTRIES: string[] = [
  "The harbour was quiet today. I watched the boats return and counted every sail against the fading light.",
  "A stranger left a letter on my desk. It smelled of rain and old paper, and it changed everything I believed.",
  "We planted the last of the seeds before dusk. Tomorrow the garden begins, and with it a small quiet hope.",
  "The clock in the hall stopped at noon. I did not wind it, for I wished the afternoon would last much longer.",
  "Snow fell on the mountain path. My boots left the only marks, and the silence felt like a gift meant for me.",
  "I found an old map folded inside a book. Its ink had faded, but the route it drew still called to me clearly.",
];

/** Deterministic derangement of A-Z (no fixed points) seeded by a string. */
function derangement(seed: string): Record<string, string> {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
  let s = fnv1a32(seed) >>> 0;
  const rand = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 0x100000000; };
  // Fisher-Yates then fix any fixed points by swapping with a neighbour.
  const perm = alphabet.slice();
  for (let i = perm.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [perm[i], perm[j]] = [perm[j], perm[i]];
  }
  for (let i = 0; i < 26; i++) {
    if (perm[i] === alphabet[i]) {
      const k = (i + 1) % 26;
      [perm[i], perm[k]] = [perm[k], perm[i]];
    }
  }
  // Final pass: if the swap re-created a fixed point at k, rotate once more.
  for (let i = 0; i < 26; i++) {
    if (perm[i] === alphabet[i]) {
      const k = (i + 2) % 26;
      [perm[i], perm[k]] = [perm[k], perm[i]];
    }
  }
  const map: Record<string, string> = {};
  alphabet.forEach((a, i) => (map[a] = perm[i]));
  return map;
}

function main(): void {
  const puzzles: Puzzle[] = [];
  ENTRIES.forEach((text, i) => {
    let plainToCipher = derangement(`cipher-diary-${i}`);
    // Guarantee no fixed point among letters actually used.
    const used = new Set(text.toUpperCase().split("").filter((c) => /[A-Z]/.test(c)));
    let attempts = 0;
    while ([...used].some((p) => plainToCipher[p] === p) && attempts < 10) {
      plainToCipher = derangement(`cipher-diary-${i}-${attempts}`);
      attempts++;
    }
    const raw: RawPuzzle = { plaintext: text, plainToCipher, revealCount: REVEAL };
    const id = `puz-${puzzles.length.toString().padStart(4, "0")}`;
    const p = buildPuzzle(id, raw);
    if (p === null) {
      // eslint-disable-next-line no-console
      console.warn(`skipped invalid entry #${i}:`, );
      return;
    }
    assertPuzzleValid(raw);
    puzzles.push(p);
  });
  if (puzzles.length < 4) throw new Error(`Cipher Diary: too few valid puzzles (${puzzles.length}).`);

  const pack = {
    contentPackVersion: PACK_VERSION,
    datasetId: DATASET_ID,
    puzzleCount: puzzles.length,
    dayBoundaryRule: "UTC" as const,
    puzzles,
  };
  const outDir = join(dirname(fileURLToPath(import.meta.url)), "..", "public");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "cipher-diary.json"), JSON.stringify(pack));
  // eslint-disable-next-line no-console
  console.log(`cipher-diary.json: ${puzzles.length} puzzles`);
}

main();
