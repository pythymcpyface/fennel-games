import type { GamePlugin, GameServices, GameInstance, DailyResult } from "../../kit/types.ts";
import { canonicalizeDayId, derivePuzzleId } from "../../kit/selection.ts";
import { loadStats, saveStats, recordPlayed, recordWon, type Stats } from "../../kit/stats.ts";
import { saveAttempt, loadAttempt } from "../../kit/persistence.ts";
import type { AttemptState, Puzzle } from "./types.ts";
import { initAttempt, setWord, submit, validate, canSubmit } from "./engine.ts";
import { buildShareText, isSpoilerSafe } from "./share.ts";

interface ContentPack { contentPackVersion: string; datasetId: string; puzzleCount: number; dictionary: string[]; puzzles: Puzzle[]; }

class AcronymAttack implements GameInstance {
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
    return { gameId: "acronym-attack", dayId: this.state.dayId, played: this.state.submitCount > 0 || this.state.status === "won" || this.state.words.some((w) => w), solved: this.state.status === "won" };
  }

  private persist(): void {
    saveAttempt(this.svc.storage, this.svc.keyFor(`state:${this.state.dayId}`), this.state);
    this.svc.onResult(this.currentResult());
  }

  render(): void {
    const s = this.state;
    const done = s.status === "won";
    const result = validate(s, this.puzzle, this.dictionary);
    this.root.innerHTML = "";
    this.root.className = "game acronym-attack";
    this.root.append(homeBar(this.svc, "Acronym Attack"));
    this.root.append(el("p", { class: "sub", text: `${s.dayId} · UTC · theme: ${this.puzzle.theme}` }));
    this.root.append(el("p", { class: "help", text: `Make each word start with its letter and be a real word.` }));
    this.live = liveRegion();
    this.root.append(this.live);

    const rows = el("div", { class: "aa-rows" });
    this.puzzle.acronym.split("").forEach((letter, i) => {
      const row = el("div", { class: "aa-row" });
      row.append(el("span", { class: "aa-letter", text: letter }));
      const input = el("input", { class: "text-input" }) as HTMLInputElement;
      input.value = s.words[i] ?? "";
      input.autocomplete = "off";
      input.disabled = done;
      input.setAttribute("aria-label", `Word starting with ${letter}`);
      const ok = s.words[i] && result.perLetterOk[i] && this.dictionary.has(s.words[i]);
      if (s.words[i]) row.classList.add(ok ? "ok" : "bad");
      input.addEventListener("input", () => {
        this.state = setWord(this.state, i, input.value);
        this.persist();
        // Live validity mark without a full re-render (keeps focus/other fields intact).
        const w = this.state.words[i];
        const okNow = w.length > 0 && w[0] === letter && this.dictionary.has(w);
        row.classList.toggle("ok", w.length > 0 && okNow);
        row.classList.toggle("bad", w.length > 0 && !okNow);
      });
      row.append(input);
      row.append(el("span", { class: "aa-status", text: s.words[i] ? (ok ? "✓" : "✗") : "" }));
      rows.append(row);
    });
    this.root.append(rows);

    const controls = el("div", { class: "controls" });
    const submitBtn = el("button", { text: "Submit", class: "btn" }) as HTMLButtonElement;
    submitBtn.type = "button";
    submitBtn.disabled = done;
    submitBtn.addEventListener("click", () => {
      if (!canSubmit(this.state)) return;
      const out = submit(this.state, this.puzzle, this.dictionary);
      this.state = out.state;
      if (this.state.status === "won") { this.stats = recordWon(recordPlayed(this.stats, this.state.dayId), this.state.dayId); saveStats(this.svc.storage, this.svc.keyFor("stats"), this.stats); }
      this.persist();
      this.render();
      this.announce(out.result.valid ? `Valid! Elegance score ${out.result.score}.` : "Not all words are valid yet.");
    });
    const shareBtn = el("button", { text: "Share", class: "btn btn-secondary" }) as HTMLButtonElement;
    shareBtn.type = "button";
    shareBtn.addEventListener("click", () => void this.doShare(result.score));
    controls.append(submitBtn, shareBtn);
    this.root.append(controls);

    if (done) this.root.append(el("p", { class: "win", text: `Solved — elegance ${result.score}` }));
  }

  private async doShare(score: number): Promise<void> {
    const text = buildShareText(this.state, this.puzzle, this.state.dayId, score);
    if (!isSpoilerSafe(text, this.state.words)) return this.announce("Sharing blocked.");
    const res = await this.svc.share.share(text);
    this.announce(res.ok ? (res.method === "clipboard" ? "Copied." : "Shared.") : "Sharing unavailable.");
  }

  private announce(msg: string): void {
    if (this.live) this.live.textContent = msg;
  }
}

export const acronymAttackPlugin: GamePlugin = {
  meta: { id: "acronym-attack", name: "Acronym Attack", tagline: "Expand the acronym into a themed phrase.", glyph: "🔤", accent: "#e879f9" },
  contentPackPath: "./acronym-attack.json",
  async mount(root, services) {
    const game = new AcronymAttack(root, services);
    await game.init("./acronym-attack.json");
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
