import type { GamePlugin, GameServices, GameInstance, DailyResult } from "../../kit/types.ts";
import { canonicalizeDayId, derivePuzzleId } from "../../kit/selection.ts";
import { loadStats, saveStats, recordPlayed, recordWon, type Stats } from "../../kit/stats.ts";
import { saveAttempt, loadAttempt } from "../../kit/persistence.ts";
import type { AttemptState, Puzzle } from "./types.ts";
import { initAttempt, submit, clearedCount, totalWords, wordId, isSolved } from "./engine.ts";
import { buildShareText, isSpoilerSafe } from "./share.ts";
import { carbonButton, carbonNotification } from "../../kit/carbon.ts";

interface ContentPack {
  contentPackVersion: string;
  datasetId: string;
  puzzleCount: number;
  puzzles: Puzzle[];
}

class CascadeType implements GameInstance {
  private pack!: ContentPack;
  private puzzle!: Puzzle;
  private state!: AttemptState;
  private stats!: Stats;
  private live!: HTMLElement;
  private draft = "";

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
    if (r.puzzleId !== this.puzzle.puzzleId || !Array.isArray(r.cleared)) return null;
    return {
      puzzleId: this.puzzle.puzzleId,
      dayId,
      cleared: r.cleared.filter((x): x is string => typeof x === "string"),
      exposedRow: typeof r.exposedRow === "number" ? r.exposedRow : 0,
      lastWord: typeof r.lastWord === "string" ? r.lastWord : null,
      combo: typeof r.combo === "number" ? r.combo : 0,
      comboMax: typeof r.comboMax === "number" ? r.comboMax : 0,
      score: typeof r.score === "number" ? r.score : 0,
      isComplete: r.isComplete === true,
    };
  }

  currentResult(): DailyResult {
    return { gameId: "cascade-type", dayId: this.state.dayId, played: this.state.isComplete, solved: isSolved(this.state) };
  }

  private persist(): void {
    saveAttempt(this.svc.storage, this.svc.keyFor(`state:${this.state.dayId}`), this.state);
    this.svc.onResult(this.currentResult());
  }

  render(): void {
    const done = this.state.isComplete;
    this.root.innerHTML = "";
    this.root.className = "game cascade-type";
    this.root.append(homeBar(this.svc, "Cascade Type"));
    this.root.append(
      el("p", { class: "sub", text: `${this.state.dayId} · UTC · ${clearedCount(this.state)}/${totalWords(this.puzzle)} cleared · score ${this.state.score} · combo ${this.state.combo}` }),
      el("p", { class: "help", text: "Clear words from the bottom row up by typing them. Chain words that share a letter to build a combo multiplier — order is everything." }),
    );

    this.live = liveRegion();
    this.root.append(this.live);

    // Cascade: render top-to-bottom so the exposed (bottom) row sits at the bottom.
    const stack = el("div", { class: "ct-stack" });
    const clearedSet = new Set(this.state.cleared);
    for (let r = this.puzzle.rows.length - 1; r >= 0; r--) {
      const rowEl = el("div", { class: `ct-row${r === this.state.exposedRow ? " ct-exposed" : ""}` });
      rowEl.setAttribute("role", "list");
      this.puzzle.rows[r].forEach((word, i) => {
        const isCleared = clearedSet.has(wordId(r, i));
        const exposed = r === this.state.exposedRow;
        const chip = el("span", { class: `ct-word${isCleared ? " ct-cleared" : exposed ? " ct-clearable" : " ct-locked"}` });
        chip.setAttribute("role", "listitem");
        // Show the word only when it's clearable (exposed) or cleared; hide upper rows.
        chip.textContent = isCleared ? "✓" : exposed ? word.toUpperCase() : "▨".repeat(word.length);
        chip.setAttribute("aria-label", isCleared ? `cleared word` : exposed ? `clearable word ${word.toUpperCase()}` : `hidden word, ${word.length} letters`);
        rowEl.append(chip);
      });
      stack.append(rowEl);
    }
    this.root.append(stack);

    if (done) {
      this.root.append(carbonNotification("Cascade cleared!", `Final score ${this.state.score}, best combo ${this.state.comboMax}.`, "success"));
    } else {
      this.root.append(this.buildInput());
    }

    const controls = el("div", { class: "controls" });
    if (!done) controls.append(carbonButton({ text: "Clear word", disabled: this.draft.replace(/[^A-Za-z]/g, "").length === 0, onClick: () => this.trySubmit() }));
    controls.append(carbonButton({ text: "Share", kind: "secondary", disabled: !done, onClick: () => void this.doShare() }));
    this.root.append(controls);
  }

  private buildInput(): HTMLElement {
    const wrap = el("div", { class: "ct-input" });
    const input = el("input", { class: "ct-field" }) as HTMLInputElement;
    input.type = "text";
    input.value = this.draft;
    input.setAttribute("aria-label", "Type a word from the exposed row");
    input.autocapitalize = "characters";
    input.autocomplete = "off";
    input.addEventListener("input", () => {
      this.draft = input.value;
      const btn = this.root.querySelector<HTMLElement>(".controls cds-button, .controls .btn");
      if (btn) { const empty = this.draft.replace(/[^A-Za-z]/g, "").length === 0; if (empty) btn.setAttribute("disabled", ""); else btn.removeAttribute("disabled"); }
    });
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") this.trySubmit(); });
    wrap.append(input);
    queueMicrotask(() => input.focus());
    return wrap;
  }

  private trySubmit(): void {
    const out = submit(this.state, this.puzzle, this.draft);
    if (!out.accepted) {
      this.announce("No matching word in the exposed row.");
      return;
    }
    this.draft = "";
    this.state = out.state;
    if (this.state.isComplete) {
      this.stats = recordWon(recordPlayed(this.stats, this.state.dayId), this.state.dayId);
      saveStats(this.svc.storage, this.svc.keyFor("stats"), this.stats);
    }
    this.persist();
    this.render();
    this.announce(out.linked ? `Linked! +${out.gained}, combo ${this.state.combo}.` : `Cleared. +${out.gained}. Combo reset.`);
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

export const cascadeTypePlugin: GamePlugin = {
  meta: { id: "cascade-type", name: "Cascade Type", tagline: "Clear the stack bottom-up; chain shared letters for combos.", glyph: "🌧️", accent: "#42be65" },
  contentPackPath: "./cascade-type.json",
  async mount(root, services) {
    const game = new CascadeType(root, services);
    await game.init("./cascade-type.json");
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
