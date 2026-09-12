import type { GamePlugin, GameServices, GameInstance, DailyResult } from "../../kit/types.ts";
import { canonicalizeDayId, derivePuzzleId } from "../../kit/selection.ts";
import { loadStats, saveStats, recordPlayed, recordWon, type Stats } from "../../kit/stats.ts";
import { saveAttempt, loadAttempt } from "../../kit/persistence.ts";
import type { AttemptState, Evaluation, Puzzle } from "./types.ts";
import { initAttempt, submit, evaluate, imbalanceBand } from "./engine.ts";
import { buildShareText, isSpoilerSafe } from "./share.ts";
import { carbonButton, carbonNotification } from "../../kit/carbon.ts";

interface ContentPack {
  contentPackVersion: string;
  datasetId: string;
  puzzleCount: number;
  dictionary: string[];
  puzzles: Puzzle[];
}

class Tare implements GameInstance {
  private pack!: ContentPack;
  private dictionary!: Set<string>;
  private puzzle!: Puzzle;
  private state!: AttemptState;
  private stats!: Stats;
  private live!: HTMLElement;

  constructor(private readonly root: HTMLElement, private readonly svc: GameServices) {}

  async init(packPath: string): Promise<void> {
    this.pack = JSON.parse(await this.svc.assets.loadText(packPath)) as ContentPack;
    this.dictionary = new Set(this.pack.dictionary.map((w) => w.toUpperCase()));
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
    if (r.puzzleId !== this.puzzle.puzzleId) return null;
    return {
      puzzleId: this.puzzle.puzzleId,
      dayId,
      leftWord: typeof r.leftWord === "string" ? r.leftWord : "",
      rightWord: typeof r.rightWord === "string" ? r.rightWord : "",
      isComplete: r.isComplete === true,
      imbalance: typeof r.imbalance === "number" ? r.imbalance : 0,
    };
  }

  currentResult(): DailyResult {
    return { gameId: "tare", dayId: this.state.dayId, played: this.state.isComplete, solved: this.state.isComplete };
  }

  private persist(): void {
    saveAttempt(this.svc.storage, this.svc.keyFor(`state:${this.state.dayId}`), this.state);
    this.svc.onResult(this.currentResult());
  }

  render(): void {
    const done = this.state.isComplete;
    const ev = evaluate(this.puzzle, this.state.leftWord, this.state.rightWord, this.dictionary);
    this.root.innerHTML = "";
    this.root.className = "game tare";
    this.root.append(homeBar(this.svc, "Tare"));
    const totalWeight = this.puzzle.rack.reduce((n, t) => n + t.weight, 0);
    this.root.append(
      el("p", { class: "sub", text: `${this.state.dayId} · UTC · balance tolerance ±${this.puzzle.tolerance} · rack weight ${totalWeight}` }),
      el("p", { class: "help", text: "Split every tile into a LEFT word and a RIGHT word. Both must be real words, use all tiles once, and the beam must balance (equal weight within tolerance)." }),
    );

    // Rack display
    const rackEl = el("div", { class: "ta-rack" });
    rackEl.setAttribute("aria-label", "Your tiles and their weights");
    this.puzzle.rack.forEach((t) => {
      const chip = el("span", { class: "ta-tile", text: t.letter });
      chip.append(el("sub", { text: String(t.weight) }));
      chip.setAttribute("aria-label", `${t.letter} weight ${t.weight}`);
      rackEl.append(chip);
    });
    this.root.append(rackEl);

    this.live = liveRegion();
    this.root.append(this.live);

    if (!done) {
      this.root.append(this.buildInputs());
      // Live balance readout (numeric, not color-only).
      const beam = el("div", { class: "ta-beam" });
      beam.append(
        el("span", { class: "ta-pan", text: `LEFT ${ev.leftWeight}` }),
        el("span", { class: "ta-scale", text: ev.imbalance === 0 && ev.isRackExact ? "⚖️ balanced" : `Δ ${ev.imbalance}` }),
        el("span", { class: "ta-pan", text: `RIGHT ${ev.rightWeight}` }),
      );
      this.root.append(beam);
      if (this.state.leftWord && this.state.rightWord && !ev.isSolved) {
        this.root.append(carbonNotification("Not yet", this.hint(ev), "warning"));
      }
    } else {
      this.root.append(carbonNotification("Tared!", `Balanced within ±${this.puzzle.tolerance} (imbalance ${this.state.imbalance}).`, "success"));
    }

    const controls = el("div", { class: "controls" });
    if (!done) controls.append(carbonButton({ text: "Check balance", disabled: !ev.isSolved, onClick: () => this.trySubmit() }));
    controls.append(carbonButton({ text: "Share", kind: "secondary", disabled: !done, onClick: () => void this.doShare() }));
    this.root.append(controls);
  }

  private hint(ev: Evaluation): string {
    switch (ev.code) {
      case "NOT_IN_DICTIONARY_LEFT": return "Left side isn't a word.";
      case "NOT_IN_DICTIONARY_RIGHT": return "Right side isn't a word.";
      case "RACK_MISMATCH": return "Use every tile exactly once across both words.";
      case "NOT_BALANCED": return `Off balance by ${ev.imbalance} (tolerance ±${this.puzzle.tolerance}).`;
      default: return "Keep adjusting.";
    }
  }

  private buildInputs(): HTMLElement {
    const wrap = el("div", { class: "ta-inputs" });
    wrap.append(this.wordInput("LEFT word", this.state.leftWord, (v) => { this.state.leftWord = v; this.render(); this.refocus(".ta-left"); }, "ta-left"));
    wrap.append(this.wordInput("RIGHT word", this.state.rightWord, (v) => { this.state.rightWord = v; this.render(); this.refocus(".ta-right"); }, "ta-right"));
    return wrap;
  }

  private wordInput(label: string, value: string, onChange: (v: string) => void, cls: string): HTMLElement {
    const field = el("label", { class: "ta-field-wrap" });
    field.append(el("span", { class: "ta-field-label", text: label }));
    const input = el("input", { class: `ta-field ${cls}` }) as HTMLInputElement;
    input.type = "text";
    input.value = value;
    input.autocapitalize = "characters";
    input.autocomplete = "off";
    input.setAttribute("aria-label", label);
    input.addEventListener("input", () => onChange(input.value.replace(/[^A-Za-z]/g, "").toUpperCase()));
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") this.trySubmit(); });
    field.append(input);
    return field;
  }

  private refocus(sel: string): void {
    queueMicrotask(() => {
      const again = this.root.querySelector<HTMLInputElement>(sel);
      if (again) { again.focus(); again.setSelectionRange(again.value.length, again.value.length); }
    });
  }

  private trySubmit(): void {
    const out = submit(this.state, this.puzzle, this.state.leftWord, this.state.rightWord, this.dictionary);
    this.state = out.state;
    if (out.accepted) {
      this.stats = recordWon(recordPlayed(this.stats, this.state.dayId), this.state.dayId);
      saveStats(this.svc.storage, this.svc.keyFor("stats"), this.stats);
      this.persist();
      this.render();
      this.announce(`Balanced! Imbalance ${this.state.imbalance}.`);
    } else {
      this.persist();
      this.render();
      this.announce(this.hint(out.evaluation));
    }
  }

  private async doShare(): Promise<void> {
    const ev = evaluate(this.puzzle, this.state.leftWord, this.state.rightWord, this.dictionary);
    const band = imbalanceBand(ev);
    const text = buildShareText(this.state, band, this.state.dayId);
    if (!isSpoilerSafe(text, this.state)) return this.announce("Sharing blocked.");
    const res = await this.svc.share.share(text);
    this.announce(res.ok ? (res.method === "clipboard" ? "Copied." : "Shared.") : "Sharing unavailable.");
  }

  private announce(msg: string): void {
    if (this.live) this.live.textContent = msg;
  }
}

export const tarePlugin: GamePlugin = {
  meta: { id: "tare", name: "Tare", tagline: "Split the tiles into two words that balance the beam.", glyph: "⚖️", accent: "#08bdba" },
  contentPackPath: "./tare.json",
  async mount(root, services) {
    const game = new Tare(root, services);
    await game.init("./tare.json");
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
