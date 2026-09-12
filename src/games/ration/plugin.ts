import type { GamePlugin, GameServices, GameInstance, DailyResult } from "../../kit/types.ts";
import { canonicalizeDayId, derivePuzzleId } from "../../kit/selection.ts";
import { loadStats, saveStats, recordPlayed, recordWon, type Stats } from "../../kit/stats.ts";
import { saveAttempt, loadAttempt } from "../../kit/persistence.ts";
import type { AttemptState, Puzzle } from "./types.ts";
import { initAttempt, submit, removeWord, remainingInventory, coverage, score, canSubmit } from "./engine.ts";
import { buildShareText, isSpoilerSafe } from "./share.ts";
import { carbonButton } from "../../kit/carbon.ts";

interface ContentPack {
  contentPackVersion: string;
  datasetId: string;
  puzzleCount: number;
  dictionary: string[];
  puzzles: Puzzle[];
}

class Ration implements GameInstance {
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
    return { gameId: "ration", dayId: this.state.dayId, played: this.state.words.length > 0 || this.state.isComplete, solved: this.state.isComplete };
  }

  private persist(): void {
    saveAttempt(this.svc.storage, this.svc.keyFor(`state:${this.state.dayId}`), this.state);
    this.svc.onResult(this.currentResult());
  }

  render(): void {
    const s = this.state;
    const done = s.isComplete;
    this.root.innerHTML = "";
    this.root.className = "game ration";
    this.root.append(homeBar(this.svc, "Ration"));
    this.root.append(
      el("p", { class: "sub", text: `${s.dayId} · UTC · ${score(s.words)} letters used` }),
      el("p", { class: "help", text: "Form words to hit the target lengths. Every letter is spent from a shared stock — you can't reuse it." }),
    );
    this.live = liveRegion();
    this.root.append(this.live);

    // Inventory with remaining counts
    const rem = remainingInventory(this.puzzle, s.words);
    const inv = el("div", { class: "rn-inv" });
    inv.setAttribute("aria-label", "Letter inventory, remaining counts");
    Object.keys(this.puzzle.inventory).sort().forEach((ch) => {
      const left = rem[ch] ?? 0;
      const chip = el("span", { class: `rn-letter${left === 0 ? " empty" : ""}`, text: `${ch} ×${left}` });
      chip.setAttribute("aria-label", `${ch}: ${left} remaining of ${this.puzzle.inventory[ch]}`);
      inv.append(chip);
    });
    this.root.append(inv);

    // Targets with coverage
    const cov = coverage(s.words, this.puzzle.targets);
    const tg = el("div", { class: "rn-targets" });
    tg.setAttribute("role", "list");
    tg.setAttribute("aria-label", "Target word lengths");
    this.puzzle.targets.slice().sort((a, b) => a.length - b.length).forEach((t) => {
      const met = cov[t.length] ?? 0;
      const row = el("span", { class: `rn-target${met >= t.count ? " met" : ""}`, text: `${t.length}-letter: ${met}/${t.count}` });
      row.setAttribute("role", "listitem");
      tg.append(row);
    });
    this.root.append(tg);

    if (!done) this.root.append(this.buildInput());

    // Submitted words
    if (s.words.length > 0) {
      const list = el("div", { class: "rn-words" });
      list.setAttribute("role", "list");
      list.setAttribute("aria-label", "Your words");
      s.words.forEach((w) => {
        const row = el("span", { class: "rn-word" });
        row.setAttribute("role", "listitem");
        row.append(el("span", { text: `${w} (${w.length})` }));
        if (!done) {
          const rm = el("button", { class: "rn-remove", text: "✕" }) as HTMLButtonElement;
          rm.type = "button";
          rm.setAttribute("aria-label", `Remove ${w}`);
          rm.addEventListener("click", () => { this.state = removeWord(this.state, w); this.persist(); this.render(); });
          row.append(rm);
        }
        list.append(row);
      });
      this.root.append(list);
    }

    const controls = el("div", { class: "controls" });
    const shareBtn = carbonButton({ text: "Share", kind: "secondary", onClick: () => void this.doShare() });
    controls.append(shareBtn);
    this.root.append(controls);

    if (done) this.root.append(el("p", { class: "win", text: `All targets met — ${score(s.words)} letters used!` }));
  }

  private buildInput(): HTMLElement {
    const wrap = el("div", { class: "rn-input" });
    const input = el("input", { class: "rn-field" }) as HTMLInputElement;
    input.type = "text";
    input.value = this.draft;
    input.setAttribute("aria-label", "Enter a word");
    input.autocapitalize = "characters";
    input.autocomplete = "off";
    input.addEventListener("input", () => {
      this.draft = input.value.replace(/[^A-Za-z]/g, "").toUpperCase();
      input.value = this.draft;
    });
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") this.trySubmit(); });
    const go = carbonButton({ text: "Add word", onClick: () => this.trySubmit() });
    wrap.append(input, go);
    queueMicrotask(() => input.focus());
    return wrap;
  }

  private trySubmit(): void {
    if (!canSubmit(this.state)) return;
    const out = submit(this.state, this.puzzle, this.dictionary, this.draft);
    if (!out.accepted) {
      const msg = out.reason === "dictionary" ? "Not in word list."
        : out.reason === "inventory" ? "Not enough letters left."
        : out.reason === "duplicate" ? "Already used that word."
        : "Enter a valid word (2+ letters).";
      this.announce(msg);
      return;
    }
    this.state = out.state;
    this.draft = "";
    if (this.state.isComplete) {
      this.stats = recordWon(recordPlayed(this.stats, this.state.dayId), this.state.dayId);
      saveStats(this.svc.storage, this.svc.keyFor("stats"), this.stats);
    } else if (this.state.words.length === 1) {
      this.stats = recordPlayed(this.stats, this.state.dayId);
      saveStats(this.svc.storage, this.svc.keyFor("stats"), this.stats);
    }
    this.persist();
    this.render();
    this.announce(out.solved ? "All targets met!" : "Word added.");
  }

  private async doShare(): Promise<void> {
    const text = buildShareText(this.state, this.puzzle.targets, this.state.dayId);
    if (!isSpoilerSafe(text, this.state.words)) return this.announce("Sharing blocked.");
    const res = await this.svc.share.share(text);
    this.announce(res.ok ? (res.method === "clipboard" ? "Copied." : "Shared.") : "Sharing unavailable.");
  }

  private announce(msg: string): void {
    if (this.live) this.live.textContent = msg;
  }
}

export const rationPlugin: GamePlugin = {
  meta: { id: "ration", name: "Ration", tagline: "Spend a shared letter stock to hit word-length targets.", glyph: "🎟️", accent: "#d12771" },
  contentPackPath: "./ration.json",
  async mount(root, services) {
    const game = new Ration(root, services);
    await game.init("./ration.json");
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
