import type { GamePlugin, GameServices, GameInstance, DailyResult } from "../../kit/types.ts";
import { canonicalizeDayId, derivePuzzleId } from "../../kit/selection.ts";
import { loadStats, saveStats, recordPlayed, recordWon, type Stats } from "../../kit/stats.ts";
import { saveAttempt, loadAttempt } from "../../kit/persistence.ts";
import type { AttemptState, Puzzle } from "./types.ts";
import { ATTEMPT_LIMIT } from "./types.ts";
import { initAttempt, reorder, submit, applyHint, canSubmit } from "./engine.ts";
import { buildShareText, isSpoilerSafe } from "./share.ts";

interface ContentPack {
  contentPackVersion: string;
  datasetId: string;
  puzzleCount: number;
  puzzles: Puzzle[];
}

class Degrees implements GameInstance {
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
    const saved = loadAttempt<AttemptState>(this.svc.storage, this.svc.keyFor(`state:${dayId}`), (raw) => raw as AttemptState);
    this.state = saved ?? initAttempt(this.puzzle, dayId);
  }

  currentResult(): DailyResult {
    return { gameId: "degrees", dayId: this.state.dayId, played: this.state.attemptsUsed > 0 || this.state.status !== "in_progress", solved: this.state.status === "solved" };
  }

  private persist(): void {
    saveAttempt(this.svc.storage, this.svc.keyFor(`state:${this.state.dayId}`), this.state);
    this.svc.onResult(this.currentResult());
  }

  render(): void {
    const s = this.state;
    const done = s.status !== "in_progress";
    this.root.innerHTML = "";
    this.root.className = "game degrees";
    this.root.append(homeBar(this.svc, "Degrees"));
    this.root.append(el("p", { class: "sub", text: `${s.dayId} · UTC · ${ATTEMPT_LIMIT - s.attemptsUsed} tries left` }));
    this.root.append(el("p", { class: "help", text: "Order these from weakest to strongest." }));
    // Bespoke flourish: intensity gradient rail reinforcing the weak→strong axis.
    this.root.append(el("div", { class: "deg-rail" }));

    this.live = liveRegion();
    this.root.append(this.live);

    const list = el("ol", { class: "degrees-list" });
    list.setAttribute("aria-label", "Words to order, weakest at top");
    s.order.forEach((canonIdx, slot) => {
      const word = this.puzzle.words[canonIdx];
      const li = el("li", { class: `deg-item${s.lockedPositions[slot] ? " locked" : ""}` });
      const label = el("span", { class: "dw", text: word });
      li.append(label);
      if (!done && !s.lockedPositions[slot]) {
        const up = el("button", { class: "mv", text: "▲" }) as HTMLButtonElement;
        up.type = "button";
        up.setAttribute("aria-label", `Move ${word} up`);
        up.disabled = slot === 0 || s.lockedPositions[slot - 1];
        up.addEventListener("click", () => { this.state = reorder(this.state, slot, slot - 1); this.persist(); this.render(); document.querySelectorAll<HTMLButtonElement>(".mv")[0]?.focus(); });
        const down = el("button", { class: "mv", text: "▼" }) as HTMLButtonElement;
        down.type = "button";
        down.setAttribute("aria-label", `Move ${word} down`);
        down.disabled = slot === s.order.length - 1 || s.lockedPositions[slot + 1];
        down.addEventListener("click", () => { this.state = reorder(this.state, slot, slot + 1); this.persist(); this.render(); });
        const ctr = el("span", { class: "mv-controls" });
        ctr.append(up, down);
        li.append(ctr);
      }
      if (s.lockedPositions[slot]) li.append(el("span", { class: "lock-badge", text: "🔒 fixed" }));
      list.append(li);
    });
    this.root.append(list);

    const controls = el("div", { class: "controls" });
    const submitBtn = el("button", { text: "Check order", class: "btn" }) as HTMLButtonElement;
    submitBtn.type = "button";
    submitBtn.disabled = done;
    submitBtn.addEventListener("click", () => {
      if (!canSubmit(this.state)) return;
      const out = submit(this.state);
      this.state = out.state;
      if (this.state.status === "solved") {
        this.stats = recordWon(recordPlayed(this.stats, this.state.dayId), this.state.dayId);
        saveStats(this.svc.storage, this.svc.keyFor("stats"), this.stats);
      } else if (this.state.status === "failed") {
        this.stats = recordPlayed(this.stats, this.state.dayId);
        saveStats(this.svc.storage, this.svc.keyFor("stats"), this.stats);
      }
      this.persist();
      this.render();
      this.announce(out.solved ? "Solved! Correct order." : `${out.correct} of 5 in the correct position.`);
    });
    const hintBtn = el("button", { text: "Hint", class: "btn btn-secondary" }) as HTMLButtonElement;
    hintBtn.type = "button";
    hintBtn.disabled = done;
    hintBtn.addEventListener("click", () => {
      const next = applyHint(this.state);
      if (next) { this.state = next; this.persist(); }
      this.render();
      this.announce(next ? "Locked the weakest remaining word in place." : "No hint available.");
    });
    const shareBtn = el("button", { text: "Share", class: "btn btn-secondary" }) as HTMLButtonElement;
    shareBtn.type = "button";
    shareBtn.addEventListener("click", () => void this.doShare());
    controls.append(submitBtn, hintBtn, shareBtn);
    this.root.append(controls);

    if (s.status === "solved") this.root.append(el("p", { class: "win", text: `Solved — scale: ${this.puzzle.scaleLabel}` }));
    if (s.status === "failed") this.root.append(el("p", { class: "lose", text: "Out of tries." }));
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

export const degreesPlugin: GamePlugin = {
  meta: { id: "degrees", name: "Degrees", tagline: "Order the words from weakest to strongest.", glyph: "📈", accent: "#8b5cf6" },
  contentPackPath: "./degrees.json",
  async mount(root, services) {
    const game = new Degrees(root, services);
    await game.init("./degrees.json");
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
