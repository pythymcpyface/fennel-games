import type { GamePlugin, GameServices, GameInstance, DailyResult } from "../../kit/types.ts";
import { canonicalizeDayId, derivePuzzleId } from "../../kit/selection.ts";
import { loadStats, saveStats, recordPlayed, recordWon, type Stats } from "../../kit/stats.ts";
import { saveAttempt, loadAttempt } from "../../kit/persistence.ts";
import type { AttemptState, Puzzle } from "./types.ts";
import { initAttempt, submit, canSubmit, move } from "./engine.ts";
import { buildShareText, isSpoilerSafe } from "./share.ts";
import { carbonButton } from "../../kit/carbon.ts";

interface ContentPack {
  contentPackVersion: string;
  datasetId: string;
  puzzleCount: number;
  puzzles: Puzzle[];
}

class Seam implements GameInstance {
  private pack!: ContentPack;
  private puzzle!: Puzzle;
  private state!: AttemptState;
  private stats!: Stats;
  private live!: HTMLElement;
  private selected = -1; // currently picked tile position for keyboard reorder
  private lastFeedback = "";

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
    return { gameId: "seam", dayId: this.state.dayId, played: this.state.attempts > 0 || this.state.isSolved, solved: this.state.isSolved };
  }

  private persist(): void {
    saveAttempt(this.svc.storage, this.svc.keyFor(`state:${this.state.dayId}`), this.state);
    this.svc.onResult(this.currentResult());
  }

  render(): void {
    const s = this.state;
    const done = s.isSolved;
    this.root.innerHTML = "";
    this.root.className = "game seam";
    this.root.append(homeBar(this.svc, "Seam"));
    this.root.append(
      el("p", { class: "sub", text: `${s.dayId} · UTC · ${s.attempts} tries` }),
      el("p", { class: "help", text: "Order the words so every neighbour pair forms a link (compound / phrase). Pick a tile, then use ↑/↓ or the move buttons." }),
    );
    this.live = liveRegion();
    this.root.append(this.live);
    if (this.lastFeedback) this.announce(this.lastFeedback);

    const list = el("ol", { class: "seam-list" });
    list.setAttribute("role", "list");
    list.setAttribute("aria-label", "Word chain, in order");
    s.order.forEach((wordIdx, pos) => {
      const li = el("li", { class: `seam-item${this.selected === pos ? " selected" : ""}` });
      li.setAttribute("role", "listitem");
      const btn = el("button", { class: "seam-tile", text: this.puzzle.words[wordIdx] }) as HTMLButtonElement;
      btn.type = "button";
      btn.setAttribute("aria-label", `Position ${pos + 1}: ${this.puzzle.words[wordIdx]}${this.selected === pos ? ", selected" : ""}`);
      btn.setAttribute("aria-pressed", String(this.selected === pos));
      btn.disabled = done;
      btn.addEventListener("click", () => {
        this.selected = this.selected === pos ? -1 : pos;
        this.render();
      });
      btn.addEventListener("keydown", (e) => {
        if (done) return;
        if ((e.key === "ArrowUp" || e.key === "ArrowDown") && this.selected === pos) {
          e.preventDefault();
          const to = e.key === "ArrowUp" ? pos - 1 : pos + 1;
          if (to >= 0 && to < s.order.length) {
            this.state = move(this.state, pos, to);
            this.selected = to;
            this.persist();
            this.render();
            this.focusPos(to);
            this.announce(`Moved to position ${to + 1}.`);
          }
        }
      });
      li.append(btn);
      const up = mvBtn("↑", done || pos === 0, () => this.doMove(pos, pos - 1));
      const dn = mvBtn("↓", done || pos === s.order.length - 1, () => this.doMove(pos, pos + 1));
      li.append(up, dn);
      list.append(li);
    });
    this.root.append(list);

    const controls = el("div", { class: "controls" });
    const submitBtn = carbonButton({ text: "Submit", disabled: done, onClick: () => this.trySubmit() });
    const shareBtn = carbonButton({ text: "Share", kind: "secondary", onClick: () => void this.doShare() });
    controls.append(submitBtn, shareBtn);
    this.root.append(controls);

    if (s.isSolved) this.root.append(el("p", { class: "win", text: `Solved in ${s.attempts}!` }));
  }

  private doMove(from: number, to: number): void {
    if (to < 0 || to >= this.state.order.length) return;
    this.state = move(this.state, from, to);
    this.selected = to;
    this.persist();
    this.render();
    this.focusPos(to);
  }

  private focusPos(pos: number): void {
    queueMicrotask(() => {
      const tiles = this.root.querySelectorAll<HTMLButtonElement>(".seam-tile");
      tiles[pos]?.focus();
    });
  }

  private trySubmit(): void {
    if (!canSubmit(this.state)) return;
    const out = submit(this.state, this.puzzle);
    this.state = out.state;
    this.lastFeedback = out.feedback.solved
      ? "All links correct — solved!"
      : `${out.feedback.correctLinks} of ${out.feedback.totalLinks} links correct.`;
    if (this.state.isSolved) {
      this.stats = recordWon(recordPlayed(this.stats, this.state.dayId), this.state.dayId);
      saveStats(this.svc.storage, this.svc.keyFor("stats"), this.stats);
    } else if (this.state.attempts === 1) {
      this.stats = recordPlayed(this.stats, this.state.dayId);
      saveStats(this.svc.storage, this.svc.keyFor("stats"), this.stats);
    }
    this.persist();
    this.render();
    this.announce(this.lastFeedback);
  }

  private async doShare(): Promise<void> {
    const text = buildShareText(this.state, this.state.dayId, this.puzzle.words.length - 1);
    if (!isSpoilerSafe(text, this.puzzle.words)) return this.announce("Sharing blocked.");
    const res = await this.svc.share.share(text);
    this.announce(res.ok ? (res.method === "clipboard" ? "Copied." : "Shared.") : "Sharing unavailable.");
  }

  private announce(msg: string): void {
    if (this.live) this.live.textContent = msg;
  }
}

export const seamPlugin: GamePlugin = {
  meta: { id: "seam", name: "Seam", tagline: "Order the words so each neighbour links.", glyph: "🧶", accent: "#ff832b" },
  contentPackPath: "./seam.json",
  async mount(root, services) {
    const game = new Seam(root, services);
    await game.init("./seam.json");
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
function mvBtn(label: string, disabled: boolean, onClick: () => void): HTMLButtonElement {
  const b = el("button", { class: "seam-move", text: label }) as HTMLButtonElement;
  b.type = "button";
  b.disabled = disabled;
  b.setAttribute("aria-label", label === "↑" ? "Move up" : "Move down");
  b.addEventListener("click", onClick);
  return b;
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
