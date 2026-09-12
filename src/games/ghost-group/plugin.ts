import type { GamePlugin, GameServices, GameInstance, DailyResult } from "../../kit/types.ts";
import { canonicalizeDayId, derivePuzzleId } from "../../kit/selection.ts";
import { loadStats, saveStats, recordPlayed, recordWon, type Stats } from "../../kit/stats.ts";
import { saveAttempt, loadAttempt } from "../../kit/persistence.ts";
import type { AttemptState, Puzzle } from "./types.ts";
import { GROUP_SIZE, MISTAKE_BUDGET } from "./types.ts";
import {
  initAttempt, submitGroup, pickGhostLabel, allGroupsSolved, canSubmit,
  givenCategories, ghostCategory,
} from "./engine.ts";
import { buildShareText, isSpoilerSafe } from "./share.ts";
import { carbonButton } from "../../kit/carbon.ts";

interface ContentPack {
  contentPackVersion: string;
  datasetId: string;
  puzzleCount: number;
  puzzles: Puzzle[];
}

class GhostGroup implements GameInstance {
  private pack!: ContentPack;
  private puzzle!: Puzzle;
  private state!: AttemptState;
  private stats!: Stats;
  private live!: HTMLElement;
  private selection: number[] = [];

  constructor(private readonly root: HTMLElement, private readonly svc: GameServices) {}

  async init(packPath: string): Promise<void> {
    this.pack = JSON.parse(await this.svc.assets.loadText(packPath)) as ContentPack;
    this.stats = loadStats(this.svc.storage, this.svc.keyFor("stats"));
    const dayId = canonicalizeDayId(this.svc.clock.nowMs(), "UTC");
    const puzzleId = derivePuzzleId(dayId, this.pack.contentPackVersion, this.pack.datasetId, this.pack.puzzleCount);
    this.puzzle = this.pack.puzzles[Number(puzzleId.slice(4))];
    const saved = loadAttempt<AttemptState>(this.svc.storage, this.svc.keyFor(`state:${dayId}`), (raw) => raw as AttemptState);
    this.state = saved ?? initAttempt(this.puzzle, dayId);
  }

  currentResult(): DailyResult {
    return { gameId: "ghost-group", dayId: this.state.dayId, played: this.state.history.length > 0 || this.state.playState !== "in_progress", solved: this.state.playState === "won" };
  }

  private persist(): void {
    saveAttempt(this.svc.storage, this.svc.keyFor(`state:${this.state.dayId}`), this.state);
    this.svc.onResult(this.currentResult());
  }

  private solvedWordIdx(): Set<number> {
    const set = new Set<number>();
    for (const id of this.state.solved) {
      const cat = this.puzzle.categories.find((c) => c.id === id);
      cat?.wordIdx.forEach((i) => set.add(i));
    }
    return set;
  }

  render(): void {
    const s = this.state;
    const done = s.playState !== "in_progress";
    this.root.innerHTML = "";
    this.root.className = "game ghost-group";
    this.root.append(homeBar(this.svc, "Ghost Group"));
    this.root.append(
      el("p", { class: "sub", text: `${s.dayId} · UTC · ${MISTAKE_BUDGET - s.mistakes} mistakes left` }),
      el("p", { class: "help", text: "Sort 16 words into 4 groups of 4. Three group names are given; the 4th is a ghost — find its four words, then name it." }),
    );
    this.live = liveRegion();
    this.root.append(this.live);

    // Given labels + ghost bucket
    const labels = el("div", { class: "gg-labels" });
    givenCategories(this.puzzle).forEach((c) => {
      const solved = s.solved.includes(c.id);
      labels.append(el("span", { class: `gg-label${solved ? " solved" : ""}`, text: c.label + (solved ? " ✓" : "") }));
    });
    labels.append(el("span", { class: "gg-label gg-ghost", text: "👻 Ghost" }));
    this.root.append(labels);

    // 16-tile grid
    const grid = el("div", { class: "gg-grid" });
    grid.setAttribute("role", "group");
    grid.setAttribute("aria-label", "Word board");
    const solvedIdx = this.solvedWordIdx();
    this.puzzle.words.forEach((w, i) => {
      const locked = solvedIdx.has(i);
      const sel = this.selection.includes(i);
      const btn = el("button", { class: `gg-tile${sel ? " sel" : ""}${locked ? " locked" : ""}`, text: w }) as HTMLButtonElement;
      btn.type = "button";
      btn.disabled = done || locked;
      btn.setAttribute("aria-pressed", String(sel));
      btn.setAttribute("aria-label", `${w}${sel ? ", selected" : ""}${locked ? ", solved" : ""}`);
      btn.addEventListener("click", () => this.toggle(i));
      grid.append(btn);
    });
    this.root.append(grid);

    // Ghost naming step
    if (!done && allGroupsSolved(s, this.puzzle) && s.ghostPick === null) {
      this.root.append(this.buildGhostPicker());
    }

    const controls = el("div", { class: "controls" });
    if (!allGroupsSolved(s, this.puzzle)) {
      const submitBtn = carbonButton({ text: "Submit group", disabled: done || this.selection.length !== GROUP_SIZE, onClick: () => this.trySubmit() });
      controls.append(submitBtn);
    }
    const shareBtn = carbonButton({ text: "Share", kind: "secondary", onClick: () => void this.doShare() });
    controls.append(shareBtn);
    this.root.append(controls);

    if (s.playState === "won") this.root.append(el("p", { class: "win", text: "Solved — ghost named!" }));
    if (s.playState === "lost") this.root.append(el("p", { class: "lose", text: "Out of mistakes." }));
  }

  private buildGhostPicker(): HTMLElement {
    const wrap = el("div", { class: "gg-ghostpick" });
    wrap.append(el("p", { class: "help", text: "Name the ghost group:" }));
    const group = el("div", { class: "gg-choices" });
    group.setAttribute("role", "radiogroup");
    group.setAttribute("aria-label", "Ghost category options");
    for (const label of this.puzzle.ghostCandidates) {
      const b = el("button", { class: "gg-choice", text: label }) as HTMLButtonElement;
      b.type = "button";
      b.setAttribute("role", "radio");
      b.setAttribute("aria-checked", "false");
      b.addEventListener("click", () => this.pickGhost(label));
      group.append(b);
    }
    wrap.append(group);
    return wrap;
  }

  private toggle(i: number): void {
    if (!canSubmit(this.state)) return;
    const at = this.selection.indexOf(i);
    if (at >= 0) this.selection.splice(at, 1);
    else if (this.selection.length < GROUP_SIZE) this.selection.push(i);
    this.render();
  }

  private trySubmit(): void {
    const out = submitGroup(this.state, this.puzzle, this.selection);
    if (!out.accepted) {
      this.announce(out.reason === "already" ? "Already solved." : out.reason === "size" ? "Select exactly 4 words." : "Game over.");
      return;
    }
    this.state = out.state;
    this.selection = [];
    if (this.state.playState === "lost") {
      this.stats = recordPlayed(this.stats, this.state.dayId);
      saveStats(this.svc.storage, this.svc.keyFor("stats"), this.stats);
    } else if (this.state.history.length === 1) {
      this.stats = recordPlayed(this.stats, this.state.dayId);
      saveStats(this.svc.storage, this.svc.keyFor("stats"), this.stats);
    }
    this.persist();
    this.render();
    this.announce(out.correct ? "Correct group!" : `Not a group. ${MISTAKE_BUDGET - this.state.mistakes} mistakes left.`);
  }

  private pickGhost(label: string): void {
    this.state = pickGhostLabel(this.state, this.puzzle, label);
    if (this.state.playState === "won") {
      this.stats = recordWon(recordPlayed(this.stats, this.state.dayId), this.state.dayId);
      saveStats(this.svc.storage, this.svc.keyFor("stats"), this.stats);
    }
    this.persist();
    this.render();
    this.announce(this.state.ghostCorrect ? "Ghost named — you win!" : "Wrong ghost name. Try again.");
  }

  private async doShare(): Promise<void> {
    const text = buildShareText(this.state, this.state.dayId);
    const labels = this.puzzle.categories.map((c) => c.label);
    if (!isSpoilerSafe(text, this.puzzle.words, labels)) return this.announce("Sharing blocked.");
    const res = await this.svc.share.share(text);
    this.announce(res.ok ? (res.method === "clipboard" ? "Copied." : "Shared.") : "Sharing unavailable.");
  }

  private announce(msg: string): void {
    if (this.live) this.live.textContent = msg;
  }
}

export const ghostGroupPlugin: GamePlugin = {
  meta: { id: "ghost-group", name: "Ghost Group", tagline: "Three groups named; deduce and name the fourth.", glyph: "👻", accent: "#a56eff" },
  contentPackPath: "./ghost-group.json",
  async mount(root, services) {
    const game = new GhostGroup(root, services);
    await game.init("./ghost-group.json");
    game.render();
    return game;
  },
};

type ElOpts = { text?: string; class?: string };
function el(tag: string, opts: ElOpts = {}): HTMLElement {
  const node = document.createElement(tag);
  if (opts.text !== undefined) node.textContent = opts.text;
  if (opts.class) node.className = opts.class;
  return node;
}
function liveRegion(): HTMLElement {
  const d = el("div", { class: "sr-live" });
  d.setAttribute("aria-live", "polite");
  d.setAttribute("role", "status");
  return d;
}
function homeBar(svc: GameServices, title: string): HTMLElement {
  const bar = el("div", { class: "game-bar" });
  const back = el("button", { class: "back-btn", text: "← Games" }) as HTMLButtonElement;
  back.type = "button";
  back.addEventListener("click", () => svc.goHome());
  bar.append(back, el("h1", { class: "game-title", text: title }));
  return bar;
}
// re-exported for tests that need the ghost category helper indirectly
export { ghostCategory };
