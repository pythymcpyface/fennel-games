// Lowball content build tool. Build-time only: reads the full en-GB corpus and the
// gitignored GloVe vector file, scores every candidate answer, applies the six-rule
// fairness gate, and writes public/lowball.json.
//
// Why this reads the GloVe file directly rather than via loadGloveVectors(): the
// panel score needs each word's VOCABULARY RANK, not cosine similarity. GloVe's
// 400k-line vocabulary is ordered by descending corpus frequency, so a word's line
// number is its frequency rank. Only the first token of each line is parsed, so this
// never materialises the 163 MB of vectors.
//
// Nothing under src/ imports this file, keeping GloVe and SCOWL out of the client
// bundle entirely (ADR-005, REQ-044).

import { writeFileSync, mkdirSync, existsSync, createReadStream } from "node:fs";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadCorpus, wordTier, DICTIONARY_ID } from "../wordkit/src/index.ts";
import { fnv1a32 } from "../src/kit/selection.ts";
import {
  buildPuzzles,
  assertPuzzlesValid,
  gateFailureReason,
  groupWordsByAffix,
  isBlockedWord,
  isSafeAffix,
  MIN_ANSWERS,
  MAX_ANSWERS,
  type Candidate,
  type GateFailure,
  type ScoredWord,
} from "../src/games/lowball/content-build.ts";
import { matchesRule, type CategoryRule } from "../src/games/lowball/types.ts";

const PACK_VERSION = "1.1.0";
const TARGET_PUZZLES = 120;
/** Hard floor: a shipped pack must offer at least this many days (REQ-046). */
const MIN_PUZZLES = 120;
/** Serialised size ceiling in bytes (REQ-045). */
const MAX_PACK_BYTES = 200 * 1024;

/** Read only the first token of each GloVe line; line number is the frequency rank. */
async function loadGloveRanks(path: string, needed: Set<string>): Promise<Map<string, number>> {
  const ranks = new Map<string, number>();
  const rl = createInterface({ input: createReadStream(path), crlfDelay: Infinity });
  let lineNo = 0;
  for await (const line of rl) {
    lineNo++;
    const sp = line.indexOf(" ");
    const word = sp === -1 ? line : line.slice(0, sp);
    if (needed.has(word) && !ranks.has(word)) ranks.set(word, lineNo);
  }
  return ranks;
}

async function main(): Promise<void> {
  const here = dirname(fileURLToPath(import.meta.url));

  // REQ-043: fail fast and name the path, rather than silently scoring everything 0.
  const glovePath = join(here, "..", "wordkit", "vectors", "glove.6B.50d.txt");
  if (!existsSync(glovePath)) {
    throw new Error(
      `GloVe vectors not found at ${glovePath}. Lowball's panel score is derived from ` +
        `corpus frequency rank; run scripts/fetch-glove.ts to download them.`,
    );
  }

  // Full corpus across every tier: the answer list must be exhaustive for its
  // category, because that list is the runtime validator (ADR-002).
  const words = loadCorpus({ maxTier: 70, alphaOnly: true }).filter(
    (w) => w.length >= 3 && !isBlockedWord(w),
  );
  const tierOf = new Map<string, number>();
  for (const w of words) {
    const t = wordTier(w);
    if (t !== null) tierOf.set(w, t);
  }

  // --- enumerate candidate categories ---------------------------------------
  // Grouping delegates to the shared predicate, so build-time membership cannot
  // diverge from what the runtime engine accepts (REQ-004).
  const groups = groupWordsByAffix(words);

  // Only groups already in the admissible size band are worth ranking.
  const viable = [...groups.entries()].filter(
    ([key, list]) =>
      list.length >= MIN_ANSWERS &&
      list.length <= MAX_ANSWERS &&
      // REQ-003: an affix that is itself a blocked term must never become a prompt.
      isSafeAffix(key.slice(key.indexOf(":") + 1)),
  );
  const needed = new Set<string>();
  for (const [, list] of viable) for (const w of list) needed.add(w);

  process.stdout.write(
    `lowball: ${words.length} corpus words, ${groups.size} affix groups, ` +
      `${viable.length} in the ${MIN_ANSWERS}..${MAX_ANSWERS} band, ${needed.size} words to rank\n`,
  );

  const ranks = await loadGloveRanks(glovePath, needed);
  process.stdout.write(
    `lowball: resolved ${ranks.size}/${needed.size} GloVe ranks ` +
      `(${((100 * ranks.size) / Math.max(1, needed.size)).toFixed(1)}% in vocabulary)\n`,
  );

  // --- run the fairness gate -------------------------------------------------
  const candidates: Candidate[] = [];
  const rejections = new Map<GateFailure, number>();
  for (const [key, list] of viable) {
    const [type, value] = key.split(":") as ["prefix" | "suffix", string];
    const scored: ScoredWord[] = [...list].sort().map((w) => ({
      word: w,
      rank: ranks.get(w) ?? null,
      tier: tierOf.get(w) ?? 70,
    }));
    const rule: CategoryRule = { kind: type, value };
    const candidate: Candidate = { rule, words: scored };
    const failure = gateFailureReason(candidate);
    if (failure !== null) {
      rejections.set(failure, (rejections.get(failure) ?? 0) + 1);
      continue;
    }
    candidates.push(candidate);
  }

  process.stdout.write(`lowball: ${candidates.length} categories passed the fairness gate\n`);
  for (const [reason, n] of [...rejections.entries()].sort((a, b) => b[1] - a[1])) {
    process.stdout.write(`  rejected ${String(n).padStart(5)} — ${reason}\n`);
  }

  // Deterministic ordering. Sorting by a hash of the rule rather than
  // alphabetically spreads the selected categories across the alphabet and across
  // both affix types: a plain lexical sort would ship 120 categories all beginning
  // "ab..."/"ac...", which reads as broken variety even though each is individually
  // fair. Hash ordering is stable across runs, so historical days do not shift.
  //
  // Suffix categories are interleaved ahead of prefixes at a 1:1 ratio while supply
  // allows. Left unweighted the pack skews ~76% prefix simply because more prefix
  // groups fall in the size band, and prefix categories play worse: "words starting
  // with abu" is a weaker prompt than "words ending in ugh".
  const isPrefixOrSuffix = (r: CategoryRule): r is { kind: "prefix" | "suffix"; value: string } =>
    r.kind === "prefix" || r.kind === "suffix";
  // Hash input reproduces the pre-refactor format verbatim (`lowball|<type>|<value>`,
  // pipe-separated in three parts) so regenerating the pack after this refactor
  // selects the SAME 120 categories rather than reshuffling the daily rotation as
  // a side effect of a type change alone.
  const ruleHashInput = (r: CategoryRule): string =>
    isPrefixOrSuffix(r) ? `${r.kind}|${r.value}` : JSON.stringify(r);
  const ruleKey = (r: CategoryRule): string =>
    isPrefixOrSuffix(r) ? `${r.kind}:${r.value}` : JSON.stringify(r);
  const byHash = (a: Candidate, b: Candidate): number => {
    const ha = fnv1a32(`lowball|${ruleHashInput(a.rule)}`);
    const hb = fnv1a32(`lowball|${ruleHashInput(b.rule)}`);
    return ha - hb || ruleKey(a.rule).localeCompare(ruleKey(b.rule));
  };
  const isFlagship = (c: Candidate): boolean =>
    isPrefixOrSuffix(c.rule) && c.rule.kind === "suffix" && c.rule.value === "ugh";
  const suffixes = candidates
    .filter((c) => isPrefixOrSuffix(c.rule) && c.rule.kind === "suffix" && !isFlagship(c))
    .sort(byHash);
  const prefixes = candidates
    .filter((c) => isPrefixOrSuffix(c.rule) && c.rule.kind === "prefix")
    .sort(byHash);

  // The "ugh" category anchors the pack: it is the archetypal Lowball prompt, with
  // `ugh`-family words as findable zero-scorers against four 100-scoring traps.
  const flagship = candidates.filter(isFlagship);
  const selected: Candidate[] = [...flagship];
  while (selected.length < TARGET_PUZZLES && (suffixes.length > 0 || prefixes.length > 0)) {
    const next = suffixes.shift() ?? prefixes.shift();
    if (next === undefined) break;
    selected.push(next);
    if (selected.length >= TARGET_PUZZLES) break;
    const alt = prefixes.shift();
    if (alt !== undefined) selected.push(alt);
  }
  const puzzles = buildPuzzles(selected.slice(0, TARGET_PUZZLES));

  // REQ-046: never ship a pack that cannot cover the minimum run of days.
  if (puzzles.length < MIN_PUZZLES) {
    throw new Error(
      `lowball: only ${puzzles.length} categories passed the fairness gate, need at least ${MIN_PUZZLES}`,
    );
  }
  assertPuzzlesValid(puzzles);

  // --- agreement proof (REQ-006, REQ-007) ------------------------------------
  // The permanent guard against this bug class. Sharing `matchesRule` prevents
  // TODAY's divergence; this proves it for every future regeneration, and fails the
  // build before a bad pack can be written.
  const soundness: string[] = [];
  const completeness: string[] = [];
  for (const p of puzzles) {
    const shipped = new Set(p.answers.map((a) => a.word));
    for (const a of p.answers) {
      // SOUNDNESS: never ship an answer the engine would reject, or one that is unsafe.
      if (!matchesRule(a.word, p.rule)) {
        soundness.push(`${p.puzzleId} (${JSON.stringify(p.rule)}) ships "${a.word}" which matchesRule rejects`);
      }
      if (isBlockedWord(a.word)) {
        soundness.push(`${p.puzzleId} ships blocked word "${a.word}"`);
      }
    }
    // COMPLETENESS: never omit a clean corpus word the engine would accept. This is
    // the direction the original bug failed in — "grape" was accepted by the runtime
    // rule but absent from the pack.
    for (const w of words) {
      if (matchesRule(w, p.rule) && !shipped.has(w)) {
        completeness.push(`${p.puzzleId} (${JSON.stringify(p.rule)}) omits valid word "${w}"`);
      }
    }
  }
  if (soundness.length > 0 || completeness.length > 0) {
    const sample = [...soundness.slice(0, 5), ...completeness.slice(0, 5)].join("\n  ");
    throw new Error(
      `lowball: build/runtime agreement proof FAILED — ` +
        `${soundness.length} soundness, ${completeness.length} completeness violations:\n  ${sample}`,
    );
  }
  process.stdout.write(
    `lowball: agreement proof OK (${puzzles.length} categories, 0 soundness, 0 completeness violations)\n`,
  );


  const pack = {
    contentPackVersion: PACK_VERSION,
    datasetId: DICTIONARY_ID,
    puzzleCount: puzzles.length,
    dayBoundaryRule: "UTC",
    fairnessGateVersion: "1.0.0",
    puzzles,
  };
  const json = JSON.stringify(pack);

  // REQ-045: the pack is precached for offline play, so guard its size.
  const bytes = Buffer.byteLength(json, "utf8");
  if (bytes > MAX_PACK_BYTES) {
    throw new Error(
      `lowball: pack is ${(bytes / 1024).toFixed(1)} KiB, exceeding the ${MAX_PACK_BYTES / 1024} KiB ceiling`,
    );
  }

  const outDir = join(here, "..", "public");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "lowball.json"), json);
  process.stdout.write(
    `lowball.json: ${puzzles.length} categories, ${(bytes / 1024).toFixed(1)} KiB\n`,
  );

  for (const p of puzzles.slice(0, 5)) {
    const findableZeros = p.answers.filter((a) => a.isFindable && a.panelScore === 0).length;
    process.stdout.write(
      `  ${p.categoryLabel} — ${p.answers.length} answers, par ${p.parValue}, ` +
        `top ${p.answers[0].panelScore}, ${findableZeros} findable zero(s)\n`,
    );
  }

  // Show the flagship category in full if the gate admitted it.
  const anchor = puzzles.find((p) => p.rule.kind === "suffix" && (p.rule as { value: string }).value === "ugh");
  if (anchor !== undefined) {
    process.stdout.write(`\n  flagship ${anchor.categoryLabel} (par ${anchor.parValue}):\n    `);
    process.stdout.write(
      anchor.answers.map((a) => `${a.word}=${a.panelScore}${a.isFindable ? "" : "*"}`).join(" ") + "\n",
    );
  }
}

main().catch((err: unknown) => {
  process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
