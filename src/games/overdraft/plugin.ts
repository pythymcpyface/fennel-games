import type { GamePlugin, GameServices, GameInstance, DailyResult } from "../../kit/types.ts";
import { canonicalizeDayId, derivePuzzleId } from "../../kit/selection.ts";
import { loadStats, saveStats, recordPlayed, recordWon, type Stats } from "../../kit/stats.ts";
import { saveAttempt, loadAttempt } from "../../kit/persistence.ts";
import type { AttemptState, Puzzle } from "./types.ts";
import { initAttempt, submit, evaluate, isWellFormed, canSubmit } from "./engine.ts";
import { buildShareText, isSpoilerSafe, scoreBand } from "./share.ts";
import { carbonButton, carbonNotification } from "../../kit/carbon.ts";

interface ContentPack {
  contentPackVersion: string;
  datasetId: string;
  puzzleCount: number;
  dictionary: string[];
  puzzles: Puzzle[];
}

class Overdraft implements GameInstance {
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
    return { gameId: "overdraft", dayId: this.state.dayId, played: this.state.isComplete, solved: this.state.isComplete && this.state.netScore > 0 };
  }

  private persist(): void {
    saveAttempt(this.svc.storage, this.svc.keyFor(`state:${this.state.dayId}`), this.state);
    this.svc.onResult(this.currentResult());
  }

  render(): void {
    const s = this.state;
    const done = s.isComplete;
    this.root.innerHTML = "";
    this.root.className = "game overdraft";
    this.root.append(homeBar(this.svc, "Overdraft"));
    this.root.append(
      el("p", { class: "sub", text: `${s.dayId} · UTC · borrow up to ${this.puzzle.maxBorrow} (−${this.puzzle.borrowPenalty} each)` }),
      el("p", { class: "help", text: "Build ONE long word. Letters outside the set can be borrowed — but each costs points. Maximise your net score." }),
    );

    // Letter set with point values
    const setEl = el("div", { class: "od-set" });
    setEl.setAttribute("aria-label", "Your letters and their point values");
    this.puzzle.letterSet.forEach((ch) => {
      const chip = el("span", { class: "od-letter", text: `${ch}` });
      const pts = el("sub", { text: String(this.puzzle.letterPoints[ch] ?? 0) });
      chip.append(pts);
      chip.setAttribute("aria-label", `${ch} worth ${this.puzzle.letterPoints[ch] ?? 0}`);
      setEl.append(chip);
    });
    this.root.append(setEl);

    this.live = liveRegion();
    this.root.append(this.live);

    if (!done) {
      this.root.append(this.buildInput());
      // Live evaluation of the current draft
      if (this.draft) {
        const ev = evaluate(this.draft, this.puzzle, this.dictionary);
        const evalEl = el("div", { class: "od-eval" });
        evalEl.append(
          statLine("Base", String(ev.baseScore)),
          statLine("Borrowed", `${ev.borrowedCount}/${this.puzzle.maxBorrow}${ev.borrowedLetters.length ? " (" + ev.borrowedLetters.join(",") + ")" : ""}`),
          statLine("Penalty", `−${ev.penalty}`),
          statLine("Net", String(ev.netScore)),
        );
        this.root.append(evalEl);
        if (!ev.inDictionary) this.root.append(carbonNotification("Not a word", "That word isn't in the list.", "warning"));
        else if (ev.overLimit) this.root.append(carbonNotification("Borrow limit", `Max ${this.puzzle.maxBorrow} borrowed letters.`, "warning"));
      }
    } else {
      this.root.append(carbonNotification("Submitted", `Net score ${s.netScore} (${scoreBand(s.netScore)}), ${s.borrowedCount} borrowed.`, s.netScore > 0 ? "success" : "info"));
    }

    const controls = el("div", { class: "controls" });
    if (!done) {
      const canGo = isWellFormed(this.draft) && (() => { const ev = evaluate(this.draft, this.puzzle, this.dictionary); return ev.inDictionary && !ev.overLimit; })();
      controls.append(carbonButton({ text: "Submit word", disabled: !canGo, onClick: () => this.trySubmit() }));
    }
    controls.append(carbonButton({ text: "Share", kind: "secondary", disabled: !done, onClick: () => void this.doShare() }));
    this.root.append(controls);
  }

  private buildInput(): HTMLElement {
    const wrap = el("div", { class: "od-input" });
    const input = el("input", { class: "od-field" }) as HTMLInputElement;
    input.type = "text";
    input.value = this.draft;
    input.setAttribute("aria-label", "Enter your word");
    input.autocapitalize = "characters";
    input.autocomplete = "off";
    input.addEventListener("input", () => {
      this.draft = input.value.replace(/[^A-Za-z]/g, "").toUpperCase();
      input.value = this.draft;
      this.render();
      queueMicrotask(() => {
        const again = this.root.querySelector<HTMLInputElement>(".od-field");
        if (again) { again.focus(); again.setSelectionRange(again.value.length, again.value.length); }
      });
    });
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") this.trySubmit(); });
    wrap.append(input);
    queueMicrotask(() => input.focus());
    return wrap;
  }

  private trySubmit(): void {
    if (!canSubmit(this.state)) return;
    const out = submit(this.state, this.puzzle, this.dictionary, this.draft);
    if (!out.accepted) {
      this.announce(out.reason === "dictionary" ? "Not in word list." : out.reason === "over-limit" ? "Too many borrowed letters." : "Enter a valid word.");
      return;
    }
    this.state = out.state;
    this.stats = this.state.netScore > 0
      ? recordWon(recordPlayed(this.stats, this.state.dayId), this.state.dayId)
      : recordPlayed(this.stats, this.state.dayId);
    saveStats(this.svc.storage, this.svc.keyFor("stats"), this.stats);
    this.persist();
    this.render();
    this.announce(`Submitted. Net score ${this.state.netScore}.`);
  }

  private async doShare(): Promise<void> {
    const text = buildShareText(this.state, this.state.dayId);
    if (!isSpoilerSafe(text, this.state.finalWord)) return this.announce("Sharing blocked.");
    const res = await this.svc.share.share(text);
    this.announce(res.ok ? (res.method === "clipboard" ? "Copied." : "Shared.") : "Sharing unavailable.");
  }

  private announce(msg: string): void {
    if (this.live) this.live.textContent = msg;
  }
}

export const overdraftPlugin: GamePlugin = {
  meta: { id: "overdraft", name: "Overdraft", tagline: "Build a word; borrow letters at a cost.", glyph: "🏦", accent: "#08bdba" },
  contentPackPath: "./overdraft.json",
  async mount(root, services) {
    const game = new Overdraft(root, services);
    await game.init("./overdraft.json");
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
function statLine(label: string, value: string): HTMLElement {
  const row = el("div", { class: "od-stat" });
  row.append(el("span", { class: "od-stat-label", text: label }), el("span", { class: "od-stat-value", text: value }));
  return row;
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
