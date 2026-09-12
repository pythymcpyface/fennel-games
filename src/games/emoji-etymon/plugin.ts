import type { GamePlugin, GameServices, GameInstance, DailyResult } from "../../kit/types.ts";
import { canonicalizeDayId, derivePuzzleId } from "../../kit/selection.ts";
import { loadStats, saveStats, recordPlayed, recordWon, type Stats } from "../../kit/stats.ts";
import { saveAttempt, loadAttempt } from "../../kit/persistence.ts";
import type { AttemptState, Puzzle, RevealState } from "./types.ts";
import { MAX_GUESSES } from "./types.ts";
import { initAttempt, submit, useHint, canGuess } from "./engine.ts";
import { buildShareText, isSpoilerSafe } from "./share.ts";

interface ContentPack { contentPackVersion: string; datasetId: string; puzzleCount: number; puzzles: Puzzle[]; }

const ICON: Record<RevealState, string> = { EXACT: "■", PRESENT: "◪", ABSENT: "□" };
const LABEL: Record<RevealState, string> = { EXACT: "correct", PRESENT: "present", ABSENT: "absent" };

class EmojiEtymon implements GameInstance {
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
    const puzzleId = derivePuzzleId(dayId, this.pack.contentPackVersion, this.pack.datasetId, this.pack.puzzleCount);
    this.puzzle = this.pack.puzzles[Number(puzzleId.slice(4))];
    const saved = loadAttempt<AttemptState>(this.svc.storage, this.svc.keyFor(`state:${dayId}`), (raw) => raw as AttemptState);
    this.state = saved ?? initAttempt(this.puzzle, dayId);
  }

  currentResult(): DailyResult {
    return { gameId: "emoji-etymon", dayId: this.state.dayId, played: this.state.rows.length > 0 || this.state.status !== "in_progress", solved: this.state.status === "won" };
  }

  private persist(): void {
    saveAttempt(this.svc.storage, this.svc.keyFor(`state:${this.state.dayId}`), this.state);
    this.svc.onResult(this.currentResult());
  }

  render(): void {
    const s = this.state;
    const done = s.status !== "in_progress";
    this.root.innerHTML = "";
    this.root.className = "game emoji-etymon";
    this.root.append(homeBar(this.svc, "Emoji Etymon"));
    this.root.append(el("p", { class: "sub", text: `${s.dayId} · UTC · ${this.puzzle.answer.length} letters · ${MAX_GUESSES - s.rows.length} guesses left` }));
    this.root.append(el("p", { class: "emoji-rebus", text: this.puzzle.emoji }));
    if (s.hintUsed) this.root.append(el("p", { class: "hint-line", text: this.puzzle.hintText }));
    this.live = liveRegion();
    this.root.append(this.live);

    const form = el("form", { class: "row" }) as HTMLFormElement;
    const input = el("input", { class: "text-input" }) as HTMLInputElement;
    input.id = "guess-input";
    input.type = "text";
    input.autocomplete = "off";
    input.maxLength = this.puzzle.answer.length;
    input.setAttribute("aria-label", `Guess the ${this.puzzle.answer.length}-letter word`);
    input.disabled = done;
    const sub = el("button", { text: "Guess", class: "btn" }) as HTMLButtonElement;
    sub.type = "submit";
    sub.disabled = done;
    form.append(input, sub);
    const error = el("p", { class: "error" });
    error.setAttribute("role", "alert");
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const out = submit(this.state, this.puzzle, input.value);
      if (!out.ok) { this.render(); this.announce(out.error === "WRONG_LENGTH" ? `Needs ${this.puzzle.answer.length} letters.` : out.error === "DUPLICATE" ? "Already tried." : "Type a word."); return; }
      this.state = out.state;
      if (this.state.status === "won") { this.stats = recordWon(recordPlayed(this.stats, this.state.dayId), this.state.dayId); saveStats(this.svc.storage, this.svc.keyFor("stats"), this.stats); }
      else if (this.state.status === "lost") { this.stats = recordPlayed(this.stats, this.state.dayId); saveStats(this.svc.storage, this.svc.keyFor("stats"), this.stats); }
      this.persist();
      input.value = "";
      this.render();
      if (out.row) this.announce(out.row.map((st, i) => `${i + 1} ${LABEL[st]}`).join(", "));
      document.getElementById("guess-input")?.focus();
    });

    const controls = el("div", { class: "controls" });
    const hintBtn = el("button", { text: "Hint", class: "btn btn-secondary" }) as HTMLButtonElement;
    hintBtn.type = "button";
    hintBtn.disabled = done;
    hintBtn.addEventListener("click", () => { this.state = useHint(this.state); this.persist(); this.render(); this.announce(this.puzzle.hintText); });
    const shareBtn = el("button", { text: "Share", class: "btn btn-secondary" }) as HTMLButtonElement;
    shareBtn.type = "button";
    shareBtn.addEventListener("click", () => void this.doShare());
    controls.append(hintBtn, shareBtn);
    this.root.append(form, error, controls);

    const grid = el("div", { class: "grid" });
    grid.setAttribute("aria-label", "Guesses");
    s.rows.forEach((row) => {
      const rowEl = el("div", { class: "grid-row" });
      row.forEach((st, ci) => {
        const cell = el("span", { class: `cell state-${st}`, text: ICON[st] });
        cell.setAttribute("aria-label", `position ${ci + 1}: ${LABEL[st]}`);
        rowEl.append(cell);
      });
      grid.append(rowEl);
    });
    this.root.append(grid);

    if (s.status === "won") this.root.append(el("p", { class: "win", text: `Solved in ${s.rows.length}!` }));
    if (s.status === "lost") this.root.append(el("p", { class: "lose", text: `Out of guesses. It was ${this.puzzle.answer}.` }));
    void canGuess;
  }

  private async doShare(): Promise<void> {
    const text = buildShareText(this.state, this.puzzle, this.state.dayId);
    if (!isSpoilerSafe(text, this.puzzle.answer)) return this.announce("Sharing blocked.");
    const res = await this.svc.share.share(text);
    this.announce(res.ok ? (res.method === "clipboard" ? "Copied." : "Shared.") : "Sharing unavailable.");
  }

  private announce(msg: string): void {
    if (this.live) this.live.textContent = msg;
  }
}

export const emojiEtymonPlugin: GamePlugin = {
  meta: { id: "emoji-etymon", name: "Emoji Etymon", tagline: "Guess the word from an emoji rebus.", glyph: "🧠", accent: "#fb7185" },
  contentPackPath: "./emoji-etymon.json",
  async mount(root, services) {
    const game = new EmojiEtymon(root, services);
    await game.init("./emoji-etymon.json");
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
