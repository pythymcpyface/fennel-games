import type { GamePlugin, GameServices, GameInstance, DailyResult } from "../../kit/types.ts";
import { canonicalizeDayId, derivePuzzleId } from "../../kit/selection.ts";
import { loadStats, saveStats, recordPlayed, recordWon, type Stats } from "../../kit/stats.ts";
import { saveAttempt, loadAttempt } from "../../kit/persistence.ts";
import type { AttemptState, Puzzle } from "./types.ts";
import { initAttempt, submit, canGuess } from "./engine.ts";
import { applyHint } from "./hint.ts";
import { buildShareText, isSpoilerSafe } from "./share.ts";

interface ContentPack {
  contentPackVersion: string;
  datasetId: string;
  puzzleCount: number;
  puzzles: Puzzle[];
}

class OddSense implements GameInstance {
  private pack!: ContentPack;
  private puzzle!: Puzzle;
  private state!: AttemptState;
  private stats!: Stats;
  private live!: HTMLElement;
  private selected: number | null = null;

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
    return { gameId: "odd-sense", dayId: this.state.dayId, played: this.state.guessHistory.length > 0, solved: this.state.state === "solved" };
  }

  private persist(): void {
    saveAttempt(this.svc.storage, this.svc.keyFor(`state:${this.state.dayId}`), this.state);
    this.svc.onResult(this.currentResult());
  }

  render(): void {
    const s = this.state;
    const done = s.state !== "in_progress";
    const revealed = done ? { themeLabel: this.puzzle.themeLabel, oddCategoryLabel: this.puzzle.oddCategoryLabel, oddWordIndex: this.puzzle.oddWordIndex } : null;
    this.root.innerHTML = "";
    this.root.className = "game odd-sense";
    this.root.append(homeBar(this.svc, "Odd Sense"));
    this.root.append(
      el("p", { class: "sub", text: `${s.dayId} · UTC · ${s.remainingAttempts} guesses left` }),
      el("p", { class: "help", text: "Four of these share a hidden theme. Tap the odd one out." }),
    );
    this.live = liveRegion();
    this.root.append(this.live);

    const wrongPicks = new Set(s.guessHistory.filter((g) => g.result === "INCORRECT").map((g) => g.selectedWordIndex));
    const list = el("div", { class: "words" });
    list.setAttribute("role", "group");
    list.setAttribute("aria-label", "Word choices");
    this.puzzle.words.forEach((word, i) => {
      const eliminated = s.eliminatedWordIndex === i;
      const wrong = wrongPicks.has(i);
      const isOdd = revealed?.oddWordIndex === i;
      const btn = el("button", { class: "word", text: word }) as HTMLButtonElement;
      btn.type = "button";
      if (this.selected === i) btn.classList.add("selected");
      if (eliminated) btn.classList.add("eliminated");
      if (wrong) btn.classList.add("wrong");
      if (done && isOdd) btn.classList.add("odd");
      btn.disabled = done || eliminated;
      btn.setAttribute("aria-label", `${word}${eliminated ? ", eliminated" : ""}${wrong ? ", already guessed wrong" : ""}${done && isOdd ? ", the odd one out" : ""}`);
      btn.setAttribute("aria-pressed", String(this.selected === i));
      btn.addEventListener("click", () => {
        if (eliminated || done) return;
        this.selected = i;
        this.render();
      });
      list.append(btn);
    });
    this.root.append(list);

    const controls = el("div", { class: "controls" });
    const submitBtn = el("button", { text: "Submit", class: "btn" }) as HTMLButtonElement;
    submitBtn.type = "button";
    submitBtn.disabled = done || this.selected === null;
    submitBtn.addEventListener("click", () => {
      if (this.selected === null || !canGuess(this.state)) return;
      const out = submit(this.state, this.puzzle, this.selected);
      this.selected = null;
      if (!out) return;
      this.state = out.state;
      if (this.state.state === "solved") {
        this.stats = recordWon(recordPlayed(this.stats, this.state.dayId), this.state.dayId);
        saveStats(this.svc.storage, this.svc.keyFor("stats"), this.stats);
      } else if (this.state.state === "failed") {
        this.stats = recordPlayed(this.stats, this.state.dayId);
        saveStats(this.svc.storage, this.svc.keyFor("stats"), this.stats);
      }
      this.persist();
      this.render();
      this.announce(out.result === "CORRECT" ? "Correct! You found the odd one out." : `Not it. ${this.state.remainingAttempts} guesses left.`);
    });
    const hintBtn = el("button", { text: "Hint", class: "btn btn-secondary" }) as HTMLButtonElement;
    hintBtn.type = "button";
    hintBtn.disabled = done || s.hintUsed;
    hintBtn.addEventListener("click", () => {
      const next = applyHint(this.state, this.puzzle);
      if (next) {
        this.state = next;
        this.persist();
      }
      this.render();
      this.announce(next ? "One word has been eliminated for you." : "No hint available.");
    });
    const shareBtn = el("button", { text: "Share", class: "btn btn-secondary" }) as HTMLButtonElement;
    shareBtn.type = "button";
    shareBtn.addEventListener("click", () => void this.doShare());
    controls.append(submitBtn, hintBtn, shareBtn);
    this.root.append(controls);

    if (revealed) {
      const reveal = el("div", { class: "reveal" });
      reveal.append(
        el("p", { class: s.state === "solved" ? "win" : "lose", text: s.state === "solved" ? "Solved!" : "Out of guesses." }),
        el("p", { text: `Theme: ${revealed.themeLabel}` }),
        el("p", { text: `Odd one out: ${this.puzzle.words[revealed.oddWordIndex]} (${revealed.oddCategoryLabel})` }),
      );
      this.root.append(reveal);
    }
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

export const oddSensePlugin: GamePlugin = {
  meta: { id: "odd-sense", name: "Odd Sense", tagline: "Four share a theme. Spot the impostor.", glyph: "🎭", accent: "#22c55e" },
  contentPackPath: "./odd-sense.json",
  async mount(root, services) {
    const game = new OddSense(root, services);
    await game.init("./odd-sense.json");
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
