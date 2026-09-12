import type { GamePlugin, GameServices, GameInstance, DailyResult } from "../../kit/types.ts";
import { canonicalizeDayId, derivePuzzleId } from "../../kit/selection.ts";
import { loadStats, saveStats, recordPlayed, recordWon, type Stats } from "../../kit/stats.ts";
import { saveAttempt, loadAttempt } from "../../kit/persistence.ts";
import type { AttemptState, Puzzle } from "./types.ts";
import { initAttempt, toggleBreak, submit, canSubmit } from "./engine.ts";
import { applyHint } from "./hint.ts";
import { buildShareText, isSpoilerSafe } from "./share.ts";

interface ContentPack {
  contentPackVersion: string;
  datasetId: string;
  puzzleCount: number;
  dictionary: string[];
  puzzles: Puzzle[];
}

class Sever implements GameInstance {
  private pack!: ContentPack;
  private dictionary!: Set<string>;
  private puzzle!: Puzzle;
  private state!: AttemptState;
  private stats!: Stats;
  private live!: HTMLElement;

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
  }

  currentResult(): DailyResult {
    return { gameId: "sever", dayId: this.state.dayId, played: this.state.attemptsUsed > 0 || this.state.isSolved, solved: this.state.isSolved };
  }

  private persist(): void {
    saveAttempt(this.svc.storage, this.svc.keyFor(`state:${this.state.dayId}`), this.state);
    this.svc.onResult(this.currentResult());
  }

  render(): void {
    const s = this.state;
    const done = s.isSolved || s.isFailed;
    this.root.innerHTML = "";
    this.root.className = "game sever";
    this.root.append(homeBar(this.svc, "Sever"));
    this.root.append(
      el("p", { class: "sub", text: `${s.dayId} · UTC · ${6 - s.attemptsUsed} attempts left` }),
      el("p", { class: "help", text: "Tap the gaps to split the run-together phrase into real words." }),
    );
    this.live = liveRegion();
    this.root.append(this.live);

    const strip = el("div", { class: "strip" });
    strip.setAttribute("role", "group");
    strip.setAttribute("aria-label", "Puzzle letters and gaps");
    const letters = this.puzzle.puzzleString.split("");
    letters.forEach((ch, i) => {
      strip.append(el("span", { class: "letter", text: ch }));
      if (i < letters.length - 1) {
        const gapIndex = i;
        const on = s.breaks[gapIndex];
        const locked = s.revealedBreaks.includes(gapIndex);
        const gap = el("button", { class: `gap${on ? " on" : ""}${locked ? " locked" : ""}` }) as HTMLButtonElement;
        gap.type = "button";
        gap.textContent = on ? "|" : "·";
        gap.setAttribute("aria-label", `Gap after letter ${i + 1}: ${on ? "break" : "no break"}${locked ? ", locked correct" : ""}`);
        gap.setAttribute("aria-pressed", String(on));
        gap.disabled = done || locked;
        gap.addEventListener("click", () => {
          this.state = toggleBreak(this.state, gapIndex);
          this.persist();
          this.render();
        });
        strip.append(gap);
      }
    });
    this.root.append(strip);

    let preview = "";
    for (let i = 0; i < this.puzzle.puzzleString.length; i++) {
      preview += this.puzzle.puzzleString[i];
      if (i < s.breaks.length && s.breaks[i]) preview += " ";
    }
    this.root.append(el("p", { class: "preview", text: preview }));

    const controls = el("div", { class: "controls" });
    const submitBtn = el("button", { text: "Submit", class: "btn" }) as HTMLButtonElement;
    submitBtn.type = "button";
    submitBtn.disabled = done;
    submitBtn.addEventListener("click", () => {
      if (!canSubmit(this.state)) return;
      const out = submit(this.state, this.puzzle, this.dictionary);
      this.state = out.state;
      if (this.state.isSolved) {
        this.stats = recordWon(recordPlayed(this.stats, this.state.dayId), this.state.dayId);
        saveStats(this.svc.storage, this.svc.keyFor("stats"), this.stats);
      } else if (this.state.isFailed) {
        this.stats = recordPlayed(this.stats, this.state.dayId);
        saveStats(this.svc.storage, this.svc.keyFor("stats"), this.stats);
      }
      this.persist();
      this.render();
      if (out.solved) this.announce("Solved! Well done.");
      else if (out.feedback) this.announce(`${out.feedback.correctBreakCount} correct breaks; ${out.feedback.allTokensAreDictionaryWords ? "all tokens are words" : "some tokens are not words"}.`);
    });
    const hintBtn = el("button", { text: "Hint", class: "btn btn-secondary" }) as HTMLButtonElement;
    hintBtn.type = "button";
    hintBtn.disabled = done;
    hintBtn.addEventListener("click", () => {
      const h = applyHint(this.state, this.puzzle);
      if (h) {
        this.state = h.state;
        this.persist();
      }
      this.render();
      this.announce(h ? `Hint: there is a break after letter ${h.gapIndex + 1}.` : "No hint available.");
    });
    const shareBtn = el("button", { text: "Share", class: "btn btn-secondary" }) as HTMLButtonElement;
    shareBtn.type = "button";
    shareBtn.addEventListener("click", () => void this.doShare());
    controls.append(submitBtn, hintBtn, shareBtn);
    this.root.append(controls);
    if (s.isSolved) this.root.append(el("p", { class: "win", text: `Solved in ${s.attemptsUsed + 1}!` }));
    if (s.isFailed) this.root.append(el("p", { class: "lose", text: "Out of attempts." }));
  }

  private async doShare(): Promise<void> {
    const text = buildShareText(this.state, this.state.dayId);
    if (!isSpoilerSafe(text, this.puzzle.puzzleString)) return this.announce("Sharing blocked.");
    const res = await this.svc.share.share(text);
    this.announce(res.ok ? (res.method === "clipboard" ? "Copied." : "Shared.") : "Sharing unavailable.");
  }

  private announce(msg: string): void {
    if (this.live) this.live.textContent = msg;
  }
}

export const severPlugin: GamePlugin = {
  meta: { id: "sever", name: "Sever", tagline: "Split the run-together string into words.", glyph: "✂️", accent: "#f59e0b" },
  contentPackPath: "./sever.json",
  async mount(root, services) {
    const game = new Sever(root, services);
    await game.init("./sever.json");
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
