import type { GamePlugin } from "../kit/types.ts";
import { ladderlessPlugin } from "../games/ladderless/plugin.ts";
import { overlapPlugin } from "../games/overlap/plugin.ts";
import { severPlugin } from "../games/sever/plugin.ts";
import { oddSensePlugin } from "../games/odd-sense/plugin.ts";
import { rhymeChainPlugin } from "../games/rhyme-chain/plugin.ts";
import { hiddenMiddlePlugin } from "../games/hidden-middle/plugin.ts";
import { tradeoffPlugin } from "../games/tradeoff/plugin.ts";
import { affixLoomPlugin } from "../games/affix-loom/plugin.ts";
import { wordMorphPlugin } from "../games/word-morph/plugin.ts";
import { degreesPlugin } from "../games/degrees/plugin.ts";
import { vowelGhostPlugin } from "../games/vowel-ghost/plugin.ts";
import { numeronymPlugin } from "../games/numeronym/plugin.ts";
import { kerningPlugin } from "../games/kerning/plugin.ts";
import { acronymAttackPlugin } from "../games/acronym-attack/plugin.ts";
import { borrowedPlugin } from "../games/borrowed/plugin.ts";
import { loanLedgerPlugin } from "../games/loan-ledger/plugin.ts";
import { stressTestPlugin } from "../games/stress-test/plugin.ts";
import { palindialPlugin } from "../games/palindial/plugin.ts";
import { antonymBridgePlugin } from "../games/antonym-bridge/plugin.ts";
import { compoundSplitPlugin } from "../games/compound-split/plugin.ts";
import { homophoneHeistPlugin } from "../games/homophone-heist/plugin.ts";
import { emojiEtymonPlugin } from "../games/emoji-etymon/plugin.ts";
import { editClustersPlugin } from "../games/edit-clusters/plugin.ts";
import { oddOneGradientPlugin } from "../games/odd-one-gradient/plugin.ts";
import { twinTrailsPlugin } from "../games/twin-trails/plugin.ts";
import { tierListPlugin } from "../games/tier-list/plugin.ts";
import { webHubPlugin } from "../games/web-hub/plugin.ts";
import { editLadderTrailsPlugin } from "../games/edit-ladder-trails/plugin.ts";
import { semanticGradientPlugin } from "../games/semantic-gradient/plugin.ts";
import { semanticConstellationPlugin } from "../games/semantic-constellation/plugin.ts";
import { mirrorlePlugin } from "../games/mirrorle/plugin.ts";
import { parallaxPlugin } from "../games/parallax/plugin.ts";
import { seamPlugin } from "../games/seam/plugin.ts";
import { isthmusPlugin } from "../games/isthmus/plugin.ts";
import { driftwordPlugin } from "../games/driftword/plugin.ts";
import { isobarPlugin } from "../games/isobar/plugin.ts";
import { tollgatePlugin } from "../games/tollgate/plugin.ts";
import { ghostGroupPlugin } from "../games/ghost-group/plugin.ts";
import { forkPlugin } from "../games/fork/plugin.ts";
import { rationPlugin } from "../games/ration/plugin.ts";
import { overdraftPlugin } from "../games/overdraft/plugin.ts";
import { cluebackPlugin } from "../games/clueback/plugin.ts";
import { faultLinesPlugin } from "../games/fault-lines/plugin.ts";
import { undertowPlugin } from "../games/undertow/plugin.ts";
import { foglinePlugin } from "../games/fogline/plugin.ts";
import { tarePlugin } from "../games/tare/plugin.ts";
import { marginaliaPlugin } from "../games/marginalia/plugin.ts";
import { cipherDiaryPlugin } from "../games/cipher-diary/plugin.ts";
import { decayPlugin } from "../games/decay/plugin.ts";
import { cascadeTypePlugin } from "../games/cascade-type/plugin.ts";
import { lowballPlugin, lowballCountriesPlugin } from "../games/lowball/plugin.ts";

// The ordered list of games shown on the hub.
export const GAMES: GamePlugin[] = [
  ladderlessPlugin,
  overlapPlugin,
  severPlugin,
  oddSensePlugin,
  rhymeChainPlugin,
  hiddenMiddlePlugin,
  tradeoffPlugin,
  affixLoomPlugin,
  wordMorphPlugin,
  degreesPlugin,
  vowelGhostPlugin,
  numeronymPlugin,
  kerningPlugin,
  acronymAttackPlugin,
  borrowedPlugin,
  loanLedgerPlugin,
  stressTestPlugin,
  palindialPlugin,
  antonymBridgePlugin,
  compoundSplitPlugin,
  homophoneHeistPlugin,
  emojiEtymonPlugin,
  editClustersPlugin,
  oddOneGradientPlugin,
  twinTrailsPlugin,
  tierListPlugin,
  webHubPlugin,
  editLadderTrailsPlugin,
  semanticGradientPlugin,
  semanticConstellationPlugin,
  mirrorlePlugin,
  parallaxPlugin,
  seamPlugin,
  isthmusPlugin,
  driftwordPlugin,
  isobarPlugin,
  tollgatePlugin,
  ghostGroupPlugin,
  forkPlugin,
  rationPlugin,
  overdraftPlugin,
  cluebackPlugin,
  faultLinesPlugin,
  undertowPlugin,
  foglinePlugin,
  tarePlugin,
  marginaliaPlugin,
  cipherDiaryPlugin,
  decayPlugin,
  cascadeTypePlugin,
  lowballPlugin,
  lowballCountriesPlugin,
];
