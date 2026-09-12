import type { GamePlugin, GameServices, GameInstance, DailyResult } from "../../kit/types.ts";
import { canonicalizeDayId, derivePuzzleId } from "../../kit/selection.ts";
import { loadStats, saveStats, recordPlayed, recordWon, type Stats } from "../../kit/stats.ts";
import { saveAttempt, loadAttempt } from "../../kit/persistence.ts";
import type { AttemptState, Puzzle } from "./types.ts";
import { ATTEMPTS_TOTAL, WORDS_COUNT } from "./types.ts";
import { initAttempt, submit, applyHint, attemptsRemaining, canSubmit } from "./engine.ts";
import { buildShareText, isSpoilerSafe } from "./share.ts";

interface ContentPack {
  contentPackVersion: string;
  datasetId: string;
  puzzleCount: number;
  dictionary: string[];
  puzzles: Puzzle[];
}

class VowelGhost implements GameInstance {
  private pack!: ContentPack;
  private dictionary!: Set<string>;
  private puzzle!: Puzzle;
  private state!: AttemptState;
  private stats!: Stats;
  private live!: HTMLElement;
  private selected = 0;
  private hints: (number | null)[] = new Array(WORDS_COUNT).fill(null);

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
    this.selected = this.state.solved.findIndex((s) => !s);
    if (this.selected < 0) this.selected = 0;
  }

  currentResult(): DailyResult {
    return { gameId: "vowel-ghost", dayId: this.state.dayId, played: this.state.attemptsUsed > 0 || this.state.status !== "in_progress" || this.state.solved.some(Boolean), solved: this.state.status === "won" };
  }

  private persist(): void {
    saveAttempt(this.svc.storage, this.svc.keyFor(`state:${this.state.dayId}`), this.state);
    this.svc.onResult(this.currentResult());
  }

  render(): void {
    const s = this.state;
    const done = s.status !== "in_progress";
    this.root.innerHTML = "";
    this.root.className = "game vowel-ghost";
    this.root.append(homeBar(this.svc, "Vowel Ghost"));
    this.root.append(el("p", { class: "sub", text: `${s.dayId} · UTC · ${attemptsRemaining(s)}/${ATTEMPTS_TOTAL} attempts` }));
    this.root.append(el("p", { class: "help", text: "Restore the vowels. Tap a skeleton, then type the word." }));

    this.live = liveRegion();
    this.root.append(this.live);

    const list = el("div", { class: "vg-list" });
    list.setAttribute("role", "group");
    list.setAttribute("aria-label", "Skeletons");
    this.puzzle.skeletons.forEach((sk, i) => {
      const item = el("button", { class: `vg-skel${this.selected === i ? " selected" : ""}${s.solved[i] ? " solved" : ""}` }) as HTMLButtonElement;
      item.type = "button";
      item.disabled = done || s.solved[i];
      const shown = s.solved[i] ? this.puzzle.words[i] : sk;
      const hintTxt = !s.solved[i] && this.hints[i] ? ` (vowel at ${this.hints[i]})` : "";
      item.textContent = shown + hintTxt;
      item.setAttribute("aria-label", `${s.solved[i] ? "solved: " + this.puzzle.words[i] : "skeleton " + sk}${hintTxt}`);
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
      input.setAttribute("aria-label", `Fill in skeleton ${this.puzzle.skeletons[this.selected]}`);
      const submitBtn = el("button", { text: "Enter", class: "btn" }) as HTMLButtonElement;
      submitBtn.type = "submit";
      form.append(input, submitBtn);
      const error = el("p", { class: "error" });
      error.setAttribute("role", "alert");
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        if (!canSubmit(this.state)) return;
        const out = submit(this.state, this.puzzle, this.selected, input.value, this.dictionary);
        this.state = out.state;
        if (this.state.status === "won") {
          this.stats = recordWon(recordPlayed(this.stats, this.state.dayId), this.state.dayId);
          saveStats(this.svc.storage, this.svc.keyFor("stats"), this.stats);
        } else if (this.state.status === "lost") {
          this.stats = recordPlayed(this.stats, this.state.dayId);
          saveStats(this.svc.storage, this.svc.keyFor("stats"), this.stats);
        }
        if (out.correct) {
          const nextUnsolved = this.state.solved.findIndex((v) => !v);
          if (nextUnsolved >= 0) this.selected = nextUnsolved;
        }
        this.persist();
        input.value = "";
        this.render();
        if (out.correct) this.announce("Correct!");
        else if (out.empty) this.announce("Type a word.");
        else if (out.alreadySolved) this.announce("Already solved.");
        else if (out.feedback) this.announce(`${out.feedback.isDictionaryWord ? "Real word" : "Not a word"}; ${out.feedback.isSkeletonMatch ? "matches the skeleton" : "wrong consonants"}. ${attemptsRemaining(this.state)} left.`);
        document.getElementById("guess-input")?.focus();
      });
      const controls = el("div", { class: "controls" });
      const hintBtn = el("button", { text: "Hint", class: "btn btn-secondary" }) as HTMLButtonElement;
      hintBtn.type = "button";
      hintBtn.addEventListener("click", () => {
        const h = applyHint(this.state, this.puzzle, this.selected);
        if (h) { this.state = h.state; this.hints[this.selected] = h.position; this.persist(); }
        this.render();
        this.announce(h ? (h.position ? `First vowel at position ${h.position}.` : "No vowels in this word.") : "No hint available.");
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
    if (!isSpoilerSafe(text, this.puzzle, this.state.status)) return this.announce("Sharing blocked.");
    const res = await this.svc.share.share(text);
    this.announce(res.ok ? (res.method === "clipboard" ? "Copied." : "Shared.") : "Sharing unavailable.");
  }

  private announce(msg: string): void {
    if (this.live) this.live.textContent = msg;
  }
}

export const vowelGhostPlugin: GamePlugin = {
  meta: { id: "vowel-ghost", name: "Vowel Ghost", tagline: "Restore the missing vowels to a themed set.", glyph: "👻", accent: "#64748b" },
  contentPackPath: "./vowel-ghost.json",
  async mount(root, services) {
    const game = new VowelGhost(root, services);
    await game.init("./vowel-ghost.json");
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
