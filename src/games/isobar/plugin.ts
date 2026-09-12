import type { GamePlugin, GameServices, GameInstance, DailyResult } from "../../kit/types.ts";
import { canonicalizeDayId, derivePuzzleId } from "../../kit/selection.ts";
import { loadStats, saveStats, recordPlayed, recordWon, type Stats } from "../../kit/stats.ts";
import { saveAttempt, loadAttempt } from "../../kit/persistence.ts";
import type { AttemptState, Puzzle, WordHint } from "./types.ts";
import { initAttempt, place, submit, canSubmit } from "./engine.ts";
import { buildShareText, isSpoilerSafe } from "./share.ts";
import { carbonButton } from "../../kit/carbon.ts";

interface ContentPack {
  contentPackVersion: string;
  datasetId: string;
  puzzleCount: number;
  puzzles: Puzzle[];
}

function hintText(h: WordHint): string {
  if (h.status === "correct") return "✓ correct ring";
  if (h.status === "off_by_one") return h.direction === "nearer" ? "↑ one ring nearer" : "↓ one ring farther";
  return "✗ wrong ring";
}

class Isobar implements GameInstance {
  private pack!: ContentPack;
  private puzzle!: Puzzle;
  private state!: AttemptState;
  private stats!: Stats;
  private live!: HTMLElement;
  private lastHints: WordHint[] = [];

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
    return { gameId: "isobar", dayId: this.state.dayId, played: this.state.attempts > 0 || this.state.isSolved, solved: this.state.isSolved };
  }

  private persist(): void {
    saveAttempt(this.svc.storage, this.svc.keyFor(`state:${this.state.dayId}`), this.state);
    this.svc.onResult(this.currentResult());
  }

  render(): void {
    const s = this.state;
    const done = s.isSolved;
    this.root.innerHTML = "";
    this.root.className = "game isobar";
    this.root.append(homeBar(this.svc, "Isobar"));
    this.root.append(
      el("p", { class: "sub", text: `${s.dayId} · UTC · ${s.attempts} tries` }),
      el("p", { class: "help", text: `Place each word on a ring by meaning: ring 0 = closest to the hidden centre, ${this.puzzle.ringCount - 1} = farthest.` }),
    );
    this.live = liveRegion();
    this.root.append(this.live);

    const list = el("div", { class: "iso-list" });
    list.setAttribute("role", "list");
    this.puzzle.words.forEach((word, wi) => {
      const hint = this.lastHints[wi];
      const row = el("div", { class: `iso-word${hint ? " iso-" + hint.status : ""}` });
      row.setAttribute("role", "listitem");
      row.append(el("span", { class: "iso-label", text: word }));
      const ringWrap = el("div", { class: "iso-rings" });
      ringWrap.setAttribute("role", "radiogroup");
      ringWrap.setAttribute("aria-label", `Ring for ${word}`);
      for (let r = 0; r < this.puzzle.ringCount; r++) {
        const on = s.placement[wi] === r;
        const rb = el("button", { class: `iso-ring${on ? " on" : ""}`, text: String(r) }) as HTMLButtonElement;
        rb.type = "button";
        rb.disabled = done;
        rb.setAttribute("role", "radio");
        rb.setAttribute("aria-checked", String(on));
        rb.setAttribute("aria-label", `${word}: ring ${r}${r === 0 ? " (closest)" : r === this.puzzle.ringCount - 1 ? " (farthest)" : ""}`);
        rb.addEventListener("click", () => {
          this.state = place(this.state, wi, on ? null : r, this.puzzle);
          this.persist();
          this.render();
        });
        ringWrap.append(rb);
      }
      row.append(ringWrap);
      if (hint) {
        const h = el("span", { class: "iso-hint", text: hintText(hint) });
        row.append(h);
      }
      list.append(row);
    });
    this.root.append(list);

    const controls = el("div", { class: "controls" });
    const submitBtn = carbonButton({ text: "Submit", disabled: done || !canSubmit(this.state), onClick: () => this.trySubmit() });
    const shareBtn = carbonButton({ text: "Share", kind: "secondary", onClick: () => void this.doShare() });
    controls.append(submitBtn, shareBtn);
    this.root.append(controls);

    if (s.isSolved) this.root.append(el("p", { class: "win", text: `All rings correct in ${s.attempts}!` }));
  }

  private trySubmit(): void {
    const out = submit(this.state, this.puzzle);
    if (!out.accepted) {
      this.announce(out.reason === "incomplete" ? "Place all 5 words first." : "Already solved.");
      return;
    }
    this.state = out.state;
    this.lastHints = out.hints ?? [];
    if (this.state.isSolved) {
      this.stats = recordWon(recordPlayed(this.stats, this.state.dayId), this.state.dayId);
      saveStats(this.svc.storage, this.svc.keyFor("stats"), this.stats);
    } else if (this.state.attempts === 1) {
      this.stats = recordPlayed(this.stats, this.state.dayId);
      saveStats(this.svc.storage, this.svc.keyFor("stats"), this.stats);
    }
    this.persist();
    this.render();
    this.announce(out.solved ? "Solved! Every word on its ring." : `${out.correct} of 5 on the correct ring.`);
  }

  private async doShare(): Promise<void> {
    const text = buildShareText(this.state, this.state.dayId);
    if (!isSpoilerSafe(text, this.puzzle.words)) return this.announce("Sharing blocked.");
    const res = await this.svc.share.share(text);
    this.announce(res.ok ? (res.method === "clipboard" ? "Copied." : "Shared.") : "Sharing unavailable.");
  }

  private announce(msg: string): void {
    if (this.live) this.live.textContent = msg;
  }
}

export const isobarPlugin: GamePlugin = {
  meta: { id: "isobar", name: "Isobar", tagline: "Rank words by meaning around a hidden centre.", glyph: "🎯", accent: "#ee5396" },
  contentPackPath: "./isobar.json",
  async mount(root, services) {
    const game = new Isobar(root, services);
    await game.init("./isobar.json");
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
