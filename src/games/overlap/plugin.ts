import type { GamePlugin, GameServices, GameInstance, DailyResult } from "../../kit/types.ts";
import { canonicalizeDayId, derivePuzzleId } from "../../kit/selection.ts";
import { loadStats, saveStats, recordPlayed, recordWon, type Stats } from "../../kit/stats.ts";
import { saveAttempt, loadAttempt } from "../../kit/persistence.ts";
import type { AttemptState, Puzzle, RevealState } from "./types.ts";
import { initAttempt, applyGuess, canGuess } from "./engine.ts";
import { normalizeGuess, validateGuess } from "./reveal.ts";
import { buildShareText, isSpoilerSafe } from "./share.ts";

interface ContentPack {
  contentPackVersion: string;
  datasetId: string;
  puzzleCount: number;
  puzzles: Puzzle[];
}

const STATE_ICON: Record<RevealState, string> = { EXACT: "■", PRESENT: "◪", ABSENT: "□" };
const STATE_LABEL: Record<RevealState, string> = { EXACT: "correct", PRESENT: "present", ABSENT: "absent" };

class Overlap implements GameInstance {
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
    this.state = saved ?? initAttempt(this.puzzle.puzzleId, dayId);
  }

  currentResult(): DailyResult {
    return { gameId: "overlap", dayId: this.state.dayId, played: this.state.guesses.length > 0, solved: this.state.isSolved };
  }

  private persist(): void {
    saveAttempt(this.svc.storage, this.svc.keyFor(`state:${this.state.dayId}`), this.state);
    this.svc.onResult(this.currentResult());
  }

  render(): void {
    const s = this.state;
    const done = s.isSolved || s.isFailed;
    this.root.innerHTML = "";
    this.root.className = "game overlap";
    this.root.append(homeBar(this.svc, "Overlap"));
    this.root.append(el("p", { class: "sub", text: `${s.dayId} · UTC · ${this.puzzle.bridgeLength} letters` }));
    const anchors = el("p", { class: "anchors" });
    anchors.append(el("strong", { text: this.puzzle.anchorA }), el("span", { text: "  +  ?  +  " }), el("strong", { text: this.puzzle.anchorB }));
    this.root.append(anchors, el("p", { class: "help", text: `Find the ${this.puzzle.bridgeLength}-letter word that pairs with both.` }));

    this.live = liveRegion();
    this.root.append(this.live);

    const form = el("form", { class: "row" }) as HTMLFormElement;
    const input = el("input", { class: "text-input" }) as HTMLInputElement;
    input.id = "guess-input";
    input.type = "text";
    input.autocomplete = "off";
    input.setAttribute("aria-label", "Your guess");
    input.disabled = done;
    const submit = el("button", { text: "Guess", class: "btn" }) as HTMLButtonElement;
    submit.type = "submit";
    submit.disabled = done;
    form.append(input, submit);
    const error = el("p", { class: "error" });
    error.setAttribute("role", "alert");
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const guess = normalizeGuess(input.value);
      const validity = validateGuess(guess, this.puzzle.bridgeLength);
      if (validity !== "VALID") {
        error.textContent = validity === "INVALID_LENGTH" ? `Must be ${this.puzzle.bridgeLength} letters.` : "Letters only.";
        this.announce(error.textContent);
        return;
      }
      if (!canGuess(this.state)) return;
      const res = applyGuess(this.state, guess, this.puzzle);
      this.state = res.state;
      if (this.state.isSolved) {
        this.stats = recordWon(recordPlayed(this.stats, this.state.dayId), this.state.dayId);
        saveStats(this.svc.storage, this.svc.keyFor("stats"), this.stats);
      } else if (this.state.isFailed) {
        this.stats = recordPlayed(this.stats, this.state.dayId);
        saveStats(this.svc.storage, this.svc.keyFor("stats"), this.stats);
      }
      this.persist();
      this.render();
      this.announce(res.won ? "Solved!" : res.row.map((st, i) => `${i + 1} ${STATE_LABEL[st]}`).join(", "));
      document.getElementById("guess-input")?.focus();
    });

    const controls = el("div", { class: "controls" });
    const shareBtn = el("button", { text: "Share", class: "btn btn-secondary" }) as HTMLButtonElement;
    shareBtn.type = "button";
    shareBtn.addEventListener("click", () => void this.doShare());
    controls.append(shareBtn);
    this.root.append(form, error, controls, this.renderGrid());
    if (s.isSolved) this.root.append(el("p", { class: "win", text: `Solved in ${s.guesses.length}!` }));
    if (s.isFailed) this.root.append(el("p", { class: "lose", text: "Out of guesses." }));
  }

  private renderGrid(): HTMLElement {
    const grid = el("div", { class: "grid" });
    grid.setAttribute("aria-label", "Guesses");
    this.state.revealGrid.forEach((row) => {
      const rowEl = el("div", { class: "grid-row" });
      row.forEach((st, ci) => {
        const cell = el("span", { class: `cell state-${st}`, text: STATE_ICON[st] });
        cell.setAttribute("aria-label", `position ${ci + 1}: ${STATE_LABEL[st]}`);
        rowEl.append(cell);
      });
      grid.append(rowEl);
    });
    return grid;
  }

  private async doShare(): Promise<void> {
    const text = buildShareText(this.state, this.state.dayId);
    if (!isSpoilerSafe(text, this.puzzle.bridgeWord)) return this.announce("Sharing blocked.");
    const res = await this.svc.share.share(text);
    this.announce(res.ok ? (res.method === "clipboard" ? "Copied." : "Shared.") : "Sharing unavailable.");
  }

  private announce(msg: string): void {
    if (this.live) this.live.textContent = msg;
  }
}

export const overlapPlugin: GamePlugin = {
  meta: { id: "overlap", name: "Overlap", tagline: "Find the word that bridges two clues.", glyph: "🔗", accent: "#a78bfa" },
  contentPackPath: "./overlap.json",
  async mount(root, services) {
    const game = new Overlap(root, services);
    await game.init("./overlap.json");
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
