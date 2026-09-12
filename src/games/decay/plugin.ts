import type { GamePlugin, GameServices, GameInstance, DailyResult } from "../../kit/types.ts";
import { canonicalizeDayId, derivePuzzleId } from "../../kit/selection.ts";
import { loadStats, saveStats, recordPlayed, recordWon, type Stats } from "../../kit/stats.ts";
import { saveAttempt, loadAttempt } from "../../kit/persistence.ts";
import type { AttemptState, Puzzle } from "./types.ts";
import { initAttempt, submit, visibleMask, effectiveTick, renderWord, lockedCount, lostCount, isSolved } from "./engine.ts";
import { buildShareText, isSpoilerSafe } from "./share.ts";
import { carbonButton, carbonNotification } from "../../kit/carbon.ts";

interface ContentPack {
  contentPackVersion: string;
  datasetId: string;
  puzzleCount: number;
  puzzles: Puzzle[];
}

class Decay implements GameInstance {
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
    this.puzzle = this.pack.puzzles[Number(puzzleId.slice(4))];
    const saved = loadAttempt<AttemptState>(this.svc.storage, this.svc.keyFor(`state:${dayId}`), (raw) => this.repair(raw, dayId));
    this.state = saved ?? initAttempt(this.puzzle, dayId);
  }

  private repair(raw: unknown, dayId: string): AttemptState | null {
    if (typeof raw !== "object" || raw === null) return null;
    const r = raw as Partial<AttemptState>;
    if (r.puzzleId !== this.puzzle.puzzleId || !Array.isArray(r.words)) return null;
    if (r.words.length !== this.puzzle.targets.length) return null;
    return {
      puzzleId: this.puzzle.puzzleId,
      dayId,
      tick: typeof r.tick === "number" && r.tick >= 0 ? Math.floor(r.tick) : 0,
      words: r.words.map((w) => ({
        status: w && (w.status === "LOCKED" || w.status === "LOST") ? w.status : "UNLOCKED",
        atTick: w && typeof w.atTick === "number" ? w.atTick : null,
        lockedVisibility: w && typeof w.lockedVisibility === "number" ? w.lockedVisibility : null,
      })),
      score: typeof r.score === "number" && r.score >= 0 ? Math.floor(r.score) : 0,
      status: r.status === "SOLVED" || r.status === "FAILED" ? r.status : "IN_PROGRESS",
    };
  }

  currentResult(): DailyResult {
    return { gameId: "decay", dayId: this.state.dayId, played: this.state.status !== "IN_PROGRESS", solved: isSolved(this.state) };
  }

  private persist(): void {
    saveAttempt(this.svc.storage, this.svc.keyFor(`state:${this.state.dayId}`), this.state);
    this.svc.onResult(this.currentResult());
  }

  render(): void {
    const done = this.state.status !== "IN_PROGRESS";
    this.root.innerHTML = "";
    this.root.className = "game decay";
    this.root.append(homeBar(this.svc, "Decay"));
    this.root.append(
      el("p", { class: "sub", text: `${this.state.dayId} · UTC · tick ${this.state.tick} · ${lockedCount(this.state)}/${this.puzzle.targets.length} locked · score ${this.state.score}` }),
      el("p", { class: "help", text: "Every word is decaying — each guess hides one more letter of the rest. Type a word to lock it before it fades. The faster you recall, the higher the score." }),
    );

    this.live = liveRegion();
    this.root.append(this.live);

    // Word chips.
    const list = el("div", { class: "dc-words" });
    list.setAttribute("role", "list");
    this.puzzle.targets.forEach((t, i) => {
      const w = this.state.words[i];
      const mask = visibleMask(t, effectiveTick(this.state, i));
      const chip = el("div", { class: `dc-chip dc-${w.status.toLowerCase()}` });
      chip.setAttribute("role", "listitem");
      const vis = mask.filter(Boolean).length;
      chip.setAttribute("aria-label",
        w.status === "LOCKED" ? `Word ${i + 1} locked, ${w.lockedVisibility} letters were visible`
        : w.status === "LOST" ? `Word ${i + 1} lost`
        : `Word ${i + 1}, ${vis} of ${t.word.length} letters visible`);
      chip.append(el("span", { class: "dc-letters", text: w.status === "LOST" ? renderWord(t, mask.map(() => false)) : w.status === "LOCKED" ? t.word.toUpperCase().split("").join(" ") : renderWord(t, mask) }));
      chip.append(el("span", { class: "dc-tag", text: w.status === "LOCKED" ? "🔒 locked" : w.status === "LOST" ? "⬛ lost" : `${vis}/${t.word.length}` }));
      list.append(chip);
    });
    this.root.append(list);

    if (done) {
      this.root.append(carbonNotification(
        isSolved(this.state) ? "Solved!" : "Faded out",
        `Locked ${lockedCount(this.state)}/${this.puzzle.targets.length} (${lostCount(this.state)} lost), score ${this.state.score}.`,
        isSolved(this.state) ? "success" : "info",
      ));
    } else {
      this.root.append(this.buildInput());
    }

    const controls = el("div", { class: "controls" });
    if (!done) controls.append(carbonButton({ text: "Lock word", disabled: this.draft.replace(/[^A-Za-z]/g, "").length === 0, onClick: () => this.trySubmit() }));
    controls.append(carbonButton({ text: "Share", kind: "secondary", disabled: !done, onClick: () => void this.doShare() }));
    this.root.append(controls);
  }

  private buildInput(): HTMLElement {
    const wrap = el("div", { class: "dc-input" });
    const input = el("input", { class: "dc-field" }) as HTMLInputElement;
    input.type = "text";
    input.value = this.draft;
    input.setAttribute("aria-label", "Type a word to lock");
    input.autocapitalize = "characters";
    input.autocomplete = "off";
    input.addEventListener("input", () => { this.draft = input.value; const btn = this.root.querySelector<HTMLElement>(".controls cds-button, .controls .btn"); if (btn) { const empty = this.draft.replace(/[^A-Za-z]/g, "").length === 0; if (empty) btn.setAttribute("disabled", ""); else btn.removeAttribute("disabled"); } });
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") this.trySubmit(); });
    wrap.append(input);
    queueMicrotask(() => input.focus());
    return wrap;
  }

  private trySubmit(): void {
    const out = submit(this.state, this.puzzle, this.draft);
    if (!out.accepted) {
      this.announce(out.reason === "empty" ? "Enter a word." : "Game over.");
      return;
    }
    this.draft = "";
    this.state = out.state;
    if (this.state.status !== "IN_PROGRESS") {
      this.stats = isSolved(this.state)
        ? recordWon(recordPlayed(this.stats, this.state.dayId), this.state.dayId)
        : recordPlayed(this.stats, this.state.dayId);
      saveStats(this.svc.storage, this.svc.keyFor("stats"), this.stats);
    }
    this.persist();
    this.render();
    this.announce(out.matched ? `Locked a word. Score ${this.state.score}.` : "No match — the words decayed further.");
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

export const decayPlugin: GamePlugin = {
  meta: { id: "decay", name: "Decay", tagline: "Lock each word before it fades away.", glyph: "⏳", accent: "#fa4d56" },
  contentPackPath: "./decay.json",
  async mount(root, services) {
    const game = new Decay(root, services);
    await game.init("./decay.json");
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
