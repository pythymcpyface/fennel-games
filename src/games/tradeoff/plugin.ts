import type { GamePlugin, GameServices, GameInstance, DailyResult } from "../../kit/types.ts";
import { canonicalizeDayId } from "../../kit/selection.ts";
import { resolveDailyPuzzleIndex } from "../../kit/dev.ts";
import { loadStats, saveStats, recordPlayed, recordWon, type Stats } from "../../kit/stats.ts";
import { saveAttempt, loadAttempt } from "../../kit/persistence.ts";
import type { AttemptState, ErrorCode, Puzzle } from "./types.ts";
import { initAttempt, submitMove, findHint, currentScore } from "./engine.ts";
import { buildShareText, isSpoilerSafe } from "./share.ts";

interface ContentPack {
  contentPackVersion: string;
  datasetId: string;
  puzzleCount: number;
  puzzles: Puzzle[];
}

const ERR: Record<ErrorCode, string> = {
  NOT_IN_DICTIONARY: "Not a word in the list.",
  NOT_ONE_LETTER_CHANGE: "Change exactly one letter.",
  WRONG_LENGTH: "Keep the same length.",
  OUT_OF_SWAPS: "No swaps left.",
  ALREADY_ENDED: "This puzzle is finished.",
  NO_IMPROVING_HINT: "No higher-scoring move available.",
};

class Tradeoff implements GameInstance {
  private pack!: ContentPack;
  private puzzle!: Puzzle;
  private state!: AttemptState;
  private stats!: Stats;
  private live!: HTMLElement;
  private lastHint: string | null = null;

  constructor(private readonly root: HTMLElement, private readonly svc: GameServices) {}

  async init(packPath: string): Promise<void> {
    this.pack = JSON.parse(await this.svc.assets.loadText(packPath)) as ContentPack;
    this.stats = loadStats(this.svc.storage, this.svc.keyFor("stats"));
    const dayId = canonicalizeDayId(this.svc.clock.nowMs(), "UTC");
    const idx = resolveDailyPuzzleIndex(
      "tradeoff", dayId, this.pack.contentPackVersion, this.pack.datasetId, this.pack.puzzleCount,
      { read: (k) => this.svc.storage.read(k) },
      (word) => this.pack.puzzles.findIndex((p) => p.startWord === word.toLowerCase()),
    );
    this.puzzle = this.pack.puzzles[idx];
    const saved = loadAttempt<AttemptState>(this.svc.storage, this.svc.keyFor(`state:${dayId}`), (raw) => raw as AttemptState);
    this.state = saved ?? initAttempt(this.puzzle, dayId);
  }

  currentResult(): DailyResult {
    return { gameId: "tradeoff", dayId: this.state.dayId, played: this.state.swapsUsed > 0 || this.state.winState !== "in_progress", solved: this.state.winState === "won" };
  }

  private persist(): void {
    saveAttempt(this.svc.storage, this.svc.keyFor(`state:${this.state.dayId}`), this.state);
    this.svc.onResult(this.currentResult());
  }

  render(): void {
    const s = this.state;
    const done = s.winState !== "in_progress";
    const score = currentScore(s, this.puzzle);
    this.root.innerHTML = "";
    this.root.className = "game tradeoff";
    this.root.append(homeBar(this.svc, "Tradeoff"));
    this.root.append(el("p", { class: "sub", text: `${s.dayId} · UTC · ${this.puzzle.swapBudget - s.swapsUsed} swaps left` }));
    this.root.append(el("p", { class: "help", text: `Swap one letter at a time to reach a word scoring ${this.puzzle.parScore}+.` }));

    const scoreLine = el("p", { class: "score-line" });
    scoreLine.append(el("strong", { class: "cur", text: `${s.currentWord}` }), el("span", { text: `  =  ${score}  (par ${this.puzzle.parScore})` }));
    this.root.append(scoreLine);

    this.live = liveRegion();
    this.root.append(this.live);

    const form = el("form", { class: "row" }) as HTMLFormElement;
    const input = el("input", { class: "text-input" }) as HTMLInputElement;
    input.id = "guess-input";
    input.type = "text";
    input.autocomplete = "off";
    input.maxLength = s.currentWord.length;
    input.setAttribute("aria-label", "Next word (one letter change)");
    input.disabled = done;
    const submit = el("button", { text: "Swap", class: "btn" }) as HTMLButtonElement;
    submit.type = "submit";
    submit.disabled = done;
    form.append(input, submit);
    const error = el("p", { class: "error" });
    error.setAttribute("role", "alert");
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const r = submitMove(this.state, this.puzzle, input.value);
      if (!r.ok) {
        error.textContent = r.error ? ERR[r.error] : "Invalid.";
        this.announce(error.textContent);
        return;
      }
      this.state = r.state;
      if (this.state.winState === "won") {
        this.stats = recordWon(recordPlayed(this.stats, this.state.dayId), this.state.dayId);
        saveStats(this.svc.storage, this.svc.keyFor("stats"), this.stats);
      } else if (this.state.winState === "lost") {
        this.stats = recordPlayed(this.stats, this.state.dayId);
        saveStats(this.svc.storage, this.svc.keyFor("stats"), this.stats);
      }
      this.persist();
      input.value = "";
      this.render();
      this.announce(`${this.state.currentWord}, score ${currentScore(this.state, this.puzzle)}.`);
      document.getElementById("guess-input")?.focus();
    });

    const controls = el("div", { class: "controls" });
    const hintBtn = el("button", { text: "Hint", class: "btn btn-secondary" }) as HTMLButtonElement;
    hintBtn.type = "button";
    hintBtn.disabled = done;
    hintBtn.addEventListener("click", () => {
      const hint = findHint(this.state, this.puzzle);
      if (hint) {
        this.state = { ...this.state, hintUsedCount: this.state.hintUsedCount + 1 };
        this.lastHint = `Try "${hint}".`;
        this.persist();
      } else {
        this.lastHint = ERR.NO_IMPROVING_HINT;
      }
      this.render();
      this.announce(hint ? `Try "${hint}".` : ERR.NO_IMPROVING_HINT);
    });
    const shareBtn = el("button", { text: "Share", class: "btn btn-secondary" }) as HTMLButtonElement;
    shareBtn.type = "button";
    shareBtn.addEventListener("click", () => void this.doShare());
    controls.append(hintBtn, shareBtn);
    this.root.append(form, error, controls);
    if (this.lastHint) {
      const hintLine = el("p", { class: "hint-line" });
      hintLine.setAttribute("aria-hidden", "true");
      hintLine.textContent = this.lastHint;
      this.root.append(hintLine);
    }

    // Path so far.
    const path = el("p", { class: "path" });
    s.moveHistory.forEach((w, i) => {
      if (i > 0) path.append(el("span", { class: "arrow", text: " → " }));
      path.append(el("span", { class: i === s.moveHistory.length - 1 ? "cur" : "", text: w }));
    });
    this.root.append(path);

    if (s.winState === "won") this.root.append(el("p", { class: "win", text: `Par beaten in ${s.swapsUsed} swaps!` }));
    if (s.winState === "lost") this.root.append(el("p", { class: "lose", text: `Out of swaps — best ${s.bestScore}.` }));
  }

  private async doShare(): Promise<void> {
    const text = buildShareText(this.state, this.puzzle, this.state.dayId);
    if (!isSpoilerSafe(text, this.state.moveHistory)) return this.announce("Sharing blocked.");
    const res = await this.svc.share.share(text);
    this.announce(res.ok ? (res.method === "clipboard" ? "Copied." : "Shared.") : "Sharing unavailable.");
  }

  private announce(msg: string): void {
    if (this.live) this.live.textContent = msg;
  }
}

export const tradeoffPlugin: GamePlugin = {
  meta: { id: "tradeoff", name: "Tradeoff", tagline: "Swap one letter at a time to beat par.", glyph: "🔀", accent: "#f43f5e" },
  contentPackPath: "./tradeoff.json",
  async mount(root, services) {
    const game = new Tradeoff(root, services);
    await game.init("./tradeoff.json");
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
