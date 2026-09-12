import type { GamePlugin, GameServices, GameInstance, DailyResult } from "../../kit/types.ts";
import { canonicalizeDayId, derivePuzzleId } from "../../kit/selection.ts";
import { loadStats, saveStats, recordPlayed, recordWon, type Stats } from "../../kit/stats.ts";
import { saveAttempt, loadAttempt } from "../../kit/persistence.ts";
import type { AttemptState, Puzzle } from "./types.ts";
import { A_CODE } from "./types.ts";
import { initAttempt, move, undo, currentWord, canMove } from "./engine.ts";
import { buildShareText, isSpoilerSafe } from "./share.ts";
import { carbonButton } from "../../kit/carbon.ts";

interface ContentPack {
  contentPackVersion: string;
  datasetId: string;
  puzzleCount: number;
  dictionary: string[];
  puzzles: Puzzle[];
}

class Tollgate implements GameInstance {
  private pack!: ContentPack;
  private dictionary!: Set<string>;
  private puzzle!: Puzzle;
  private state!: AttemptState;
  private stats!: Stats;
  private live!: HTMLElement;
  private draft = "";

  constructor(private readonly root: HTMLElement, private readonly svc: GameServices) {}

  async init(packPath: string): Promise<void> {
    this.pack = JSON.parse(await this.svc.assets.loadText(packPath)) as ContentPack;
    this.dictionary = new Set(this.pack.dictionary.map((w) => w.toUpperCase()));
    this.stats = loadStats(this.svc.storage, this.svc.keyFor("stats"));
    const dayId = canonicalizeDayId(this.svc.clock.nowMs(), "UTC");
    const puzzleId = derivePuzzleId(dayId, this.pack.contentPackVersion, this.pack.datasetId, this.pack.puzzleCount);
    this.puzzle = this.pack.puzzles[Number(puzzleId.slice(4))];
    const saved = loadAttempt<AttemptState>(this.svc.storage, this.svc.keyFor(`state:${dayId}`), (raw) => raw as AttemptState);
    this.state = saved ?? initAttempt(this.puzzle, dayId);
  }

  currentResult(): DailyResult {
    return { gameId: "tollgate", dayId: this.state.dayId, played: this.state.path.length > 1 || this.state.isSolved, solved: this.state.isSolved };
  }

  private persist(): void {
    saveAttempt(this.svc.storage, this.svc.keyFor(`state:${this.state.dayId}`), this.state);
    this.svc.onResult(this.currentResult());
  }

  render(): void {
    const s = this.state;
    const done = s.isSolved;
    this.root.innerHTML = "";
    this.root.className = "game tollgate";
    this.root.append(homeBar(this.svc, "Tollgate"));
    this.root.append(
      el("p", { class: "sub", text: `${s.dayId} · UTC · cost ${s.totalCost} / par ${this.puzzle.par}` }),
      el("p", { class: "help", text: "Change one letter at a time to reach the target. Each new letter costs its toll — reach the target for the LOWEST total, beating par." }),
    );

    const ends = el("div", { class: "tg-ends" });
    ends.append(
      el("span", { class: "tg-end", text: `START ${this.puzzle.start}` }),
      el("span", { class: "tg-arrow", text: "→" }),
      el("span", { class: "tg-end", text: `TARGET ${this.puzzle.target}` }),
    );
    this.root.append(ends);

    this.root.append(this.buildTollLegend());

    this.live = liveRegion();
    this.root.append(this.live);

    // Path so far
    const pathEl = el("div", { class: "tg-path" });
    pathEl.setAttribute("role", "list");
    pathEl.setAttribute("aria-label", "Your path so far");
    s.path.forEach((w, i) => {
      const item = el("span", { class: `tg-rung${i === s.path.length - 1 ? " current" : ""}`, text: w });
      item.setAttribute("role", "listitem");
      pathEl.append(item);
      if (i < s.path.length - 1) pathEl.append(el("span", { class: "tg-sep", text: "→" }));
    });
    this.root.append(pathEl);

    if (!done) this.root.append(this.buildInput());

    const controls = el("div", { class: "controls" });
    const undoBtn = carbonButton({ text: "Undo", kind: "secondary", disabled: done || s.path.length <= 1, onClick: () => { this.state = undo(this.state, this.puzzle); this.persist(); this.render(); } });
    const shareBtn = carbonButton({ text: "Share", kind: "secondary", onClick: () => void this.doShare() });
    controls.append(undoBtn, shareBtn);
    this.root.append(controls);

    if (s.isSolved) {
      const delta = s.totalCost - this.puzzle.par;
      this.root.append(el("p", { class: "win", text: delta <= 0 ? `Reached par! Cost ${s.totalCost}.` : `Solved at cost ${s.totalCost} (par ${this.puzzle.par}, +${delta}).` }));
    }
  }

  private buildTollLegend(): HTMLElement {
    const wrap = el("div", { class: "tg-tolls" });
    wrap.setAttribute("aria-label", "Letter tolls");
    // Only show letters with non-default toll to keep it compact.
    for (let i = 0; i < 26; i++) {
      const toll = this.puzzle.tolls[i];
      const chip = el("span", { class: `tg-toll toll-${toll}`, text: `${String.fromCharCode(A_CODE + i)}:${toll}` });
      wrap.append(chip);
    }
    return wrap;
  }

  private buildInput(): HTMLElement {
    const wrap = el("div", { class: "tg-input" });
    const input = el("input", { class: "tg-field" }) as HTMLInputElement;
    input.type = "text";
    input.maxLength = this.puzzle.start.length;
    input.value = this.draft;
    input.setAttribute("aria-label", `Enter the next word (${this.puzzle.start.length} letters, one letter changed)`);
    input.autocapitalize = "characters";
    input.autocomplete = "off";
    input.addEventListener("input", () => {
      this.draft = input.value.replace(/[^A-Za-z]/g, "").toUpperCase().slice(0, this.puzzle.start.length);
      input.value = this.draft;
    });
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") this.tryMove(); });
    const go = carbonButton({ text: "Move", onClick: () => this.tryMove() });
    wrap.append(input, go);
    queueMicrotask(() => input.focus());
    return wrap;
  }

  private tryMove(): void {
    if (!canMove(this.state)) return;
    const out = move(this.state, this.puzzle, this.dictionary, this.draft);
    if (!out.accepted) {
      const msg = out.reason === "dictionary" ? "Not in word list."
        : out.reason === "not-one-change" ? "Change exactly one letter."
        : out.reason === "length" ? `Must be ${this.puzzle.start.length} letters.`
        : "Already solved.";
      this.announce(msg);
      return;
    }
    this.state = out.state;
    this.draft = "";
    if (this.state.isSolved) {
      this.stats = recordWon(recordPlayed(this.stats, this.state.dayId), this.state.dayId);
      saveStats(this.svc.storage, this.svc.keyFor("stats"), this.stats);
    } else if (this.state.path.length === 2) {
      this.stats = recordPlayed(this.stats, this.state.dayId);
      saveStats(this.svc.storage, this.svc.keyFor("stats"), this.stats);
    }
    this.persist();
    this.render();
    this.announce(out.solved ? `Reached ${currentWord(this.state)}! Total cost ${this.state.totalCost}.` : `+${out.cost} toll. Total ${this.state.totalCost}.`);
  }

  private async doShare(): Promise<void> {
    const text = buildShareText(this.state, this.puzzle, this.state.dayId);
    const words = [this.puzzle.start, this.puzzle.target, ...this.state.path];
    if (!isSpoilerSafe(text, words)) return this.announce("Sharing blocked.");
    const res = await this.svc.share.share(text);
    this.announce(res.ok ? (res.method === "clipboard" ? "Copied." : "Shared.") : "Sharing unavailable.");
  }

  private announce(msg: string): void {
    if (this.live) this.live.textContent = msg;
  }
}

export const tollgatePlugin: GamePlugin = {
  meta: { id: "tollgate", name: "Tollgate", tagline: "Word ladder, but cheapest path wins.", glyph: "🚧", accent: "#ff832b" },
  contentPackPath: "./tollgate.json",
  async mount(root, services) {
    const game = new Tollgate(root, services);
    await game.init("./tollgate.json");
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
