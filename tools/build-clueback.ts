import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { buildPuzzle, assertPuzzleValid, type RawEntry } from "../src/games/clueback/content-build.ts";
import type { Puzzle } from "../src/games/clueback/types.ts";

// Clueback build tool. Curated reverse-crossword puzzles: each puzzle is a set of
// solved answers, each with its real clue + two plausible distractor clues. The
// fairness gate (assertPuzzleValid) enforces exactly-one-correct, three distinct
// clues, and no clue leaking the answer. Candidate order is shuffled
// deterministically by entryId inside buildEntry.

const PACK_VERSION = "1.0.0";
const DATASET_ID = "clueback.curated.v1";

// Each puzzle: 5 entries. correctClue is the true clue; distractors are plausible
// but wrong (often the clue for a different, similar word).
const PUZZLES: RawEntry[][] = [
  [
    { entryId: "p0-e0", answer: "OCEAN", correctClue: "Vast body of salt water", distractors: ["Large freshwater lake", "A small mountain stream"] },
    { entryId: "p0-e1", answer: "COMET", correctClue: "Icy body with a glowing tail", distractors: ["A ring of dust around a planet", "A crater on the Moon"] },
    { entryId: "p0-e2", answer: "MAPLE", correctClue: "Tree tapped for syrup", distractors: ["Tropical fruit-bearing palm", "A thorny desert shrub"] },
    { entryId: "p0-e3", answer: "PIANO", correctClue: "Keyboard instrument with hammers and strings", distractors: ["Brass instrument with valves", "Handheld string instrument you strum"] },
    { entryId: "p0-e4", answer: "AMBER", correctClue: "Fossilised tree resin", distractors: ["A deep-blue gemstone", "Volcanic black glass"] },
  ],
  [
    { entryId: "p1-e0", answer: "TANGO", correctClue: "Passionate Argentine ballroom dance", distractors: ["A slow Viennese three-step", "A Hawaiian hula routine"] },
    { entryId: "p1-e1", answer: "DELTA", correctClue: "Triangular deposit at a river's mouth", distractors: ["A narrow gorge cut by wind", "The peak of a volcano"] },
    { entryId: "p1-e2", answer: "RIVET", correctClue: "Metal pin fastening steel plates", distractors: ["A woven cane basket", "A hinge on a wooden door"] },
    { entryId: "p1-e3", answer: "OPERA", correctClue: "Drama sung throughout with orchestra", distractors: ["A silent black-and-white film", "A spoken one-act comedy"] },
    { entryId: "p1-e4", answer: "LEMON", correctClue: "Sour yellow citrus fruit", distractors: ["A sweet red summer berry", "A green tropical melon"] },
  ],
  [
    { entryId: "p2-e0", answer: "GLACIER", correctClue: "Slow-moving river of ice", distractors: ["A field of drifting sand dunes", "A hot spring that erupts"] },
    { entryId: "p2-e1", answer: "MOSAIC", correctClue: "Picture made from small tiles", distractors: ["A carving pressed into wet clay", "A painting done on fresh plaster"] },
    { entryId: "p2-e2", answer: "COMPASS", correctClue: "Device pointing to magnetic north", distractors: ["A tool for measuring temperature", "An instrument for weighing gold"] },
    { entryId: "p2-e3", answer: "SONNET", correctClue: "Fourteen-line rhyming poem", distractors: ["A three-line Japanese verse", "An epic tale of a hero's journey"] },
    { entryId: "p2-e4", answer: "FALCON", correctClue: "Fast-diving bird of prey", distractors: ["A flightless Antarctic seabird", "A nocturnal hooting hunter"] },
  ],
  [
    { entryId: "p3-e0", answer: "MARBLE", correctClue: "Metamorphic stone prized by sculptors", distractors: ["A soft rock that draws on paper", "A layered rock full of seashells"] },
    { entryId: "p3-e1", answer: "ORCHID", correctClue: "Exotic flower with intricate petals", distractors: ["A tall sunflower that tracks the sun", "A prickly cactus bloom"] },
    { entryId: "p3-e2", answer: "ANCHOR", correctClue: "Heavy device that moors a ship", distractors: ["A sail that catches the wind", "A rudder that steers a boat"] },
    { entryId: "p3-e3", answer: "VIOLIN", correctClue: "Four-stringed instrument played with a bow", distractors: ["A large upright wind pipe", "A drum struck with sticks"] },
    { entryId: "p3-e4", answer: "SAFARI", correctClue: "Overland trip to view wild animals", distractors: ["A deep-sea diving expedition", "A guided tour of ancient ruins"] },
  ],
  [
    { entryId: "p4-e0", answer: "PYRAMID", correctClue: "Ancient tomb with four triangular sides", distractors: ["A round stone tower of defence", "A domed place of worship"] },
    { entryId: "p4-e1", answer: "NECTAR", correctClue: "Sweet fluid bees gather from flowers", distractors: ["The sticky sap of a pine tree", "The waxy coating on fruit skin"] },
    { entryId: "p4-e2", answer: "CIRCUIT", correctClue: "Closed loop an electric current flows around", distractors: ["A single straight length of wire", "A switch that only turns off"] },
    { entryId: "p4-e3", answer: "MEADOW", correctClue: "Field of wild grass and flowers", distractors: ["A dense tangle of jungle vines", "A frozen stretch of tundra"] },
    { entryId: "p4-e4", answer: "TRIDENT", correctClue: "Three-pronged spear of the sea god", distractors: ["A curved single-edged sword", "A double-headed battle axe"] },
  ],
  [
    { entryId: "p5-e0", answer: "HARBOUR", correctClue: "Sheltered place where ships dock", distractors: ["A tall tower guiding ships at night", "A channel dug across dry land"] },
    { entryId: "p5-e1", answer: "CACTUS", correctClue: "Spiny plant that stores water", distractors: ["A floating aquatic lily pad", "A climbing vine of the rainforest"] },
    { entryId: "p5-e2", answer: "TIMPANI", correctClue: "Large tunable kettle drums", distractors: ["A pair of small hand cymbals", "A wooden xylophone with bars"] },
    { entryId: "p5-e3", answer: "EMERALD", correctClue: "Prized green gemstone", distractors: ["A blood-red faceted jewel", "A milky iridescent pearl"] },
    { entryId: "p5-e4", answer: "MONSOON", correctClue: "Seasonal wind bringing heavy rains", distractors: ["A sudden swirling desert sandstorm", "A long spell of dry cold weather"] },
  ],
];

function main(): void {
  const puzzles: Puzzle[] = [];
  for (let i = 0; i < PUZZLES.length; i++) {
    const id = `puz-${puzzles.length.toString().padStart(4, "0")}`;
    const p = buildPuzzle(id, PUZZLES[i]);
    if (p === null) {
      // eslint-disable-next-line no-console
      console.warn(`skipped unfair puzzle #${i}`);
      continue;
    }
    assertPuzzleValid(p);
    puzzles.push(p);
  }
  if (puzzles.length < 4) throw new Error(`Clueback: too few valid puzzles (${puzzles.length}).`);

  const pack = {
    contentPackVersion: PACK_VERSION,
    datasetId: DATASET_ID,
    puzzleCount: puzzles.length,
    dayBoundaryRule: "UTC" as const,
    puzzles,
  };
  const outDir = join(dirname(fileURLToPath(import.meta.url)), "..", "public");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "clueback.json"), JSON.stringify(pack));
  // eslint-disable-next-line no-console
  console.log(`clueback.json: ${puzzles.length} puzzles`);
}

main();
