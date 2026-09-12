import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { buildPuzzle, assertPuzzleValid, type RawPuzzle } from "../src/games/marginalia/content-build.ts";
import type { Node, Puzzle } from "../src/games/marginalia/types.ts";

// Marginalia build tool. Curated branching cloze micro-stories. Each puzzle is a
// small DAG: a chain of decision nodes where exactly ONE choice at each step
// continues the golden path, and the two other choices lead to (distinct) lesser
// terminal endings. This guarantees a well-formed DAG with exactly one golden
// path (the fairness gate re-verifies all structural rules).

const PACK_VERSION = "1.0.0";
const DATASET_ID = "marginalia.curated.v1";
const B = "[[BLANK]]";

interface Step {
  prompt: string;
  golden: string; // the word that continues the golden path
  lesser: [string, string]; // two words that dead-end
  lesserEndings: [string, string]; // terminal prompts for the two dead-ends
}

interface Story {
  steps: Step[];
  goldenEnding: string; // terminal prompt reached by following all golden choices
}

const STORIES: Story[] = [
  {
    steps: [
      { prompt: `The old lighthouse keeper lit a ${B} against the coming storm.`, golden: "lantern", lesser: ["bonfire", "candle"], lesserEndings: [`The bonfire roared out of control and the night ended in smoke.`, `The candle guttered out, and the ships lost their way.`] },
      { prompt: `A ship's captain saw the light and steered toward the ${B}.`, golden: "harbour", lesser: ["rocks", "open sea"], lesserEndings: [`The ship struck the rocks; a sad ending.`, `The ship drifted into the open sea and was never seen again.`] },
      { prompt: `Safe at last, the crew raised a ${B} to the keeper.`, golden: "toast", lesser: ["complaint", "sail"], lesserEndings: [`Their complaint soured the reunion.`, `They raised a sail and hurried off without thanks.`] },
    ],
    goldenEnding: `The keeper smiled: every soul came home. A perfect ${B}. THE GOLDEN END.`,
  },
  {
    steps: [
      { prompt: `The young baker woke before dawn to knead the ${B}.`, golden: "dough", lesser: ["clay", "problem"], lesserEndings: [`The clay belonged in a workshop, not a bakery. A messy end.`, `The problem only grew; the ovens stayed cold.`] },
      { prompt: `She slid the loaves into the ${B} and waited.`, golden: "oven", lesser: ["river", "drawer"], lesserEndings: [`The river swept the loaves away.`, `Hidden in a drawer, the dough never rose.`] },
      { prompt: `The scent drew a hungry ${B} to her door.`, golden: "crowd", lesser: ["storm", "silence"], lesserEndings: [`A storm scattered her stall.`, `Only silence came; the bread went stale.`] },
    ],
    goldenEnding: `By noon she had sold every loaf and earned a ${B} of regulars. THE GOLDEN END.`,
  },
  {
    steps: [
      { prompt: `The explorer unrolled a faded ${B} on the cave floor.`, golden: "map", lesser: ["blanket", "letter"], lesserEndings: [`A blanket was cosy but led nowhere.`, `The letter was a distraction; the trail went cold.`] },
      { prompt: `It pointed past a waterfall to a hidden ${B}.`, golden: "door", lesser: ["cliff", "swamp"], lesserEndings: [`The cliff was a dead drop.`, `The swamp swallowed every footprint.`] },
      { prompt: `Beyond it lay a chamber full of ancient ${B}.`, golden: "treasure", lesser: ["dust", "bats"], lesserEndings: [`Only dust rewarded the long climb.`, `A cloud of bats chased the explorer out.`] },
    ],
    goldenEnding: `The explorer stepped into the light, richer and wiser — a true ${B}. THE GOLDEN END.`,
  },
  {
    steps: [
      { prompt: `The gardener planted a single mysterious ${B} in spring.`, golden: "seed", lesser: ["stone", "coin"], lesserEndings: [`The stone never sprouted.`, `The coin rusted quietly underground.`] },
      { prompt: `Through summer she gave it water and ${B}.`, golden: "sunlight", lesser: ["shade", "neglect"], lesserEndings: [`Deep shade stunted the sprout.`, `Neglect left it withered.`] },
      { prompt: `By autumn it had grown into a towering ${B}.`, golden: "tree", lesser: ["weed", "shrub"], lesserEndings: [`It was only a weed after all.`, `A modest shrub, and nothing more.`] },
    ],
    goldenEnding: `Its branches sheltered the whole village — a living ${B}. THE GOLDEN END.`,
  },
  {
    steps: [
      { prompt: `The inventor tightened the last ${B} on her flying machine.`, golden: "bolt", lesser: ["ribbon", "excuse"], lesserEndings: [`A ribbon looked pretty but held nothing together.`, `Her excuse delayed the launch forever.`] },
      { prompt: `She pushed the lever and the engine began to ${B}.`, golden: "hum", lesser: ["smoke", "rattle"], lesserEndings: [`Smoke filled the workshop.`, `A violent rattle shook it apart.`] },
      { prompt: `The craft rose gently into the morning ${B}.`, golden: "sky", lesser: ["mud", "wall"], lesserEndings: [`It face-planted into the mud.`, `It clipped a wall and stalled.`] },
    ],
    goldenEnding: `She soared above the clouds, the first of her kind — a ${B} realised. THE GOLDEN END.`,
  },
  {
    steps: [
      { prompt: `The chess prodigy studied the board and moved her ${B}.`, golden: "knight", lesser: ["king", "pawn"], lesserEndings: [`Exposing the king ended the game at once.`, `A lone pawn achieved nothing.`] },
      { prompt: `Her opponent frowned and defended the ${B}.`, golden: "centre", lesser: ["corner", "clock"], lesserEndings: [`Hiding in the corner surrendered the board.`, `Watching the clock, he lost focus and blundered — but so did she.`] },
      { prompt: `With three swift moves she set a clever ${B}.`, golden: "trap", lesser: ["retreat", "draw"], lesserEndings: [`A full retreat handed over the initiative.`, `They shuffled into a dull draw.`] },
    ],
    goldenEnding: `"Checkmate," she whispered — a flawless ${B}. THE GOLDEN END.`,
  },
];

function buildRaw(story: Story): RawPuzzle {
  const nodes: Record<string, Node> = {};
  const n = story.steps.length;
  // Decision nodes s0..s{n-1}; golden ending gEnd; lesser endings per step.
  story.steps.forEach((step, i) => {
    const goldNext = i < n - 1 ? `s${i + 1}` : "gEnd";
    const l0 = `end_${i}_a`;
    const l1 = `end_${i}_b`;
    nodes[`s${i}`] = {
      id: `s${i}`,
      prompt: step.prompt,
      choices: [
        { word: step.golden, next: goldNext },
        { word: step.lesser[0], next: l0 },
        { word: step.lesser[1], next: l1 },
      ],
    };
    // Lesser terminal endings (each a distinct node). Ensure exactly one blank.
    nodes[l0] = { id: l0, prompt: ensureBlank(step.lesserEndings[0]), choices: [] };
    nodes[l1] = { id: l1, prompt: ensureBlank(step.lesserEndings[1]), choices: [] };
  });
  nodes["gEnd"] = { id: "gEnd", prompt: story.goldenEnding, choices: [] };
  return { nodes, startNodeId: "s0", goldenNodeId: "gEnd" };
}

/** Terminal prompts also need exactly one [[BLANK]]; append a trailing blank clause if absent. */
function ensureBlank(text: string): string {
  return text.includes(B) ? text : `${text} The [[BLANK]] closes.`;
}

function main(): void {
  const puzzles: Puzzle[] = [];
  STORIES.forEach((story, i) => {
    const raw = buildRaw(story);
    const id = `puz-${puzzles.length.toString().padStart(4, "0")}`;
    const p = buildPuzzle(id, raw);
    if (p === null) {
      // eslint-disable-next-line no-console
      console.warn(`skipped invalid story #${i}`);
      return;
    }
    assertPuzzleValid(raw);
    puzzles.push(p);
  });
  if (puzzles.length < 4) throw new Error(`Marginalia: too few valid puzzles (${puzzles.length}).`);

  const pack = {
    contentPackVersion: PACK_VERSION,
    datasetId: DATASET_ID,
    puzzleCount: puzzles.length,
    dayBoundaryRule: "UTC" as const,
    puzzles,
  };
  const outDir = join(dirname(fileURLToPath(import.meta.url)), "..", "public");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "marginalia.json"), JSON.stringify(pack));
  // eslint-disable-next-line no-console
  console.log(`marginalia.json: ${puzzles.length} puzzles`);
}

main();
