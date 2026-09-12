import type { GamePlugin, GameServices, GameInstance, DailyResult } from "../../kit/types.ts";
import { canonicalizeDayId } from "../../kit/selection.ts";
import { resolveDailyPuzzleIndex } from "../../kit/dev.ts";
import { loadStats, saveStats, recordPlayed, recordWon, type Stats } from "../../kit/stats.ts";
import { saveAttempt, loadAttempt } from "../../kit/persistence.ts";
import type { AttemptState, Puzzle } from "./types.ts";
import { ATTEMPTS_TOTAL, CLUSTER_SIZE } from "./types.ts";
import { initAttempt, submit, canSubmit } from "./engine.ts";
import { buildShareText, isSpoilerSafe, edgeBlock } from "./share.ts";

interface ContentPack {
  contentPackVersion: string;
  datasetId: string;
  puzzleCount: number;
  puzzles: Puzzle[];
}

class EditClusters implements GameInstance {
  private pack!: ContentPack;
  private puzzle!: Puzzle;
  private state!: AttemptState;
  private stats!: Stats;
  private live!: HTMLElement;
  private selected = new Set<string>();

  constructor(private readonly root: HTMLElement, private readonly svc: GameServices) {}

  async init(packPath: string): Promise<void> {
    this.pack = JSON.parse(await this.svc.assets.loadText(packPath)) as ContentPack;
    this.stats = loadStats(this.svc.storage, this.svc.keyFor("stats"));
    const dayId = canonicalizeDayId(this.svc.clock.nowMs(), "UTC");
    const idx = resolveDailyPuzzleIndex(
      "edit-clusters", dayId, this.pack.contentPackVersion, this.pack.datasetId, this.pack.puzzleCount,
      { read: (k) => this.svc.storage.read(k) },
      (word) => this.pack.puzzles.findIndex((p) => p.board.includes(word.toLowerCase())),
    );
    this.puzzle = this.pack.puzzles[idx];
    const saved = loadAttempt<AttemptState>(this.svc.storage, this.svc.keyFor(`state:${dayId}`), (raw) => raw as AttemptState);
    this.state = saved ?? initAttempt(this.puzzle, dayId);
  }

  currentResult(): DailyResult {
    return {
      gameId: "edit-clusters",
      dayId: this.state.dayId,
      played: this.state.status !== "in_progress" || this.state.attempts.length > 0,
      solved: this.state.status === "won",
    };
  }

  private persist(): void {
    saveAttempt(this.svc.storage, this.svc.keyFor(`state:${this.state.dayId}`), this.state);
    this.svc.onResult(this.currentResult());
  }

  private toggle(word: string): void {
    if (this.selected.has(word)) this.selected.delete(word);
    else if (this.selected.size < CLUSTER_SIZE) this.selected.add(word);
    this.render();
  }

  render(): void {
    const s = this.state;
    const done = s.status !== "in_progress";
    this.root.innerHTML = "";
    this.root.className = "game edit-clusters";
    this.root.append(homeBar(this.svc, "Edit Clusters"));
    this.root.append(el("p", { class: "sub", text: `${s.dayId} · UTC · ${s.attemptsRemaining}/${ATTEMPTS_TOTAL} tries` }));
    this.root.append(el("p", { class: "help", text: `Pick the ${CLUSTER_SIZE} words most tightly linked by one-letter changes.` }));

    this.live = liveRegion();
    this.root.append(this.live);

    const grid = el("div", { class: "ec-board" });
    grid.setAttribute("role", "group");
    grid.setAttribute("aria-label", "Word board");
    for (const w of this.puzzle.board) {
      const btn = el("button", { class: `ec-cell${this.selected.has(w) ? " selected" : ""}`, text: w }) as HTMLButtonElement;
      btn.type = "button";
      btn.disabled = done;
      btn.setAttribute("aria-pressed", this.selected.has(w) ? "true" : "false");
      btn.addEventListener("click", () => this.toggle(w));
      grid.append(btn);
    }
    this.root.append(grid);

    // Attempt history as density signatures.
    if (s.attempts.length > 0) {
      const hist = el("div", { class: "ec-history" });
      for (const a of s.attempts) hist.append(el("span", { class: "ec-sig", text: `${edgeBlock(a.edges, a.correct)} ${a.edges} links` }));
      this.root.append(hist);
    }

    const controls = el("div", { class: "controls" });
    if (!done) {
      const sub = el("button", { text: `Submit (${this.selected.size}/${CLUSTER_SIZE})`, class: "btn" }) as HTMLButtonElement;
      sub.type = "button";
      sub.disabled = this.selected.size !== CLUSTER_SIZE;
      sub.addEventListener("click", () => {
        if (!canSubmit(this.state) || this.selected.size !== CLUSTER_SIZE) return;
        const out = submit(this.state, this.puzzle, [...this.selected]);
        this.state = out.state;
        if (this.state.status === "won") {
          this.stats = recordWon(recordPlayed(this.stats, this.state.dayId), this.state.dayId);
          saveStats(this.svc.storage, this.svc.keyFor("stats"), this.stats);
        } else if (this.state.status === "lost") {
          this.stats = recordPlayed(this.stats, this.state.dayId);
          saveStats(this.svc.storage, this.svc.keyFor("stats"), this.stats);
        }
        this.persist();
        if (out.correct) this.announce("Found the cluster!");
        else if (out.error === "already_tried") this.announce("Already tried that group.");
        else if (out.attempt) this.announce(`${out.attempt.edges} internal links. ${this.state.attemptsRemaining} tries left.`);
        this.selected.clear();
        this.render();
      });
      const clear = el("button", { text: "Clear", class: "btn btn-secondary" }) as HTMLButtonElement;
      clear.type = "button";
      clear.addEventListener("click", () => { this.selected.clear(); this.render(); });
      controls.append(sub, clear);
    }
    const shareBtn = el("button", { text: "Share", class: `btn${done ? "" : " btn-secondary"}` }) as HTMLButtonElement;
    shareBtn.type = "button";
    shareBtn.addEventListener("click", () => void this.doShare());
    controls.append(shareBtn);
    this.root.append(controls);

    if (s.status === "won") this.root.append(el("p", { class: "win", text: `Solved — the cluster was ${this.puzzle.cluster.join(", ")}.` }));
    if (s.status === "lost") this.root.append(el("p", { class: "lose", text: `Out of tries — the cluster was ${this.puzzle.cluster.join(", ")}.` }));
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

export const editClustersPlugin: GamePlugin = {
  meta: { id: "edit-clusters", name: "Edit Clusters", tagline: "Spot the tightest one-letter-change family.", glyph: "🕸️", accent: "#08bdba" },
  contentPackPath: "./edit-clusters.json",
  async mount(root, services) {
    const game = new EditClusters(root, services);
    await game.init("./edit-clusters.json");
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
