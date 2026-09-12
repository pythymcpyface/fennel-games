import type { GamePlugin, GameServices, GameInstance, DailyResult } from "../../kit/types.ts";
import { canonicalizeDayId } from "../../kit/selection.ts";
import { resolveDailyPuzzleIndex } from "../../kit/dev.ts";
import { loadStats, saveStats, recordPlayed, recordWon, type Stats } from "../../kit/stats.ts";
import { saveAttempt, loadAttempt } from "../../kit/persistence.ts";
import type { AttemptState, ErrorCode, Puzzle } from "./types.ts";
import { initAttempt, submitMove, findHint, canMove } from "./engine.ts";
import { buildShareText, isSpoilerSafe } from "./share.ts";

interface ContentPack { contentPackVersion: string; datasetId: string; puzzleCount: number; puzzles: Puzzle[]; }

const ERR: Record<ErrorCode, string> = {
  NOT_IN_DICTIONARY: "Not a word in the list.",
  NOT_ONE_LETTER_CHANGE: "Change exactly one letter.",
  WRONG_LENGTH: "Keep the same length.",
  OUT_OF_MOVES: "No moves left.",
  ALREADY_ENDED: "This puzzle is finished.",
};

class Palindial implements GameInstance {
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
    const idx = resolveDailyPuzzleIndex(
      "palindial", dayId, this.pack.contentPackVersion, this.pack.datasetId, this.pack.puzzleCount,
      { read: (k) => this.svc.storage.read(k) },
      (word) => this.pack.puzzles.findIndex((p) => p.startWord === word.toLowerCase() || p.targetWord === word.toLowerCase()),
    );
    this.puzzle = this.pack.puzzles[idx];
    const saved = loadAttempt<AttemptState>(this.svc.storage, this.svc.keyFor(`state:${dayId}`), (raw) => raw as AttemptState);
    this.state = saved ?? initAttempt(this.puzzle, dayId);
  }

  currentResult(): DailyResult {
    return { gameId: "palindial", dayId: this.state.dayId, played: this.state.movesUsed > 0 || this.state.status !== "in_progress", solved: this.state.status === "won" };
  }

  private persist(): void {
    saveAttempt(this.svc.storage, this.svc.keyFor(`state:${this.state.dayId}`), this.state);
    this.svc.onResult(this.currentResult());
  }

  render(): void {
    const s = this.state;
    const done = s.status !== "in_progress";
    this.root.innerHTML = "";
    this.root.className = "game palindial";
    this.root.append(homeBar(this.svc, "Palindial"));
    this.root.append(el("p", { class: "sub", text: `${s.dayId} · UTC · ${this.puzzle.moveBudget - s.movesUsed} moves left` }));
    const goal = el("p", { class: "help" });
    goal.append(el("span", { text: "Reach the reverse of " }), el("strong", { text: this.puzzle.startWord }), el("span", { text: " by changing one letter at a time." }));
    this.root.append(goal);

    const scoreLine = el("p", { class: "score-line" });
    const mirror = el("span", { class: "mirror-target", text: s.currentWord });
    scoreLine.append(el("strong", { class: "cur", text: s.currentWord }), el("span", { text: "  →  " }), mirror);
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
    const submitBtn = el("button", { text: "Change", class: "btn" }) as HTMLButtonElement;
    submitBtn.type = "submit";
    submitBtn.disabled = done;
    form.append(input, submitBtn);
    const error = el("p", { class: "error" });
    error.setAttribute("role", "alert");
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const r = submitMove(this.state, this.puzzle, input.value);
      if (!r.ok) { error.textContent = r.error ? ERR[r.error] : "Invalid."; this.announce(error.textContent); return; }
      this.state = r.state;
      if (this.state.status === "won") { this.stats = recordWon(recordPlayed(this.stats, this.state.dayId), this.state.dayId); saveStats(this.svc.storage, this.svc.keyFor("stats"), this.stats); }
      else if (this.state.status === "lost") { this.stats = recordPlayed(this.stats, this.state.dayId); saveStats(this.svc.storage, this.svc.keyFor("stats"), this.stats); }
      this.persist();
      input.value = "";
      this.render();
      this.announce(`${this.state.currentWord}.`);
      document.getElementById("guess-input")?.focus();
    });

    const controls = el("div", { class: "controls" });
    const hintBtn = el("button", { text: "Hint", class: "btn btn-secondary" }) as HTMLButtonElement;
    hintBtn.type = "button";
    hintBtn.disabled = done;
    const hintLine = el("p", { class: "hint-line" });
    hintLine.setAttribute("aria-hidden", "true");
    hintBtn.addEventListener("click", () => {
      const hint = findHint(this.state, this.puzzle);
      const msg = hint ? `Try "${hint}".` : "No hint available.";
      hintLine.textContent = msg;
      this.announce(msg);
    });
    const shareBtn = el("button", { text: "Share", class: "btn btn-secondary" }) as HTMLButtonElement;
    shareBtn.type = "button";
    shareBtn.addEventListener("click", () => void this.doShare());
    controls.append(hintBtn, shareBtn);
    this.root.append(form, error, controls, hintLine);

    const path = el("p", { class: "path" });
    s.path.forEach((w, i) => { if (i > 0) path.append(el("span", { class: "arrow", text: " → " })); path.append(el("span", { class: i === s.path.length - 1 ? "cur" : "", text: w })); });
    this.root.append(path);

    if (s.status === "won") this.root.append(el("p", { class: "win", text: `Reversed in ${s.movesUsed} moves!` }));
    if (s.status === "lost") this.root.append(el("p", { class: "lose", text: `Out of moves. Target was ${this.puzzle.targetWord}.` }));
    void canMove;
  }

  private async doShare(): Promise<void> {
    const text = buildShareText(this.state, this.puzzle, this.state.dayId);
    if (!isSpoilerSafe(text, this.state.path, this.puzzle.targetWord)) return this.announce("Sharing blocked.");
    const res = await this.svc.share.share(text);
    this.announce(res.ok ? (res.method === "clipboard" ? "Copied." : "Shared.") : "Sharing unavailable.");
  }

  private announce(msg: string): void {
    if (this.live) this.live.textContent = msg;
  }
}

export const palindialPlugin: GamePlugin = {
  meta: { id: "palindial", name: "Palindial", tagline: "Morph a word into its reverse-reading twin.", glyph: "🔁", accent: "#22d3ee" },
  contentPackPath: "./palindial.json",
  async mount(root, services) {
    const game = new Palindial(root, services);
    await game.init("./palindial.json");
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
