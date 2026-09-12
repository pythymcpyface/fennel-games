import type { GamePlugin, GameServices, GameInstance, DailyResult } from "../../kit/types.ts";
import { canonicalizeDayId, derivePuzzleId } from "../../kit/selection.ts";
import { loadStats, saveStats, recordPlayed, recordWon, type Stats } from "../../kit/stats.ts";
import { saveAttempt, loadAttempt } from "../../kit/persistence.ts";
import type { AttemptState, Puzzle } from "./types.ts";
import { initAttempt, choose, nodeOf, isTerminal, isSolved, fillPrompt, replay, stepsCount } from "./engine.ts";
import { buildShareText, isSpoilerSafe } from "./share.ts";
import { carbonButton, carbonNotification } from "../../kit/carbon.ts";

interface ContentPack {
  contentPackVersion: string;
  datasetId: string;
  puzzleCount: number;
  puzzles: Puzzle[];
}

class Marginalia implements GameInstance {
  private pack!: ContentPack;
  private puzzle!: Puzzle;
  private state!: AttemptState;
  private stats!: Stats;
  private live!: HTMLElement;

  constructor(private readonly root: HTMLElement, private readonly svc: GameServices) {}

  async init(packPath: string): Promise<void> {
    this.pack = JSON.parse(await this.svc.assets.loadText(packPath)) as ContentPack;
    this.stats = loadStats(this.svc.storage, this.svc.keyFor("stats"));
    const dayId = canonicalizeDayId(this.svc.clock.nowMs(), "UTC");
    const puzzleId = derivePuzzleId(dayId, this.pack.contentPackVersion, this.pack.datasetId, this.pack.puzzleCount);
    this.puzzle = this.pack.puzzles[Number(puzzleId.slice(4))];
    const saved = loadAttempt<AttemptState>(this.svc.storage, this.svc.keyFor(`state:${dayId}`), (raw) => this.repair(raw, dayId));
    this.state = saved ?? initAttempt(this.puzzle, dayId);
  }

  private repair(raw: unknown, dayId: string): AttemptState | null {
    if (typeof raw !== "object" || raw === null) return null;
    const r = raw as Partial<AttemptState>;
    if (r.puzzleId !== this.puzzle.puzzleId) return null;
    if (typeof r.currentNodeId !== "string" || !this.puzzle.nodes[r.currentNodeId]) return null;
    return {
      puzzleId: this.puzzle.puzzleId,
      dayId,
      currentNodeId: r.currentNodeId,
      visited: Array.isArray(r.visited) ? r.visited.filter((x): x is string => typeof x === "string") : [this.puzzle.startNodeId],
      choices: Array.isArray(r.choices) ? r.choices.filter((x): x is number => typeof x === "number") : [],
      isComplete: r.isComplete === true,
    };
  }

  currentResult(): DailyResult {
    return { gameId: "marginalia", dayId: this.state.dayId, played: this.state.isComplete, solved: isSolved(this.state, this.puzzle) };
  }

  private persist(): void {
    saveAttempt(this.svc.storage, this.svc.keyFor(`state:${this.state.dayId}`), this.state);
    this.svc.onResult(this.currentResult());
  }

  render(): void {
    const node = nodeOf(this.puzzle, this.state.currentNodeId);
    const done = this.state.isComplete;
    const solved = isSolved(this.state, this.puzzle);
    this.root.innerHTML = "";
    this.root.className = "game marginalia";
    this.root.append(homeBar(this.svc, "Marginalia"));
    this.root.append(
      el("p", { class: "sub", text: `${this.state.dayId} · UTC · ${stepsCount(this.state)} choices made` }),
      el("p", { class: "help", text: "Read the story. At each step, choose the word to fill the blank — your choice steers where the tale goes. Reach the golden ending." }),
    );

    this.live = liveRegion();
    this.root.append(this.live);

    // Story so far: render visited nodes' filled prompts.
    const story = el("div", { class: "mg-story" });
    this.state.visited.forEach((id, i) => {
      const n = nodeOf(this.puzzle, id);
      const chosenIdx = this.state.choices[i];
      const word = chosenIdx !== undefined ? n.choices[chosenIdx]?.word ?? null : null;
      const isCurrent = i === this.state.visited.length - 1;
      const para = el("p", { class: `mg-line${isCurrent && !done ? " mg-current" : ""}`, text: fillPrompt(n.prompt, isCurrent && !done ? null : word) });
      story.append(para);
    });
    this.root.append(story);

    if (!done && !isTerminal(node)) {
      const group = el("div", { class: "mg-choices" });
      group.setAttribute("role", "radiogroup");
      group.setAttribute("aria-label", "Choose the word to fill the blank");
      node.choices.forEach((c, i) => {
        const btn = carbonButton({ text: c.word, kind: "secondary", ariaLabel: `Choose ${c.word}`, onClick: () => this.tryChoose(i) });
        btn.setAttribute("role", "radio");
        btn.setAttribute("aria-checked", "false");
        group.append(btn);
      });
      this.root.append(group);
    }

    if (done) {
      this.root.append(carbonNotification(solved ? "Golden ending!" : "The End", solved ? "You steered the story to its finest conclusion." : "You reached an ending — but not the golden one. Try another path.", solved ? "success" : "info"));
    }

    const controls = el("div", { class: "controls" });
    if (done) controls.append(carbonButton({ text: "Replay", kind: "tertiary", onClick: () => this.doReplay() }));
    controls.append(carbonButton({ text: "Share", kind: "secondary", disabled: !done, onClick: () => void this.doShare() }));
    this.root.append(controls);
  }

  private tryChoose(index: number): void {
    const out = choose(this.state, this.puzzle, index);
    if (!out.accepted) return;
    const wasFirstCompletion = !this.state.isComplete && out.state.isComplete;
    this.state = out.state;
    if (wasFirstCompletion) {
      this.stats = isSolved(this.state, this.puzzle)
        ? recordWon(recordPlayed(this.stats, this.state.dayId), this.state.dayId)
        : recordPlayed(this.stats, this.state.dayId);
      saveStats(this.svc.storage, this.svc.keyFor("stats"), this.stats);
    }
    this.persist();
    this.render();
    const node = nodeOf(this.puzzle, this.state.currentNodeId);
    this.announce(this.state.isComplete ? (isSolved(this.state, this.puzzle) ? "Golden ending reached." : "You reached an ending.") : fillPrompt(node.prompt, null));
  }

  private doReplay(): void {
    this.state = replay(this.puzzle, this.state.dayId);
    this.persist();
    this.render();
    this.announce("Story restarted.");
  }

  private async doShare(): Promise<void> {
    const text = buildShareText(this.state, this.puzzle, this.state.dayId);
    if (!isSpoilerSafe(text, this.puzzle)) return this.announce("Sharing blocked.");
    const res = await this.svc.share.share(text);
    this.announce(res.ok ? (res.method === "clipboard" ? "Copied." : "Shared.") : "Sharing unavailable.");
  }

  private announce(msg: string): void {
    if (this.live) this.live.textContent = msg;
  }
}

export const marginaliaPlugin: GamePlugin = {
  meta: { id: "marginalia", name: "Marginalia", tagline: "Choose each word — steer the story to its golden ending.", glyph: "📖", accent: "#ff7eb6" },
  contentPackPath: "./marginalia.json",
  async mount(root, services) {
    const game = new Marginalia(root, services);
    await game.init("./marginalia.json");
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
