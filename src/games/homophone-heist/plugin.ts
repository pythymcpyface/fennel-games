import type { GamePlugin, GameServices, GameInstance, DailyResult } from "../../kit/types.ts";
import { canonicalizeDayId, derivePuzzleId } from "../../kit/selection.ts";
import { loadStats, saveStats, recordPlayed, recordWon, type Stats } from "../../kit/stats.ts";
import { saveAttempt, loadAttempt } from "../../kit/persistence.ts";
import type { AttemptState, Puzzle } from "./types.ts";
import { ATTEMPTS_TOTAL } from "./types.ts";
import { initAttempt, submit, attemptsRemaining, hintLetter, canSubmit } from "./engine.ts";
import { buildShareText, isSpoilerSafe } from "./share.ts";

interface ContentPack { contentPackVersion: string; datasetId: string; puzzleCount: number; homophones: Record<string, string[]>; puzzles: Puzzle[]; }

class HomophoneHeist implements GameInstance {
  private pack!: ContentPack;
  private puzzle!: Puzzle;
  private state!: AttemptState;
  private stats!: Stats;
  private live!: HTMLElement;
  private selected = 0;

  constructor(private readonly root: HTMLElement, private readonly svc: GameServices) {}

  async init(packPath: string): Promise<void> {
    this.pack = JSON.parse(await this.svc.assets.loadText(packPath)) as ContentPack;
    this.stats = loadStats(this.svc.storage, this.svc.keyFor("stats"));
    const dayId = canonicalizeDayId(this.svc.clock.nowMs(), "UTC");
    const puzzleId = derivePuzzleId(dayId, this.pack.contentPackVersion, this.pack.datasetId, this.pack.puzzleCount);
    this.puzzle = this.pack.puzzles[Number(puzzleId.slice(4))];
    const saved = loadAttempt<AttemptState>(this.svc.storage, this.svc.keyFor(`state:${dayId}`), (raw) => raw as AttemptState);
    this.state = saved ?? initAttempt(this.puzzle, dayId);
    this.selected = Math.max(0, this.state.solved.findIndex((x) => !x));
  }

  currentResult(): DailyResult {
    return { gameId: "homophone-heist", dayId: this.state.dayId, played: this.state.attemptsUsed > 0 || this.state.status !== "in_progress" || this.state.solved.some(Boolean), solved: this.state.status === "won" };
  }

  private persist(): void {
    saveAttempt(this.svc.storage, this.svc.keyFor(`state:${this.state.dayId}`), this.state);
    this.svc.onResult(this.currentResult());
  }

  render(): void {
    const s = this.state;
    const done = s.status !== "in_progress";
    this.root.innerHTML = "";
    this.root.className = "game homophone-heist";
    this.root.append(homeBar(this.svc, "Homophone Heist"));
    this.root.append(el("p", { class: "sub", text: `${s.dayId} · UTC · ${attemptsRemaining(s)}/${ATTEMPTS_TOTAL} attempts` }));
    this.root.append(el("p", { class: "help", text: "Read it aloud. Tap a word, then type what it really means." }));
    this.live = liveRegion();
    this.root.append(this.live);

    const sentence = el("div", { class: "hh-sentence" });
    this.puzzle.shownTokens.forEach((tok, i) => {
      const w = el("button", { class: `hh-token${this.selected === i ? " selected" : ""}${s.solved[i] ? " solved" : ""}`, text: s.solved[i] ? this.puzzle.answers[i] : tok }) as HTMLButtonElement;
      w.type = "button";
      w.disabled = done || s.solved[i];
      w.setAttribute("aria-label", `${s.solved[i] ? "solved " + this.puzzle.answers[i] : "sounds like " + tok}`);
      w.addEventListener("click", () => { this.selected = i; this.render(); document.getElementById("guess-input")?.focus(); });
      sentence.append(w);
    });
    this.root.append(sentence);

    if (!done) {
      const form = el("form", { class: "row" }) as HTMLFormElement;
      const input = el("input", { class: "text-input" }) as HTMLInputElement;
      input.id = "guess-input";
      input.type = "text";
      input.autocomplete = "off";
      input.setAttribute("aria-label", `Decode "${this.puzzle.shownTokens[this.selected]}"`);
      const sub = el("button", { text: "Enter", class: "btn" }) as HTMLButtonElement;
      sub.type = "submit";
      form.append(input, sub);
      const error = el("p", { class: "error" });
      error.setAttribute("role", "alert");
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        if (!canSubmit(this.state)) return;
        const out = submit(this.state, this.puzzle, this.selected, input.value, this.pack.homophones);
        this.state = out.state;
        if (this.state.status === "won") { this.stats = recordWon(recordPlayed(this.stats, this.state.dayId), this.state.dayId); saveStats(this.svc.storage, this.svc.keyFor("stats"), this.stats); }
        else if (this.state.status === "lost") { this.stats = recordPlayed(this.stats, this.state.dayId); saveStats(this.svc.storage, this.svc.keyFor("stats"), this.stats); }
        if (out.correct) { const n = this.state.solved.findIndex((x) => !x); if (n >= 0) this.selected = n; }
        this.persist();
        input.value = "";
        this.render();
        this.announce(out.correct ? "Correct!" : out.empty ? "Type a word." : out.alreadySolved ? "Already solved." : `${out.feedback?.isHomophone ? "Sounds right, wrong word" : "Not a match"}. ${attemptsRemaining(this.state)} left.`);
        document.getElementById("guess-input")?.focus();
      });
      const controls = el("div", { class: "controls" });
      const hintBtn = el("button", { text: "Hint", class: "btn btn-secondary" }) as HTMLButtonElement;
      hintBtn.type = "button";
      const hintLine = el("p", { class: "hint-line" });
      hintLine.setAttribute("aria-hidden", "true");
      hintBtn.addEventListener("click", () => {
        const msg = `Starts with ${hintLetter(this.puzzle, this.selected)}.`;
        hintLine.textContent = msg;
        this.announce(msg);
      });
      const shareBtn = el("button", { text: "Share", class: "btn btn-secondary" }) as HTMLButtonElement;
      shareBtn.type = "button";
      shareBtn.addEventListener("click", () => void this.doShare());
      controls.append(hintBtn, shareBtn);
      // Optional read-aloud flourish (off by default; toggles opt-in and speaks the homophone line).
      const playBtn = el("button", { text: "🔊 Play", class: "btn btn-secondary" }) as HTMLButtonElement;
      playBtn.type = "button";
      playBtn.setAttribute("aria-label", "Read the sound-alike sentence aloud");
      playBtn.addEventListener("click", async () => {
        const { audioEnabled, setAudioEnabled, speak, isSpeechSupported } = await import("../../kit/speech.ts");
        if (!isSpeechSupported()) { this.announce("Speech not available on this device."); return; }
        if (!audioEnabled((k) => this.svc.storage.read(k))) setAudioEnabled((k, v) => this.svc.storage.write(k, v), true);
        speak(this.puzzle.shownTokens.join(" "), true);
      });
      controls.append(playBtn);
      this.root.append(form, error, controls, hintLine);
    } else {
      const controls = el("div", { class: "controls" });
      const shareBtn = el("button", { text: "Share", class: "btn" }) as HTMLButtonElement;
      shareBtn.type = "button";
      shareBtn.addEventListener("click", () => void this.doShare());
      controls.append(shareBtn);
      this.root.append(controls);
    }

    if (s.status === "won") this.root.append(el("p", { class: "win", text: "Decoded!" }));
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

export const homophoneHeistPlugin: GamePlugin = {
  meta: { id: "homophone-heist", name: "Homophone Heist", tagline: "Decode a sentence written in sound-alikes.", glyph: "🔊", accent: "#fbbf24" },
  contentPackPath: "./homophone-heist.json",
  async mount(root, services) {
    const game = new HomophoneHeist(root, services);
    await game.init("./homophone-heist.json");
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
