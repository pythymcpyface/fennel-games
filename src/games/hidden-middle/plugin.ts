import type { GamePlugin, GameServices, GameInstance, DailyResult } from "../../kit/types.ts";
import { canonicalizeDayId, derivePuzzleId } from "../../kit/selection.ts";
import { loadStats, saveStats, recordPlayed, recordWon, type Stats } from "../../kit/stats.ts";
import { saveAttempt, loadAttempt } from "../../kit/persistence.ts";
import type { AttemptState, Puzzle } from "./types.ts";
import { MAX_INCORRECT_ATTEMPTS } from "./types.ts";
import { initAttempt, submit, canSubmit } from "./engine.ts";
import { applyHint } from "./hint.ts";
import { buildShareText, isSpoilerSafe } from "./share.ts";

interface ContentPack {
  contentPackVersion: string;
  datasetId: string;
  puzzleCount: number;
  dictionary: string[];
  puzzles: Puzzle[];
}

class HiddenMiddle implements GameInstance {
  private pack!: ContentPack;
  private dictionary!: Set<string>;
  private puzzle!: Puzzle;
  private state!: AttemptState;
  private stats!: Stats;
  private live!: HTMLElement;
  private hint: { startIndex: number; length: number } | null = null;

  constructor(private readonly root: HTMLElement, private readonly svc: GameServices) {}

  async init(packPath: string): Promise<void> {
    this.pack = JSON.parse(await this.svc.assets.loadText(packPath)) as ContentPack;
    this.dictionary = new Set(this.pack.dictionary);
    this.stats = loadStats(this.svc.storage, this.svc.keyFor("stats"));
    const dayId = canonicalizeDayId(this.svc.clock.nowMs(), "UTC");
    const puzzleId = derivePuzzleId(dayId, this.pack.contentPackVersion, this.pack.datasetId, this.pack.puzzleCount);
    this.puzzle = this.pack.puzzles[Number(puzzleId.slice(4))];
    const saved = loadAttempt<AttemptState>(this.svc.storage, this.svc.keyFor(`state:${dayId}`), (raw) => raw as AttemptState);
    this.state = saved ?? initAttempt(this.puzzle, dayId);
    if (this.state.hintRevealed) {
      const idx = this.puzzle.carrierWord.indexOf(this.puzzle.answerWord);
      this.hint = { startIndex: idx, length: this.puzzle.answerWord.length };
    }
  }

  currentResult(): DailyResult {
    return {
      gameId: "hidden-middle",
      dayId: this.state.dayId,
      played: this.state.guessHistory.length > 0 || this.state.status !== "in_progress",
      solved: this.state.status === "solved",
    };
  }

  private persist(): void {
    saveAttempt(this.svc.storage, this.svc.keyFor(`state:${this.state.dayId}`), this.state);
    this.svc.onResult(this.currentResult());
  }

  render(): void {
    const s = this.state;
    const done = s.status !== "in_progress";
    this.root.innerHTML = "";
    this.root.className = "game hidden-middle";
    this.root.append(homeBar(this.svc, "Hidden Middle"));
    this.root.append(el("p", { class: "sub", text: `${s.dayId} · UTC · ${MAX_INCORRECT_ATTEMPTS - s.incorrectAttemptsUsed} guesses left` }));

    // Carrier word, optionally with the hinted span underlined.
    const carrier = el("p", { class: "carrier" });
    if (this.hint) {
      const { startIndex, length } = this.hint;
      carrier.append(
        el("span", { text: this.puzzle.carrierWord.slice(0, startIndex) }),
        el("span", { class: "hinted", text: this.puzzle.carrierWord.slice(startIndex, startIndex + length) }),
        el("span", { text: this.puzzle.carrierWord.slice(startIndex + length) }),
      );
    } else {
      carrier.textContent = this.puzzle.carrierWord;
    }
    this.root.append(carrier);
    this.root.append(el("p", { class: "help", text: `Hidden word — ${this.puzzle.clue}` }));

    this.live = liveRegion();
    this.root.append(this.live);

    const form = el("form", { class: "row" }) as HTMLFormElement;
    const input = el("input", { class: "text-input" }) as HTMLInputElement;
    input.id = "guess-input";
    input.type = "text";
    input.autocomplete = "off";
    input.setAttribute("aria-label", `Hidden word: ${this.puzzle.clue}`);
    input.disabled = done;
    const submitBtn = el("button", { text: "Guess", class: "btn" }) as HTMLButtonElement;
    submitBtn.type = "submit";
    submitBtn.disabled = done;
    form.append(input, submitBtn);
    const error = el("p", { class: "error" });
    error.setAttribute("role", "alert");
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      if (!canSubmit(this.state)) return;
      const out = submit(this.state, this.puzzle, input.value, this.dictionary);
      this.state = out.state;
      if (out.result === "CORRECT") {
        this.stats = recordWon(recordPlayed(this.stats, this.state.dayId), this.state.dayId);
        saveStats(this.svc.storage, this.svc.keyFor("stats"), this.stats);
      } else if (this.state.status === "failed") {
        this.stats = recordPlayed(this.stats, this.state.dayId);
        saveStats(this.svc.storage, this.svc.keyFor("stats"), this.stats);
      }
      this.persist();
      input.value = "";
      this.render();
      if (out.result === "CORRECT") this.announce("Correct! You found the hidden word.");
      else if (out.result === "DUPLICATE") this.announce("Already guessed that.");
      else if (out.result === "EMPTY") this.announce("Type a word.");
      else if (out.feedback) this.announce(`${out.feedback.isSubstring ? "Inside the word" : "Not inside the word"}; ${out.feedback.isDictionaryWord ? "a real word" : "not a known word"}. ${MAX_INCORRECT_ATTEMPTS - this.state.incorrectAttemptsUsed} left.`);
      document.getElementById("guess-input")?.focus();
    });

    const controls = el("div", { class: "controls" });
    const hintBtn = el("button", { text: "Hint", class: "btn btn-secondary" }) as HTMLButtonElement;
    hintBtn.type = "button";
    hintBtn.disabled = done || s.hintRevealed;
    hintBtn.addEventListener("click", () => {
      const h = applyHint(this.state, this.puzzle);
      if (h) {
        this.state = h.state;
        this.hint = { startIndex: h.startIndex, length: h.length };
        this.persist();
      }
      this.render();
      this.announce(h ? `The hidden word starts at letter ${h.startIndex + 1} and is ${h.length} letters long.` : "No hint available.");
    });
    const shareBtn = el("button", { text: "Share", class: "btn btn-secondary" }) as HTMLButtonElement;
    shareBtn.type = "button";
    shareBtn.addEventListener("click", () => void this.doShare());
    controls.append(hintBtn, shareBtn);
    this.root.append(form, error, controls);

    // Prior guesses with non-color feedback labels.
    if (s.guessHistory.length) {
      const list = el("ul", { class: "guesses" });
      list.setAttribute("aria-label", "Your guesses");
      [...s.guessHistory].reverse().forEach((g) => {
        const li = el("li", { class: "guess" });
        const label = g.result === "CORRECT" ? "✓ correct" : `${g.isSubstring ? "◪ inside" : "□ not inside"}, ${g.isDictionaryWord ? "word" : "not a word"}`;
        li.append(el("span", { class: "gw", text: g.guess }), el("span", { class: "cue", text: label }));
        list.append(li);
      });
      this.root.append(list);
    }

    if (s.status === "solved") this.root.append(el("p", { class: "win", text: `Solved: ${this.puzzle.answerWord}` }));
    if (s.status === "failed") this.root.append(el("p", { class: "lose", text: `Out of guesses. It was ${this.puzzle.answerWord}.` }));
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

export const hiddenMiddlePlugin: GamePlugin = {
  meta: { id: "hidden-middle", name: "Hidden Middle", tagline: "Find the word hidden inside a longer word.", glyph: "🔍", accent: "#14b8a6" },
  contentPackPath: "./hidden-middle.json",
  async mount(root, services) {
    const game = new HiddenMiddle(root, services);
    await game.init("./hidden-middle.json");
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
