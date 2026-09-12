import type { GamePlugin, GameServices, GameInstance, DailyResult } from "../../kit/types.ts";
import { canonicalizeDayId } from "../../kit/selection.ts";
import { resolveDailyPuzzleIndex } from "../../kit/dev.ts";
import { loadStats, saveStats, recordPlayed, recordWon, type Stats } from "../../kit/stats.ts";
import { saveAttempt, loadAttempt } from "../../kit/persistence.ts";
import type { AttemptState, Puzzle } from "./types.ts";
import { ATTEMPTS_TOTAL, RANK_SIZE } from "./types.ts";
import { initAttempt, submit, canSubmit } from "./engine.ts";
import { buildShareText, isSpoilerSafe, positionBar } from "./share.ts";

interface ContentPack {
  contentPackVersion: string;
  datasetId: string;
  puzzleCount: number;
  puzzles: Puzzle[];
}

class TierList implements GameInstance {
  private pack!: ContentPack;
  private puzzle!: Puzzle;
  private state!: AttemptState;
  private stats!: Stats;
  private live!: HTMLElement;
  private ordering: string[] = [];

  constructor(private readonly root: HTMLElement, private readonly svc: GameServices) {}

  async init(packPath: string): Promise<void> {
    this.pack = JSON.parse(await this.svc.assets.loadText(packPath)) as ContentPack;
    this.stats = loadStats(this.svc.storage, this.svc.keyFor("stats"));
    const dayId = canonicalizeDayId(this.svc.clock.nowMs(), "UTC");
    const idx = resolveDailyPuzzleIndex(
      "tier-list", dayId, this.pack.contentPackVersion, this.pack.datasetId, this.pack.puzzleCount,
      { read: (k) => this.svc.storage.read(k) },
      (word) => this.pack.puzzles.findIndex((p) => p.words.includes(word.toLowerCase())),
    );
    this.puzzle = this.pack.puzzles[idx];
    const saved = loadAttempt<AttemptState>(this.svc.storage, this.svc.keyFor(`state:${dayId}`), (raw) => raw as AttemptState);
    this.state = saved ?? initAttempt(this.puzzle, dayId);
    const last = this.state.attempts[this.state.attempts.length - 1];
    // start from last attempt if any, else the shuffled board order (deterministic).
    this.ordering = last ? [...last.ordering] : [...this.puzzle.words];
  }

  currentResult(): DailyResult {
    return {
      gameId: "tier-list",
      dayId: this.state.dayId,
      played: this.state.status !== "in_progress" || this.state.attempts.length > 0,
      solved: this.state.status === "won",
    };
  }

  private persist(): void {
    saveAttempt(this.svc.storage, this.svc.keyFor(`state:${this.state.dayId}`), this.state);
    this.svc.onResult(this.currentResult());
  }

  private move(i: number, dir: -1 | 1): void {
    const j = i + dir;
    if (j < 0 || j >= this.ordering.length) return;
    const next = [...this.ordering];
    [next[i], next[j]] = [next[j], next[i]];
    this.ordering = next;
    this.render();
  }

  render(): void {
    const s = this.state;
    const done = s.status !== "in_progress";
    const showOrder = done ? this.puzzle.order : this.ordering;
    this.root.innerHTML = "";
    this.root.className = "game tier-list";
    this.root.append(homeBar(this.svc, "Tier List"));
    this.root.append(el("p", { class: "sub", text: `${s.dayId} · UTC · ${s.attemptsRemaining}/${ATTEMPTS_TOTAL} tries` }));
    this.root.append(el("p", { class: "help", text: "Order the words from MOST COMMON (top) to RAREST (bottom)." }));

    this.live = liveRegion();
    this.root.append(this.live);

    const list = el("ol", { class: "tl-list" });
    list.setAttribute("role", "list");
    showOrder.forEach((w, i) => {
      const li = el("li", { class: "tl-row" });
      const label = el("span", { class: "tl-word", text: done ? `${w} (tier ${this.puzzle.tiers[w]})` : w });
      li.append(el("span", { class: "tl-rank", text: i === 0 ? "most common" : i === showOrder.length - 1 ? "rarest" : `${i + 1}` }));
      li.append(label);
      if (!done) {
        const up = el("button", { class: "tl-btn", text: "▲" }) as HTMLButtonElement;
        up.type = "button";
        up.disabled = i === 0;
        up.setAttribute("aria-label", `move ${w} up`);
        up.addEventListener("click", () => this.move(i, -1));
        const down = el("button", { class: "tl-btn", text: "▼" }) as HTMLButtonElement;
        down.type = "button";
        down.disabled = i === showOrder.length - 1;
        down.setAttribute("aria-label", `move ${w} down`);
        down.addEventListener("click", () => this.move(i, 1));
        const grp = el("span", { class: "tl-move" });
        grp.append(up, down);
        li.append(grp);
      }
      list.append(li);
    });
    this.root.append(list);

    if (s.attempts.length > 0) {
      const hist = el("div", { class: "tl-history" });
      for (const a of s.attempts) hist.append(el("span", { class: "tl-sig", text: `${positionBar(a.correctPositions)} ${a.correctPositions}/${RANK_SIZE}` }));
      this.root.append(hist);
    }

    const controls = el("div", { class: "controls" });
    if (!done) {
      const sub = el("button", { text: "Lock in order", class: "btn" }) as HTMLButtonElement;
      sub.type = "button";
      sub.addEventListener("click", () => this.doSubmit());
      controls.append(sub);
    }
    const shareBtn = el("button", { text: "Share", class: `btn${done ? "" : " btn-secondary"}` }) as HTMLButtonElement;
    shareBtn.type = "button";
    shareBtn.addEventListener("click", () => void this.doShare());
    controls.append(shareBtn);
    this.root.append(controls);

    if (s.status === "won") this.root.append(el("p", { class: "win", text: "Perfect order — solved!" }));
    if (s.status === "lost") this.root.append(el("p", { class: "lose", text: "Out of tries — the correct order is shown." }));
  }

  private doSubmit(): void {
    if (!canSubmit(this.state)) return;
    const out = submit(this.state, this.puzzle, this.ordering);
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
    if (out.correct) this.announce("Perfect order!");
    else if (out.attempt) this.announce(`${out.attempt.correctPositions} of ${RANK_SIZE} in the right place. ${this.state.attemptsRemaining} tries left.`);
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

export const tierListPlugin: GamePlugin = {
  meta: { id: "tier-list", name: "Tier List", tagline: "Rank the words from common to rare.", glyph: "📊", accent: "#3ddbd9" },
  contentPackPath: "./tier-list.json",
  async mount(root, services) {
    const game = new TierList(root, services);
    await game.init("./tier-list.json");
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
