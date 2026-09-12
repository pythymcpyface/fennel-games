import type { GamePlugin, GameServices, GameInstance, DailyResult } from "../../kit/types.ts";
import { canonicalizeDayId, derivePuzzleId } from "../../kit/selection.ts";
import { loadStats, saveStats, recordPlayed, recordWon, type Stats } from "../../kit/stats.ts";
import { saveAttempt, loadAttempt } from "../../kit/persistence.ts";
import type { AttemptState, Puzzle } from "./types.ts";
import { ATTEMPTS_TOTAL } from "./types.ts";
import { initAttempt, submit, applyHint, canSubmit } from "./engine.ts";
import { buildShareText, isSpoilerSafe } from "./share.ts";

interface ContentPack { contentPackVersion: string; datasetId: string; puzzleCount: number; dictionary: string[]; puzzles: Puzzle[]; }

class Numeronym implements GameInstance {
  private pack!: ContentPack;
  private dictionary!: Set<string>;
  private puzzle!: Puzzle;
  private state!: AttemptState;
  private stats!: Stats;
  private live!: HTMLElement;
  private selected = 0;

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
    this.selected = Math.max(0, this.state.solved.findIndex((s) => !s));
  }

  currentResult(): DailyResult {
    return { gameId: "numeronym", dayId: this.state.dayId, played: this.state.status !== "in_progress" || this.state.solved.some(Boolean) || this.state.attemptsRemaining < ATTEMPTS_TOTAL, solved: this.state.status === "won" };
  }

  private persist(): void {
    saveAttempt(this.svc.storage, this.svc.keyFor(`state:${this.state.dayId}`), this.state);
    this.svc.onResult(this.currentResult());
  }

  render(): void {
    const s = this.state;
    const done = s.status !== "in_progress";
    this.root.innerHTML = "";
    this.root.className = "game numeronym";
    this.root.append(homeBar(this.svc, "Numeronym"));
    this.root.append(el("p", { class: "sub", text: `${s.dayId} · UTC · ${s.attemptsRemaining}/${ATTEMPTS_TOTAL} attempts` }));
    this.root.append(el("p", { class: "help", text: "Expand each texting-style clue. Tap a clue, then type the word." }));

    this.live = liveRegion();
    this.root.append(this.live);

    const list = el("div", { class: "num-list" });
    list.setAttribute("role", "group");
    this.puzzle.clues.forEach((clue, i) => {
      const item = el("button", { class: `num-clue${this.selected === i ? " selected" : ""}${s.solved[i] ? " solved" : ""}` }) as HTMLButtonElement;
      item.type = "button";
      item.disabled = done || s.solved[i];
      const len = !s.solved[i] && s.revealedLengths[i] ? ` (${s.revealedLengths[i]} letters)` : "";
      item.textContent = (s.solved[i] ? this.puzzle.answers[i] : clue) + len;
      item.setAttribute("aria-label", `${s.solved[i] ? "solved " + this.puzzle.answers[i] : "clue " + clue}${len}`);
      item.addEventListener("click", () => { this.selected = i; this.render(); document.getElementById("guess-input")?.focus(); });
      list.append(item);
    });
    this.root.append(list);

    if (!done) {
      const form = el("form", { class: "row" }) as HTMLFormElement;
      const input = el("input", { class: "text-input" }) as HTMLInputElement;
      input.id = "guess-input";
      input.type = "text";
      input.autocomplete = "off";
      input.setAttribute("aria-label", `Expand ${this.puzzle.clues[this.selected]}`);
      const sub = el("button", { text: "Enter", class: "btn" }) as HTMLButtonElement;
      sub.type = "submit";
      form.append(input, sub);
      const error = el("p", { class: "error" });
      error.setAttribute("role", "alert");
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        if (!canSubmit(this.state)) return;
        const out = submit(this.state, this.puzzle, this.selected, input.value, this.dictionary);
        this.state = out.state;
        if (this.state.status === "won") { this.stats = recordWon(recordPlayed(this.stats, this.state.dayId), this.state.dayId); saveStats(this.svc.storage, this.svc.keyFor("stats"), this.stats); }
        else if (this.state.status === "lost") { this.stats = recordPlayed(this.stats, this.state.dayId); saveStats(this.svc.storage, this.svc.keyFor("stats"), this.stats); }
        if (out.correct) { const n = this.state.solved.findIndex((v) => !v); if (n >= 0) this.selected = n; }
        this.persist();
        input.value = "";
        this.render();
        if (out.correct) this.announce("Correct!");
        else if (out.error === "empty_guess") this.announce("Type a word.");
        else if (out.error === "not_in_dictionary") this.announce(`Not a word. ${this.state.attemptsRemaining} left.`);
        else if (out.error === "encoding_mismatch") this.announce(`Doesn't match the clue. ${this.state.attemptsRemaining} left.`);
        else if (out.error === "wrong_answer") this.announce(`Fits the clue but not the answer. ${this.state.attemptsRemaining} left.`);
        document.getElementById("guess-input")?.focus();
      });
      const controls = el("div", { class: "controls" });
      const hintBtn = el("button", { text: "Hint", class: "btn btn-secondary" }) as HTMLButtonElement;
      hintBtn.type = "button";
      hintBtn.addEventListener("click", () => {
        const next = applyHint(this.state, this.puzzle, this.selected);
        if (next) { this.state = next; this.persist(); }
        this.render();
        this.announce(next ? `${this.puzzle.answers[this.selected].length} letters.` : "No hint available.");
      });
      const shareBtn = el("button", { text: "Share", class: "btn btn-secondary" }) as HTMLButtonElement;
      shareBtn.type = "button";
      shareBtn.addEventListener("click", () => void this.doShare());
      controls.append(hintBtn, shareBtn);
      this.root.append(form, error, controls);
    } else {
      const controls = el("div", { class: "controls" });
      const shareBtn = el("button", { text: "Share", class: "btn" }) as HTMLButtonElement;
      shareBtn.type = "button";
      shareBtn.addEventListener("click", () => void this.doShare());
      controls.append(shareBtn);
      this.root.append(controls);
    }

    if (s.status === "won") this.root.append(el("p", { class: "win", text: `Solved — theme: ${this.puzzle.themeLabel}` }));
    if (s.status === "lost") this.root.append(el("p", { class: "lose", text: "Out of attempts." }));
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

export const numeronymPlugin: GamePlugin = {
  meta: { id: "numeronym", name: "Numeronym", tagline: "Expand the texting shorthand (GR8, L8R, 2NITE).", glyph: "🔢", accent: "#0ea5e9" },
  contentPackPath: "./numeronym.json",
  async mount(root, services) {
    const game = new Numeronym(root, services);
    await game.init("./numeronym.json");
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
