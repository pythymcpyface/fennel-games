import type { GamePlugin, GameServices, GameInstance, DailyResult } from "../../kit/types.ts";
import { canonicalizeDayId } from "../../kit/selection.ts";
import { loadStats, saveStats, recordPlayed, recordWon, type Stats } from "../../kit/stats.ts";
import { saveAttempt, loadAttempt } from "../../kit/persistence.ts";
import type { LengthDataset, PuzzleState, ValidationResult } from "./types.ts";
import {
  loadDataset,
  selectDailyPair,
  createInitialState,
  currentWord,
  moveCount,
  submit,
  undo,
  reset,
} from "./engine.ts";
import { computeHintNextWord } from "./hint.ts";
import { buildShareText } from "./share.ts";

/** The pack bundles one dataset per supported word length. */
interface ContentPack {
  contentPackVersion: string;
  datasetId: string;
  defaultWordLength: number;
  lengths: LengthDataset[];
}

const FEEDBACK: Record<ValidationResult, string> = {
  VALID: "Good move.",
  INVALID_LENGTH: "Wrong number of letters.",
  INVALID_CHARS: "Letters a–z only.",
  NOT_IN_DICTIONARY: "Not a word in the dictionary.",
  NOT_ONE_LETTER: "Change exactly one letter.",
  SAME_AS_CURRENT: "That is the current word.",
};

class WordMorph implements GameInstance {
  private pack!: ContentPack;
  private dayId!: string;
  private dataset!: LengthDataset;
  private dictionary!: Set<string>;
  private state!: PuzzleState;
  private stats!: Stats;
  private live!: HTMLElement;
  private wordLength!: number;
  private lastHint: string | null = null;
  private recorded = false;

  constructor(private readonly root: HTMLElement, private readonly svc: GameServices) {}

  async init(packPath: string): Promise<void> {
    this.pack = JSON.parse(await this.svc.assets.loadText(packPath)) as ContentPack;
    this.stats = loadStats(this.svc.storage, this.svc.keyFor("stats"));
    this.dayId = canonicalizeDayId(this.svc.clock.nowMs(), "UTC");
    const savedLen = this.svc.storage.read(this.svc.keyFor("length"));
    const parsed = savedLen === null ? NaN : Number(savedLen);
    this.wordLength = this.pack.lengths.some((d) => d.wordLength === parsed)
      ? parsed
      : this.pack.defaultWordLength;
    this.activateLength(this.wordLength);
  }

  /** Load the dataset for a word length, restore or seed the day's puzzle. */
  private activateLength(length: number): void {
    this.wordLength = length;
    this.svc.storage.write(this.svc.keyFor("length"), String(length));
    const raw = this.pack.lengths.find((d) => d.wordLength === length) ?? this.pack.lengths[0];
    this.dataset = loadDataset(raw);
    this.dictionary = new Set(this.dataset.dictionaryWords);
    const pair = selectDailyPair(this.dataset, this.dayId);
    const fresh = createInitialState(pair.startWordText, pair.targetWordText, pair.par);
    const saved = loadAttempt<PuzzleState>(
      this.svc.storage,
      this.svc.keyFor(`state:${length}:${this.dayId}`),
      (r) => r as PuzzleState,
    );
    this.state = saved && saved.moveHistory[0] === fresh.startWordText ? saved : fresh;
    this.recorded = this.state.gameStatus === "WON";
  }

  currentResult(): DailyResult {
    return {
      gameId: "word-morph",
      dayId: this.dayId,
      played: moveCount(this.state) > 0 || this.state.gameStatus === "WON",
      solved: this.state.gameStatus === "WON",
    };
  }

  private persist(): void {
    saveAttempt(this.svc.storage, this.svc.keyFor(`state:${this.wordLength}:${this.dayId}`), this.state);
    this.svc.onResult(this.currentResult());
  }

  render(): void {
    const won = this.state.gameStatus === "WON";
    this.root.innerHTML = "";
    this.root.className = "game word-morph";
    this.root.append(homeBar(this.svc, "Word Morph"));
    this.root.append(
      el("p", { class: "sub", text: `${this.dayId} · UTC · par ${this.state.par}` }),
      el("p", { class: "help", text: `Change one letter at a time: ${this.state.startWordText.toUpperCase()} → ${this.state.targetWordText.toUpperCase()}` }),
    );

    // Word-length selector (honours "keep all four lengths").
    const lenBar = el("div", { class: "lengths" });
    lenBar.setAttribute("role", "group");
    lenBar.setAttribute("aria-label", "Word length");
    for (const d of this.pack.lengths) {
      const b = el("button", { class: `len${d.wordLength === this.wordLength ? " on" : ""}`, text: `${d.wordLength}` }) as HTMLButtonElement;
      b.type = "button";
      b.setAttribute("aria-pressed", String(d.wordLength === this.wordLength));
      b.addEventListener("click", () => { this.activateLength(d.wordLength); this.render(); });
      lenBar.append(b);
    }
    this.root.append(lenBar);

    this.live = liveRegion();
    this.root.append(this.live);

    const ladder = el("ol", { class: "ladder" });
    this.state.moveHistory.forEach((w) => ladder.append(el("li", { class: "rung", text: w.toUpperCase() })));
    ladder.append(el("li", { class: "rung target", text: this.state.targetWordText.toUpperCase() }));
    this.root.append(ladder);
    this.root.append(el("p", { class: "preview", text: `Current: ${currentWord(this.state).toUpperCase()} · moves ${moveCount(this.state)}` }));

    const form = el("form", { class: "controls" }) as HTMLFormElement;
    const input = el("input", { class: "morph-input" }) as HTMLInputElement;
    input.type = "text";
    input.maxLength = this.wordLength;
    input.setAttribute("aria-label", "Next word");
    input.autocomplete = "off";
    input.disabled = won;
    const submitBtn = el("button", { text: "Enter", class: "btn" }) as HTMLButtonElement;
    submitBtn.type = "submit";
    submitBtn.disabled = won;
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const out = submit(this.state, input.value, this.dictionary, this.dataset.wordLength);
      this.state = out.state;
      if (out.result === "VALID" && this.state.gameStatus === "WON" && !this.recorded) {
        this.recorded = true;
        this.stats = recordWon(recordPlayed(this.stats, this.dayId), this.dayId);
        saveStats(this.svc.storage, this.svc.keyFor("stats"), this.stats);
      }
      this.persist();
      this.render();
      this.announce(this.state.gameStatus === "WON" ? "Solved!" : FEEDBACK[out.result]);
    });
    form.append(input, submitBtn);
    this.root.append(form);

    const controls = el("div", { class: "controls" });
    const undoBtn = el("button", { text: "Undo", class: "btn btn-secondary" }) as HTMLButtonElement;
    undoBtn.type = "button";
    undoBtn.disabled = won || moveCount(this.state) === 0;
    undoBtn.addEventListener("click", () => { this.state = undo(this.state); this.persist(); this.render(); });
    const resetBtn = el("button", { text: "Reset", class: "btn btn-secondary" }) as HTMLButtonElement;
    resetBtn.type = "button";
    resetBtn.addEventListener("click", () => { this.state = reset(this.state); this.persist(); this.render(); });
    const hintBtn = el("button", { text: "Hint", class: "btn btn-secondary" }) as HTMLButtonElement;
    hintBtn.type = "button";
    hintBtn.disabled = won;
    hintBtn.addEventListener("click", () => {
      const h = computeHintNextWord(this.dataset, this.state);
      const msg = h.hintStatus === "OK" && h.hintNextWordText ? `Try: ${h.hintNextWordText.toUpperCase()}` : "No hint available.";
      this.lastHint = msg;
      this.render();
      this.announce(msg);
    });
    const shareBtn = el("button", { text: "Share", class: "btn btn-secondary" }) as HTMLButtonElement;
    shareBtn.type = "button";
    shareBtn.addEventListener("click", () => void this.doShare());
    controls.append(undoBtn, resetBtn, hintBtn, shareBtn);
    this.root.append(controls);
    if (this.lastHint) {
      const hintLine = el("p", { class: "hint-line" });
      hintLine.setAttribute("aria-hidden", "true");
      hintLine.textContent = this.lastHint;
      this.root.append(hintLine);
    }

    if (won) this.root.append(el("p", { class: "win", text: `Solved in ${moveCount(this.state)} (par ${this.state.par})!` }));
  }

  private async doShare(): Promise<void> {
    if (this.state.gameStatus !== "WON") return this.announce("Solve it first to share.");
    const text = buildShareText(this.dayId, moveCount(this.state), this.state.par);
    const res = await this.svc.share.share(text);
    this.announce(res.ok ? (res.method === "clipboard" ? "Copied." : "Shared.") : "Sharing unavailable.");
  }

  private announce(msg: string): void {
    if (this.live) this.live.textContent = msg;
  }
}

export const wordMorphPlugin: GamePlugin = {
  meta: { id: "word-morph", name: "Word Morph", tagline: "Change one letter at a time to reach the target.", glyph: "🪜", accent: "#10b981" },
  contentPackPath: "./word-morph.json",
  async mount(root, services) {
    const game = new WordMorph(root, services);
    await game.init("./word-morph.json");
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
