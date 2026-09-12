import type { GamePlugin, GameServices, GameInstance, DailyResult } from "../../kit/types.ts";
import { canonicalizeDayId } from "../../kit/selection.ts";
import { resolveDailyPuzzleIndex } from "../../kit/dev.ts";
import { loadStats, saveStats, recordPlayed, recordWon, type Stats } from "../../kit/stats.ts";
import { saveAttempt, loadAttempt } from "../../kit/persistence.ts";
import type { AttemptState, Puzzle, Side } from "./types.ts";
import { ATTEMPTS_TOTAL, SIDE_TOTAL } from "./types.ts";
import { initAttempt, submit, canSubmit, isComplete } from "./engine.ts";
import { buildShareText, isSpoilerSafe, countBar } from "./share.ts";

interface ContentPack {
  contentPackVersion: string;
  datasetId: string;
  puzzleCount: number;
  puzzles: Puzzle[];
}

class TwinTrails implements GameInstance {
  private pack!: ContentPack;
  private puzzle!: Puzzle;
  private state!: AttemptState;
  private stats!: Stats;
  private live!: HTMLElement;
  private assignment: Record<string, Side | undefined> = {};

  constructor(private readonly root: HTMLElement, private readonly svc: GameServices) {}

  async init(packPath: string): Promise<void> {
    this.pack = JSON.parse(await this.svc.assets.loadText(packPath)) as ContentPack;
    this.stats = loadStats(this.svc.storage, this.svc.keyFor("stats"));
    const dayId = canonicalizeDayId(this.svc.clock.nowMs(), "UTC");
    const idx = resolveDailyPuzzleIndex(
      "twin-trails", dayId, this.pack.contentPackVersion, this.pack.datasetId, this.pack.puzzleCount,
      { read: (k) => this.svc.storage.read(k) },
      (word) => this.pack.puzzles.findIndex((p) => p.words.includes(word.toLowerCase())),
    );
    this.puzzle = this.pack.puzzles[idx];
    const saved = loadAttempt<AttemptState>(this.svc.storage, this.svc.keyFor(`state:${dayId}`), (raw) => raw as AttemptState);
    this.state = saved ?? initAttempt(this.puzzle, dayId);
    // restore last assignment if any (transient convenience)
    const last = this.state.attempts[this.state.attempts.length - 1];
    if (last) this.assignment = { ...last.assignment };
  }

  currentResult(): DailyResult {
    return {
      gameId: "twin-trails",
      dayId: this.state.dayId,
      played: this.state.status !== "in_progress" || this.state.attempts.length > 0,
      solved: this.state.status === "won",
    };
  }

  private persist(): void {
    saveAttempt(this.svc.storage, this.svc.keyFor(`state:${this.state.dayId}`), this.state);
    this.svc.onResult(this.currentResult());
  }

  private cycle(word: string): void {
    const cur = this.assignment[word];
    this.assignment[word] = cur === "A" ? "B" : cur === "B" ? undefined : "A";
    this.render();
  }

  render(): void {
    const s = this.state;
    const done = s.status !== "in_progress";
    this.root.innerHTML = "";
    this.root.className = "game twin-trails";
    this.root.append(homeBar(this.svc, "Twin Trails"));
    this.root.append(el("p", { class: "sub", text: `${s.dayId} · UTC · ${s.attemptsRemaining}/${ATTEMPTS_TOTAL} tries` }));
    this.root.append(el("p", { class: "help", text: "Two hidden ideas each pulled 4 words. Tap to send each word down Trail A or Trail B." }));

    this.live = liveRegion();
    this.root.append(this.live);

    const legend = el("div", { class: "tt-legend" });
    legend.append(el("span", { class: "tt-tag tt-a", text: done ? this.puzzle.labelA : "Trail A" }));
    legend.append(el("span", { class: "tt-tag tt-b", text: done ? this.puzzle.labelB : "Trail B" }));
    this.root.append(legend);

    const grid = el("div", { class: "tt-board" });
    grid.setAttribute("role", "group");
    for (const w of this.puzzle.words) {
      const side = done ? this.puzzle.gold[w] : this.assignment[w];
      const cls = side === "A" ? " side-a" : side === "B" ? " side-b" : "";
      const btn = el("button", { class: `tt-word${cls}`, text: w }) as HTMLButtonElement;
      btn.type = "button";
      btn.disabled = done;
      btn.setAttribute("aria-label", `${w}, ${side ? "trail " + side : "unassigned"}. Tap to change trail.`);
      btn.addEventListener("click", () => this.cycle(w));
      grid.append(btn);
    }
    this.root.append(grid);

    if (s.attempts.length > 0) {
      const hist = el("div", { class: "tt-history" });
      for (const a of s.attempts) hist.append(el("span", { class: "tt-sig", text: `${countBar(a.correctCount)} ${a.correctCount}/${SIDE_TOTAL}` }));
      this.root.append(hist);
    }

    const controls = el("div", { class: "controls" });
    if (!done) {
      const complete = isComplete(this.assignment as Record<string, Side>, this.puzzle.words);
      const sub = el("button", { text: "Submit trails", class: "btn" }) as HTMLButtonElement;
      sub.type = "button";
      sub.disabled = !complete;
      sub.addEventListener("click", () => this.doSubmit());
      controls.append(sub);
    }
    const shareBtn = el("button", { text: "Share", class: `btn${done ? "" : " btn-secondary"}` }) as HTMLButtonElement;
    shareBtn.type = "button";
    shareBtn.addEventListener("click", () => void this.doShare());
    controls.append(shareBtn);
    this.root.append(controls);

    if (s.status === "won") this.root.append(el("p", { class: "win", text: `Solved — Trail A: ${this.puzzle.labelA}; Trail B: ${this.puzzle.labelB}.` }));
    if (s.status === "lost") this.root.append(el("p", { class: "lose", text: `Out of tries — A: ${this.puzzle.labelA}; B: ${this.puzzle.labelB}.` }));
  }

  private doSubmit(): void {
    if (!canSubmit(this.state)) return;
    const out = submit(this.state, this.puzzle, this.assignment as Record<string, Side>);
    if (out.error === "incomplete") return this.announce("Assign every word first.");
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
    if (out.correct) this.announce("Both trails solved!");
    else if (out.attempt) this.announce(`${out.attempt.correctCount} of ${SIDE_TOTAL} on the right trail. ${this.state.attemptsRemaining} tries left.`);
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

export const twinTrailsPlugin: GamePlugin = {
  meta: { id: "twin-trails", name: "Twin Trails", tagline: "Split the words into two hidden themes.", glyph: "🌗", accent: "#be95ff" },
  contentPackPath: "./twin-trails.json",
  async mount(root, services) {
    const game = new TwinTrails(root, services);
    await game.init("./twin-trails.json");
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
