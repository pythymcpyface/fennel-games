import type { GamePlugin, GameServices, GameInstance, DailyResult } from "../../kit/types.ts";
import { canonicalizeDayId, derivePuzzleId } from "../../kit/selection.ts";
import { loadStats, saveStats, recordPlayed, recordWon, type Stats } from "../../kit/stats.ts";
import { saveAttempt, loadAttempt } from "../../kit/persistence.ts";
import type { AttemptState, Puzzle, RhymeDict } from "./types.ts";
import { ATTEMPT_LIMIT } from "./types.ts";
import { initAttempt, submit, canSubmit, previousWord, currentSlotIndex } from "./engine.ts";
import { applyHint } from "./hint.ts";
import { buildShareText, isSpoilerSafe } from "./share.ts";

interface ContentPack {
  contentPackVersion: string;
  datasetId: string;
  puzzleCount: number;
  rhymeDict: RhymeDict;
  puzzles: Puzzle[];
}

class RhymeChain implements GameInstance {
  private pack!: ContentPack;
  private dict!: RhymeDict;
  private puzzle!: Puzzle;
  private state!: AttemptState;
  private stats!: Stats;
  private live!: HTMLElement;
  private hintLetter: string | null = null;

  constructor(private readonly root: HTMLElement, private readonly svc: GameServices) {}

  async init(packPath: string): Promise<void> {
    this.pack = JSON.parse(await this.svc.assets.loadText(packPath)) as ContentPack;
    this.dict = this.pack.rhymeDict;
    this.stats = loadStats(this.svc.storage, this.svc.keyFor("stats"));
    const dayId = canonicalizeDayId(this.svc.clock.nowMs(), "UTC");
    const puzzleId = derivePuzzleId(dayId, this.pack.contentPackVersion, this.pack.datasetId, this.pack.puzzleCount);
    this.puzzle = this.pack.puzzles[Number(puzzleId.slice(4))];
    const saved = loadAttempt<AttemptState>(this.svc.storage, this.svc.keyFor(`state:${dayId}`), (raw) => raw as AttemptState);
    this.state = saved ?? initAttempt(this.puzzle, dayId);
  }

  currentResult(): DailyResult {
    return {
      gameId: "rhyme-chain",
      dayId: this.state.dayId,
      played: this.state.chainWords.length > 0 || this.state.outcome !== "in_progress",
      solved: this.state.outcome === "won",
    };
  }

  private persist(): void {
    saveAttempt(this.svc.storage, this.svc.keyFor(`state:${this.state.dayId}`), this.state);
    this.svc.onResult(this.currentResult());
  }

  render(): void {
    const s = this.state;
    const done = s.outcome !== "in_progress";
    const slot = currentSlotIndex(s);
    this.root.innerHTML = "";
    this.root.className = "game rhyme-chain";
    this.root.append(homeBar(this.svc, "Rhyme Chain"));
    this.root.append(el("p", { class: "sub", text: `${s.dayId} · UTC · chain ${s.chainWords.length}/${this.puzzle.slots.length}` }));

    // Chain so far: seed + accepted words.
    const chain = el("p", { class: "chain" });
    chain.append(el("span", { class: "seed", text: this.puzzle.seedWord }));
    s.chainWords.forEach((w) => {
      chain.append(el("span", { class: "arrow", text: " → " }), el("strong", { text: w }));
    });
    this.root.append(chain);

    this.live = liveRegion();
    this.root.append(this.live);

    if (!done) {
      const prev = previousWord(s, this.puzzle);
      this.root.append(el("p", { class: "help", text: `Rhymes with "${prev}": ${this.puzzle.slots[slot].clue}` }));
      if (this.hintLetter) this.root.append(el("p", { class: "hint-line", text: `Starts with: ${this.hintLetter.toUpperCase()}` }));

      const form = el("form", { class: "row" }) as HTMLFormElement;
      const input = el("input", { class: "text-input" }) as HTMLInputElement;
      input.id = "guess-input";
      input.type = "text";
      input.autocomplete = "off";
      input.setAttribute("aria-label", `Answer for: ${this.puzzle.slots[slot].clue}`);
      const sub = el("button", { text: "Enter", class: "btn" }) as HTMLButtonElement;
      sub.type = "submit";
      form.append(input, sub);
      const error = el("p", { class: "error" });
      error.setAttribute("role", "alert");
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        if (!canSubmit(this.state)) return;
        const out = submit(this.state, this.puzzle, input.value, this.dict);
        this.state = out.state;
        if (out.accepted) this.hintLetter = null;
        if (this.state.outcome === "won") {
          this.stats = recordWon(recordPlayed(this.stats, this.state.dayId), this.state.dayId);
          saveStats(this.svc.storage, this.svc.keyFor("stats"), this.stats);
        } else if (this.state.outcome === "lost") {
          this.stats = recordPlayed(this.stats, this.state.dayId);
          saveStats(this.svc.storage, this.svc.keyFor("stats"), this.stats);
        }
        this.persist();
        this.render();
        if (out.accepted) this.announce("Correct! Next link.");
        else if (out.feedback) this.announce(`${out.feedback.rhyme === "RHYMES" ? "Rhymes, but not the answer" : out.feedback.rhyme === "DOES_NOT_RHYME" ? "Does not rhyme" : "Not a known word"}. ${ATTEMPT_LIMIT - this.state.attemptsUsedForSlot} tries left.`);
        document.getElementById("guess-input")?.focus();
      });
      const controls = el("div", { class: "controls" });
      const hintBtn = el("button", { text: "Hint", class: "btn btn-secondary" }) as HTMLButtonElement;
      hintBtn.type = "button";
      hintBtn.disabled = s.hintUsedForSlot;
      hintBtn.addEventListener("click", () => {
        const h = applyHint(this.state, this.puzzle);
        if (h) {
          this.state = h.state;
          this.hintLetter = h.letter;
          this.persist();
        }
        this.render();
        this.announce(h ? `First letter: ${h.letter.toUpperCase()}` : "No hint available.");
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
      this.root.append(
        s.outcome === "won"
          ? el("p", { class: "win", text: `Full chain! ${s.chainWords.length}/${this.puzzle.slots.length}` })
          : el("p", { class: "lose", text: `Chain broke at ${s.chainWords.length}/${this.puzzle.slots.length}.` }),
      );
    }
  }

  private async doShare(): Promise<void> {
    const text = buildShareText(this.state, this.puzzle, this.state.dayId);
    if (!isSpoilerSafe(text, this.puzzle)) return this.announce("Sharing blocked.");
    const res = await this.svc.share.share(text);
    this.announce(res.ok ? (res.method === "clipboard" ? "Copied." : "Shared.") : "Sharing unavailable.");
  }

  private announce(msg: string): void {
    if (this.live) this.live.textContent = msg;
  }
}

export const rhymeChainPlugin: GamePlugin = {
  meta: { id: "rhyme-chain", name: "Rhyme Chain", tagline: "Build the longest chain of rhyming clues.", glyph: "🎵", accent: "#ec4899" },
  contentPackPath: "./rhyme-chain.json",
  async mount(root, services) {
    const game = new RhymeChain(root, services);
    await game.init("./rhyme-chain.json");
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
