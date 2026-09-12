import { existsSync, mkdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";

// One-time downloader for pre-trained GloVe vectors (we DOWNLOAD, never train).
// Fetches glove.6B.zip (~862 MB), extracts only glove.6B.50d.txt (~171 MB) into
// vectors/ (gitignored, build-machine only). Idempotent: skips if present.

const GLOVE_URL = "https://nlp.stanford.edu/data/glove.6B.zip";
const WANTED = "glove.6B.50d.txt";

function main(): void {
  const here = dirname(fileURLToPath(import.meta.url));
  const vectorsDir = join(here, "..", "vectors");
  const target = join(vectorsDir, WANTED);
  mkdirSync(vectorsDir, { recursive: true });

  if (existsSync(target)) {
    // eslint-disable-next-line no-console
    console.log(`${WANTED} already present (${(statSync(target).size / 1e6).toFixed(0)} MB) — skipping.`);
    return;
  }

  const zip = join(vectorsDir, "glove.6B.zip");
  if (!existsSync(zip)) {
    // eslint-disable-next-line no-console
    console.log(`Downloading ${GLOVE_URL} (~862 MB, one-time)...`);
    const dl = spawnSync("curl", ["-fSL", "-o", zip, GLOVE_URL], { stdio: "inherit" });
    if (dl.status !== 0) throw new Error("GloVe download failed");
  }

  // eslint-disable-next-line no-console
  console.log(`Extracting ${WANTED}...`);
  const unzip = spawnSync("unzip", ["-o", zip, WANTED, "-d", vectorsDir], { stdio: "inherit" });
  if (unzip.status !== 0) throw new Error("unzip failed");

  // eslint-disable-next-line no-console
  console.log(`Done. ${WANTED} = ${(statSync(target).size / 1e6).toFixed(0)} MB. Zip left at ${zip} (delete to reclaim space).`);
}

main();
