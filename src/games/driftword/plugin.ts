import type { GamePlugin, GameServices, GameInstance, DailyResult } from "../../kit/types.ts";
import { canonicalizeDayId, derivePuzzleId } from "../../kit/selection.ts";
import { loadStats, saveStats, recordPlayed, recordWon, type Stats } from "../../kit/stats.ts";
import { saveAttempt, loadAttempt } from "../../kit/persistence.ts";
import type { AttemptState, Mark, Puzzle } from "./types.ts";
import { GUESS_BUDGET, WORD_LEN } from "./types.ts";
import { initAttempt, submit, canSubmit, isWellFormed } from "./engine.ts";
import { buildShareText, isSpoilerSafe } from "./share.ts";
import { carbonButton } from "../../kit/carbon.ts";

interface ContentPack {
  contentPackVersion: string;
  datasetId: string;
  puzzleCount: number;
  dictionary: string[];
  puzzles: Puzzle[];
}

const MARK_GLYPH: Record<Mark, string> = { G: "🟩", Y: "🟨", X: "⬛" };
const MARK_LABEL: Record<Mark, string> = { G: "correct", Y: "present", X: "absent" };

class Driftword implements GameInstance {
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
    return { gameId: "driftword", dayId: this.state.dayId, played: this.state.rows.length > 0 || this.state.isSolved, solved: this.state.isSolved };
  }

  private persist(): void {
    saveAttempt(this.svc.storage, this.svc.keyFor(`state:${this.state.dayId}`), this.state);
    this.svc.onResult(this.currentResult());
  }

  render(): void {
    const s = this.state;
    const done = s.isSolved || s.isFailed;
    this.root.innerHTML = "";
    this.root.className = "game driftword";
    this.root.append(homeBar(this.svc, "Driftword"));
    this.root.append(
      el("p", { class: "sub", text: `${s.dayId} · UTC · ${GUESS_BUDGET - s.rows.length} guesses left` }),
      el("p", { class: "help", text: "Like Wordle — but after each guess the secret word DRIFTS by one letter along a hidden ladder. Account for the drift to catch it." }),
    );
    this.live = liveRegion();
    this.root.append(this.live);

    const board = el("div", { class: "dw-board" });
    board.setAttribute("role", "list");
    board.setAttribute("aria-label", "Your guesses and feedback");
    for (const r of s.rows) {
      const row = el("div", { class: "dw-row" });
      row.setAttribute("role", "listitem");
      r.guess.split("").forEach((ch, i) => {
        const m = r.marks[i];
        const cell = el("span", { class: `dw-cell dw-${m}`, text: ch });
        cell.setAttribute("aria-label", `${ch} ${MARK_LABEL[m]}`);
        row.append(cell);
      });
      board.append(row);
    }
    this.root.append(board);

    if (!done) this.root.append(this.buildInput());

    const controls = el("div", { class: "controls" });
    const shareBtn = carbonButton({ text: "Share", kind: "secondary", onClick: () => void this.doShare() });
    controls.append(shareBtn);
    this.root.append(controls);

    if (s.isSolved) this.root.append(el("p", { class: "win", text: `Caught the drift in ${s.rows.length}!` }));
    if (s.isFailed) this.root.append(el("p", { class: "lose", text: "The word drifted away." }));
  }

  private buildInput(): HTMLElement {
    const wrap = el("div", { class: "dw-input" });
    const input = el("input", { class: "dw-field" }) as HTMLInputElement;
    input.type = "text";
    input.maxLength = WORD_LEN;
    input.value = this.draft;
    input.setAttribute("aria-label", "Enter a 5-letter guess");
    input.autocapitalize = "characters";
    input.autocomplete = "off";
    input.addEventListener("input", () => {
      this.draft = input.value.replace(/[^A-Za-z]/g, "").toUpperCase().slice(0, WORD_LEN);
      input.value = this.draft;
    });
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") this.trySubmit();
    });
    const go = carbonButton({ text: "Guess", onClick: () => this.trySubmit() });
    wrap.append(input, go);
    queueMicrotask(() => input.focus());
    return wrap;
  }

  private trySubmit(): void {
    if (!canSubmit(this.state)) return;
    if (!isWellFormed(this.draft)) {
      this.announce("Guesses must be exactly 5 letters.");
      return;
    }
    const out = submit(this.state, this.puzzle, this.dictionary, this.draft);
    if (!out.accepted) {
      this.announce(out.reason === "dictionary" ? "Not in word list." : "Guesses must be exactly 5 letters.");
      return;
    }
    this.state = out.state;
    this.draft = "";
    if (this.state.isSolved) {
      this.stats = recordWon(recordPlayed(this.stats, this.state.dayId), this.state.dayId);
      saveStats(this.svc.storage, this.svc.keyFor("stats"), this.stats);
    } else if (this.state.isFailed || this.state.rows.length === 1) {
      this.stats = recordPlayed(this.stats, this.state.dayId);
      saveStats(this.svc.storage, this.svc.keyFor("stats"), this.stats);
    }
    this.persist();
    this.render();
    if (out.solved) this.announce("Caught it — solved!");
    else if (out.row) this.announce(`Feedback: ${out.row.marks.map((m) => MARK_GLYPH[m]).join("")}. The word has now drifted.`);
  }

  private async doShare(): Promise<void> {
    const text = buildShareText(this.state, this.state.dayId);
    const words = [...this.state.rows.map((r) => r.guess), ...this.puzzle.path];
    if (!isSpoilerSafe(text, words)) return this.announce("Sharing blocked.");
    const res = await this.svc.share.share(text);
    this.announce(res.ok ? (res.method === "clipboard" ? "Copied." : "Shared.") : "Sharing unavailable.");
  }

  private announce(msg: string): void {
    if (this.live) this.live.textContent = msg;
  }
}

export const driftwordPlugin: GamePlugin = {
  meta: { id: "driftword", name: "Driftword", tagline: "Wordle, but the answer drifts each guess.", glyph: "🌫️", accent: "#4589ff" },
  contentPackPath: "./driftword.json",
  async mount(root, services) {
    const game = new Driftword(root, services);
    await game.init("./driftword.json");
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
