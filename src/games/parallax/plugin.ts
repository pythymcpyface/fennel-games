import type { GamePlugin, GameServices, GameInstance, DailyResult } from "../../kit/types.ts";
import { canonicalizeDayId, derivePuzzleId } from "../../kit/selection.ts";
import { loadStats, saveStats, recordPlayed, recordWon, type Stats } from "../../kit/stats.ts";
import { saveAttempt, loadAttempt } from "../../kit/persistence.ts";
import type { AttemptState, BalanceClass, Puzzle, PackedPuzzle } from "./types.ts";
import { GUESS_BUDGET, CLOSENESS_MAX } from "./types.ts";
import { initAttempt, submit, canSubmit, isWellFormed } from "./engine.ts";
import { unpackCodes } from "./content-build.ts";
import { buildShareText, isSpoilerSafe } from "./share.ts";
import { carbonButton } from "../../kit/carbon.ts";

interface ContentPack {
  contentPackVersion: string;
  datasetId: string;
  puzzleCount: number;
  vocab: string[];
  puzzles: PackedPuzzle[];
}

function balanceLabel(b: BalanceClass, a: string, bb: string): string {
  if (b === "A") return `↤ toward ${a}`;
  if (b === "B") return `toward ${bb} ↦`;
  return "⇄ balanced";
}

class Parallax implements GameInstance {
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
    const packed = this.pack.puzzles[Number(puzzleId.slice(4))];
    this.puzzle = {
      puzzleId: packed.puzzleId,
      anchorA: packed.anchorA,
      anchorB: packed.anchorB,
      target: packed.target,
      table: unpackCodes(packed.codes, this.pack.vocab),
    };
    const saved = loadAttempt<AttemptState>(this.svc.storage, this.svc.keyFor(`state:${dayId}`), (raw) => raw as AttemptState);
    this.state = saved ?? initAttempt(this.puzzle, dayId);
  }

  currentResult(): DailyResult {
    return {
      gameId: "parallax",
      dayId: this.state.dayId,
      played: this.state.rows.length > 0 || this.state.isSolved,
      solved: this.state.isSolved,
    };
  }

  private persist(): void {
    saveAttempt(this.svc.storage, this.svc.keyFor(`state:${this.state.dayId}`), this.state);
    this.svc.onResult(this.currentResult());
  }

  render(): void {
    const s = this.state;
    const done = s.isSolved || s.isFailed;
    this.root.innerHTML = "";
    this.root.className = "game parallax";
    this.root.append(homeBar(this.svc, "Parallax"));
    this.root.append(
      el("p", { class: "sub", text: `${s.dayId} · UTC · ${GUESS_BUDGET - s.rows.length} guesses left` }),
      el("p", { class: "help", text: "Find the word whose meaning sits midway between the two anchors." }),
    );

    const anchors = el("div", { class: "plx-anchors" });
    anchors.setAttribute("role", "group");
    anchors.setAttribute("aria-label", "Anchor words");
    anchors.append(
      el("span", { class: "plx-anchor plx-a", text: this.puzzle.anchorA }),
      el("span", { class: "plx-mid", text: "⇄" }),
      el("span", { class: "plx-anchor plx-b", text: this.puzzle.anchorB }),
    );
    this.root.append(anchors);

    this.live = liveRegion();
    this.root.append(this.live);

    const board = el("div", { class: "plx-board" });
    board.setAttribute("role", "list");
    board.setAttribute("aria-label", "Your guesses");
    for (const r of s.rows) {
      const row = el("div", { class: `plx-row bal-${r.balance.toLowerCase()}` });
      row.setAttribute("role", "listitem");
      const word = el("span", { class: "plx-word", text: r.guess });
      const bal = el("span", { class: "plx-bal", text: balanceLabel(r.balance, this.puzzle.anchorA, this.puzzle.anchorB) });
      const close = el("span", { class: "plx-close", text: `${r.closeness}/${CLOSENESS_MAX}` });
      close.setAttribute("aria-label", `closeness ${r.closeness} of ${CLOSENESS_MAX}`);
      row.append(word, bal, close);
      board.append(row);
    }
    this.root.append(board);

    if (!done) this.root.append(this.buildInput());

    const controls = el("div", { class: "controls" });
    const shareBtn = carbonButton({ text: "Share", kind: "secondary", onClick: () => void this.doShare() });
    controls.append(shareBtn);
    this.root.append(controls);

    if (s.isSolved) this.root.append(el("p", { class: "win", text: `Found the midpoint in ${s.rows.length}!` }));
    if (s.isFailed) this.root.append(el("p", { class: "lose", text: "Out of guesses." }));
  }

  private buildInput(): HTMLElement {
    const wrap = el("div", { class: "plx-input" });
    const input = el("input", { class: "plx-field" }) as HTMLInputElement;
    input.type = "text";
    input.value = this.draft;
    input.setAttribute("aria-label", "Enter a word guess");
    input.autocomplete = "off";
    input.addEventListener("input", () => {
      this.draft = input.value.replace(/[^A-Za-z'\-]/g, "").toUpperCase();
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
      this.announce("Enter a valid word.");
      return;
    }
    const out = submit(this.state, this.puzzle, this.draft);
    if (!out.accepted) {
      if (out.reason === "vocab") this.announce("Word not in list.");
      else if (out.reason === "duplicate") this.announce("Already guessed.");
      else this.announce("Enter a valid word.");
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
    if (out.solved) this.announce("Solved! You found the midpoint.");
    else if (out.row) this.announce(`${balanceLabel(out.row.balance, this.puzzle.anchorA, this.puzzle.anchorB)}, closeness ${out.row.closeness} of ${CLOSENESS_MAX}.`);
  }

  private async doShare(): Promise<void> {
    const text = buildShareText(this.state, this.state.dayId);
    const guesses = this.state.rows.map((r) => r.guess);
    if (!isSpoilerSafe(text, [this.puzzle.anchorA, this.puzzle.anchorB, this.puzzle.target], guesses)) {
      return this.announce("Sharing blocked.");
    }
    const res = await this.svc.share.share(text);
    this.announce(res.ok ? (res.method === "clipboard" ? "Copied." : "Shared.") : "Sharing unavailable.");
  }

  private announce(msg: string): void {
    if (this.live) this.live.textContent = msg;
  }
}

export const parallaxPlugin: GamePlugin = {
  meta: {
    id: "parallax",
    name: "Parallax",
    tagline: "Find the word midway between two anchors.",
    glyph: "🌗",
    accent: "#08bdba",
  },
  contentPackPath: "./parallax.json",
  async mount(root, services) {
    const game = new Parallax(root, services);
    await game.init("./parallax.json");
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
