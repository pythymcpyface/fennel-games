import type { GamePlugin, GameServices, GameInstance, DailyResult } from "../../kit/types.ts";
import { canonicalizeDayId, derivePuzzleId } from "../../kit/selection.ts";
import { loadStats, saveStats, recordPlayed, recordWon, type Stats } from "../../kit/stats.ts";
import { saveAttempt, loadAttempt } from "../../kit/persistence.ts";
import type { AttemptState, Puzzle } from "./types.ts";
import { ATTEMPT_LIMIT } from "./types.ts";
import { initAttempt, setChoice, submit, applyHint, canSubmit } from "./engine.ts";
import { buildShareText, isSpoilerSafe } from "./share.ts";

interface ContentPack { contentPackVersion: string; datasetId: string; puzzleCount: number; puzzles: Puzzle[]; }

class StressTest implements GameInstance {
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
    return { gameId: "stress-test", dayId: this.state.dayId, played: this.state.attemptsUsed > 0 || this.state.status !== "in_progress", solved: this.state.status === "solved" };
  }

  private persist(): void {
    saveAttempt(this.svc.storage, this.svc.keyFor(`state:${this.state.dayId}`), this.state);
    this.svc.onResult(this.currentResult());
  }

  render(): void {
    const s = this.state;
    const done = s.status !== "in_progress";
    this.root.innerHTML = "";
    this.root.className = "game stress-test";
    this.root.append(homeBar(this.svc, "Stress Test"));
    this.root.append(el("p", { class: "sub", text: `${s.dayId} · UTC · ${ATTEMPT_LIMIT - s.attemptsUsed} tries left` }));
    this.root.append(el("p", { class: "help", text: "Tap the syllable that carries the stress." }));
    this.live = liveRegion();
    this.root.append(this.live);

    const rows = el("div", { class: "match-rows" });
    this.puzzle.items.forEach((item, i) => {
      const row = el("div", { class: `stress-row${s.locked[i] ? " locked" : ""}` });
      if (item.sense) row.append(el("span", { class: "stress-sense", text: item.sense }));
      const sylBox = el("div", { class: "syllables" });
      item.syllables.forEach((syl, si) => {
        const btn = el("button", { class: `syl${s.choices[i] === si ? " chosen" : ""}`, text: syl }) as HTMLButtonElement;
        btn.type = "button";
        btn.disabled = done || s.locked[i];
        btn.setAttribute("aria-label", `${syl}${s.choices[i] === si ? ", selected as stressed" : ""}`);
        btn.setAttribute("aria-pressed", String(s.choices[i] === si));
        btn.addEventListener("click", () => { this.state = setChoice(this.state, i, si); this.persist(); this.render(); });
        sylBox.append(btn);
      });
      row.append(sylBox);
      if (s.locked[i]) row.append(el("span", { class: "match-status", text: "✓" }));
      rows.append(row);
    });
    this.root.append(rows);

    const controls = el("div", { class: "controls" });
    const submitBtn = el("button", { text: "Check", class: "btn" }) as HTMLButtonElement;
    submitBtn.type = "button";
    submitBtn.disabled = done;
    submitBtn.addEventListener("click", () => {
      if (!canSubmit(this.state)) return;
      const out = submit(this.state, this.puzzle);
      this.state = out.state;
      if (this.state.status === "solved") { this.stats = recordWon(recordPlayed(this.stats, this.state.dayId), this.state.dayId); saveStats(this.svc.storage, this.svc.keyFor("stats"), this.stats); }
      else if (this.state.status === "failed") { this.stats = recordPlayed(this.stats, this.state.dayId); saveStats(this.svc.storage, this.svc.keyFor("stats"), this.stats); }
      this.persist();
      this.render();
      this.announce(out.solved ? "All correct!" : `${out.correct} of 5 correct.`);
    });
    const hintBtn = el("button", { text: "Hint", class: "btn btn-secondary" }) as HTMLButtonElement;
    hintBtn.type = "button";
    hintBtn.disabled = done;
    hintBtn.addEventListener("click", () => { const n = applyHint(this.state, this.puzzle); if (n) { this.state = n; this.persist(); } this.render(); this.announce(n ? "Locked one." : "No hint."); });
    const shareBtn = el("button", { text: "Share", class: "btn btn-secondary" }) as HTMLButtonElement;
    shareBtn.type = "button";
    shareBtn.addEventListener("click", () => void this.doShare());
    controls.append(submitBtn, hintBtn, shareBtn);
    // Optional pronunciation flourish (off by default): speak the puzzle's words.
    const playBtn = el("button", { text: "🔊 Say", class: "btn btn-secondary" }) as HTMLButtonElement;
    playBtn.type = "button";
    playBtn.setAttribute("aria-label", "Hear the words pronounced");
    playBtn.addEventListener("click", async () => {
      const { setAudioEnabled, speak, isSpeechSupported } = await import("../../kit/speech.ts");
      if (!isSpeechSupported()) { this.announce("Speech not available on this device."); return; }
      setAudioEnabled((k, v) => this.svc.storage.write(k, v), true);
      speak(this.puzzle.items.map((it) => it.word).join(", "), true);
    });
    controls.append(playBtn);
    this.root.append(controls);

    if (s.status === "solved") this.root.append(el("p", { class: "win", text: "Solved!" }));
    if (s.status === "failed") this.root.append(el("p", { class: "lose", text: "Out of tries." }));
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

export const stressTestPlugin: GamePlugin = {
  meta: { id: "stress-test", name: "Stress Test", tagline: "Mark the stressed syllable in each word.", glyph: "🗣️", accent: "#facc15" },
  contentPackPath: "./stress-test.json",
  async mount(root, services) {
    const game = new StressTest(root, services);
    await game.init("./stress-test.json");
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
