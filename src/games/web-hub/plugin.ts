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

class WebHub implements GameInstance {
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
      "web-hub", dayId, this.pack.contentPackVersion, this.pack.datasetId, this.pack.puzzleCount,
      { read: (k) => this.svc.storage.read(k) },
      (word) => this.pack.puzzles.findIndex((p) => p.board.includes(word.toLowerCase())),
    );
    this.puzzle = this.pack.puzzles[idx];
    const saved = loadAttempt<AttemptState>(this.svc.storage, this.svc.keyFor(`state:${dayId}`), (raw) => raw as AttemptState);
    this.state = saved ?? initAttempt(this.puzzle, dayId);
  }

  private maxDegree(): number {
    return Math.max(1, ...Object.values(this.puzzle.degrees));
  }

  currentResult(): DailyResult {
    return {
      gameId: "web-hub",
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
    this.root.className = "game web-hub";
    this.root.append(homeBar(this.svc, "Web Hub"));
    this.root.append(el("p", { class: "sub", text: `${s.dayId} · UTC · ${s.attemptsRemaining}/${ATTEMPTS_TOTAL} taps` }));
    this.root.append(el("p", { class: "help", text: "One word links (by a single letter change) to more of the others than any other. Tap the hub." }));

    this.live = liveRegion();
    this.root.append(this.live);

    const grid = el("div", { class: "wh-board" });
    grid.setAttribute("role", "group");
    for (const w of this.puzzle.board) {
      const g = guessed.get(w);
      const cls = g ? (g.correct ? " hub" : " miss") : "";
      const suffix = done ? ` · ${this.puzzle.degrees[w]}` : "";
      const btn = el("button", { class: `wh-word${cls}`, text: w + suffix }) as HTMLButtonElement;
      btn.type = "button";
      btn.disabled = done || guessed.has(w);
      btn.setAttribute("aria-label", g ? `${w}, ${g.correct ? "the hub" : "connects to " + g.degree} ` : `tap ${w} as the hub`);
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

    if (s.status === "won") this.root.append(el("p", { class: "win", text: `Solved — “${this.puzzle.hub}” links to ${this.puzzle.degrees[this.puzzle.hub]} others.` }));
    if (s.status === "lost") this.root.append(el("p", { class: "lose", text: `Out of taps — the hub was “${this.puzzle.hub}”.` }));
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
    if (out.correct) this.announce("That's the hub!");
    else if (out.error === "already_guessed") this.announce("Already tapped.");
    else if (out.guess) this.announce(`Links to ${out.guess.degree}. Not the most connected. ${this.state.attemptsRemaining} left.`);
  }

  private async doShare(): Promise<void> {
    const text = buildShareText(this.state, this.state.dayId, this.maxDegree());
    if (!isSpoilerSafe(text, this.puzzle)) return this.announce("Sharing blocked.");
    const res = await this.svc.share.share(text);
    this.announce(res.ok ? (res.method === "clipboard" ? "Copied." : "Shared.") : "Sharing unavailable.");
  }

  private announce(msg: string): void {
    if (this.live) this.live.textContent = msg;
  }
}

export const webHubPlugin: GamePlugin = {
  meta: { id: "web-hub", name: "Web Hub", tagline: "Tap the most-connected word in the web.", glyph: "🕸", accent: "#82cfff" },
  contentPackPath: "./web-hub.json",
  async mount(root, services) {
    const game = new WebHub(root, services);
    await game.init("./web-hub.json");
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
