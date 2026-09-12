import type { GamePlugin, GameServices, GameInstance, DailyResult } from "../../kit/types.ts";
import { canonicalizeDayId } from "../../kit/selection.ts";
import { resolveDailyPuzzleIndex } from "../../kit/dev.ts";
import { loadStats, saveStats, recordPlayed, recordWon, type Stats } from "../../kit/stats.ts";
import { saveAttempt, loadAttempt } from "../../kit/persistence.ts";
import type { AttemptState, Puzzle } from "./types.ts";
import { ATTEMPTS_TOTAL } from "./types.ts";
import { initAttempt, submit, canSubmit } from "./engine.ts";
import { buildShareText, isSpoilerSafe } from "./share.ts";

interface ContentPack {
  contentPackVersion: string;
  datasetId: string;
  puzzleCount: number;
  puzzles: Puzzle[];
}

class OddOneGradient implements GameInstance {
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
    const idx = resolveDailyPuzzleIndex(
      "odd-one-gradient", dayId, this.pack.contentPackVersion, this.pack.datasetId, this.pack.puzzleCount,
      { read: (k) => this.svc.storage.read(k) },
      (word) => this.pack.puzzles.findIndex((p) => p.words.includes(word.toLowerCase())),
    );
    this.puzzle = this.pack.puzzles[idx];
    const saved = loadAttempt<AttemptState>(this.svc.storage, this.svc.keyFor(`state:${dayId}`), (raw) => raw as AttemptState);
    this.state = saved ?? initAttempt(this.puzzle, dayId);
  }

  currentResult(): DailyResult {
    return {
      gameId: "odd-one-gradient",
      dayId: this.state.dayId,
      played: this.state.status !== "in_progress" || this.state.guesses.length > 0,
      solved: this.state.status === "won",
    };
  }

  private persist(): void {
    saveAttempt(this.svc.storage, this.svc.keyFor(`state:${this.state.dayId}`), this.state);
    this.svc.onResult(this.currentResult());
  }

  render(): void {
    const s = this.state;
    const done = s.status !== "in_progress";
    const guessed = new Map(s.guesses.map((g) => [g.word, g]));
    this.root.innerHTML = "";
    this.root.className = "game odd-one-gradient";
    this.root.append(homeBar(this.svc, "Odd-One Gradient"));
    this.root.append(el("p", { class: "sub", text: `${s.dayId} · UTC · ${s.attemptsRemaining}/${ATTEMPTS_TOTAL} taps` }));
    this.root.append(el("p", { class: "help", text: "Five belong together. Tap the ODD one out. Wrong taps warm up as you near it." }));

    this.live = liveRegion();
    this.root.append(this.live);

    const grid = el("div", { class: "oog-set" });
    grid.setAttribute("role", "group");
    for (const w of this.puzzle.words) {
      const g = guessed.get(w);
      const heatClass = g ? ` heat-${g.correct ? "win" : g.heat}` : "";
      const btn = el("button", { class: `oog-word${heatClass}`, text: w }) as HTMLButtonElement;
      btn.type = "button";
      btn.disabled = done || guessed.has(w);
      btn.setAttribute("aria-label", g ? `${w}, ${g.correct ? "the odd one" : "belongs, heat " + g.heat}` : `tap ${w} as the odd one`);
      btn.addEventListener("click", () => this.pick(w));
      grid.append(btn);
    }
    this.root.append(grid);

    const controls = el("div", { class: "controls" });
    const shareBtn = el("button", { text: "Share", class: `btn${done ? "" : " btn-secondary"}` }) as HTMLButtonElement;
    shareBtn.type = "button";
    shareBtn.addEventListener("click", () => void this.doShare());
    controls.append(shareBtn);
    this.root.append(controls);

    if (s.status === "won") this.root.append(el("p", { class: "win", text: `Solved — “${this.puzzle.odd}” is the odd one (the rest: ${this.puzzle.themeLabel}).` }));
    if (s.status === "lost") this.root.append(el("p", { class: "lose", text: `Out of taps — the odd one was “${this.puzzle.odd}”.` }));
  }

  private pick(word: string): void {
    if (!canSubmit(this.state)) return;
    const out = submit(this.state, this.puzzle, word);
    this.state = out.state;
    if (this.state.status === "won") {
      this.stats = recordWon(recordPlayed(this.stats, this.state.dayId), this.state.dayId);
      saveStats(this.svc.storage, this.svc.keyFor("stats"), this.stats);
    } else if (this.state.status === "lost") {
      this.stats = recordPlayed(this.stats, this.state.dayId);
      saveStats(this.svc.storage, this.svc.keyFor("stats"), this.stats);
    }
    this.persist();
    this.render();
    if (out.correct) this.announce("Correct — that's the odd one!");
    else if (out.error === "already_guessed") this.announce("Already tapped.");
    else if (out.guess) this.announce(out.guess.heat <= 1 ? `Cold — it belongs. ${this.state.attemptsRemaining} left.` : `Warmer, but not the outlier. ${this.state.attemptsRemaining} left.`);
  }

  private async doShare(): Promise<void> {
    const text = buildShareText(this.state, this.state.dayId);
    if (!isSpoilerSafe(text, this.puzzle)) return this.announce("Sharing blocked.");
    const res = await this.svc.share.share(text);
    this.announce(res.ok ? (res.method === "clipboard" ? "Copied." : "Shared.") : "Sharing unavailable.");
  }

  private announce(msg: string): void {
    if (this.live) this.live.textContent = msg;
  }
}

export const oddOneGradientPlugin: GamePlugin = {
  meta: { id: "odd-one-gradient", name: "Odd-One Gradient", tagline: "Tap the word that doesn't belong.", glyph: "🎯", accent: "#ff7eb6" },
  contentPackPath: "./odd-one-gradient.json",
  async mount(root, services) {
    const game = new OddOneGradient(root, services);
    await game.init("./odd-one-gradient.json");
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
