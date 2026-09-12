import type { GamePlugin, GameServices, GameInstance, DailyResult } from "../../kit/types.ts";
import { canonicalizeDayId, derivePuzzleId, fnv1a32 } from "../../kit/selection.ts";
import { loadStats, saveStats, recordPlayed, recordWon, type Stats } from "../../kit/stats.ts";
import { saveAttempt, loadAttempt } from "../../kit/persistence.ts";
import type { AttemptState, Puzzle } from "./types.ts";
import { ATTEMPT_LIMIT, COMPOUND_COUNT } from "./types.ts";
import { initAttempt, submitPair, applyHint, isLocked, canSubmit } from "./engine.ts";
import { buildShareText, isSpoilerSafe } from "./share.ts";

interface ContentPack { contentPackVersion: string; datasetId: string; puzzleCount: number; puzzles: Puzzle[]; }

class CompoundSplit implements GameInstance {
  private pack!: ContentPack;
  private puzzle!: Puzzle;
  private state!: AttemptState;
  private stats!: Stats;
  private live!: HTMLElement;
  private order: number[] = [];
  private selected: number[] = [];

  constructor(private readonly root: HTMLElement, private readonly svc: GameServices) {}

  async init(packPath: string): Promise<void> {
    this.pack = JSON.parse(await this.svc.assets.loadText(packPath)) as ContentPack;
    this.stats = loadStats(this.svc.storage, this.svc.keyFor("stats"));
    const dayId = canonicalizeDayId(this.svc.clock.nowMs(), "UTC");
    const puzzleId = derivePuzzleId(dayId, this.pack.contentPackVersion, this.pack.datasetId, this.pack.puzzleCount);
    this.puzzle = this.pack.puzzles[Number(puzzleId.slice(4))];
    const saved = loadAttempt<AttemptState>(this.svc.storage, this.svc.keyFor(`state:${dayId}`), (raw) => raw as AttemptState);
    this.state = saved ?? initAttempt(this.puzzle, dayId);
    // Deterministic display shuffle (seeded by day) so halves aren't in answer order.
    this.order = this.seededOrder(`${this.puzzle.puzzleId}|${dayId}`);
  }

  private seededOrder(seed: string): number[] {
    const arr = this.puzzle.halves.map((_, i) => i);
    let h = fnv1a32(seed);
    for (let i = arr.length - 1; i > 0; i--) {
      h ^= (h << 13) >>> 0; h ^= h >>> 17; h ^= (h << 5) >>> 0;
      const j = (h >>> 0) % (i + 1);
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  currentResult(): DailyResult {
    return { gameId: "compound-split", dayId: this.state.dayId, played: this.state.attemptsUsed > 0 || this.state.status !== "in_progress" || this.state.lockedPairs.length > 0, solved: this.state.status === "won" };
  }

  private persist(): void {
    saveAttempt(this.svc.storage, this.svc.keyFor(`state:${this.state.dayId}`), this.state);
    this.svc.onResult(this.currentResult());
  }

  private trySubmit(): void {
    if (this.selected.length !== 2) return;
    const [a, b] = this.selected;
    const out = submitPair(this.state, this.puzzle, a, b);
    this.state = out.state;
    this.selected = [];
    if (this.state.status === "won") { this.stats = recordWon(recordPlayed(this.stats, this.state.dayId), this.state.dayId); saveStats(this.svc.storage, this.svc.keyFor("stats"), this.stats); }
    else if (this.state.status === "lost") { this.stats = recordPlayed(this.stats, this.state.dayId); saveStats(this.svc.storage, this.svc.keyFor("stats"), this.stats); }
    this.persist();
    this.render();
    this.announce(
      out.feedback === "CORRECT" ? "Compound formed!" :
      out.feedback === "INCORRECT" ? `Not a compound. ${ATTEMPT_LIMIT - this.state.attemptsUsed} tries left.` :
      out.feedback === "ALREADY_LOCKED" ? "That half is already used." : "Pick two halves.",
    );
  }

  render(): void {
    const s = this.state;
    const done = s.status !== "in_progress";
    this.root.innerHTML = "";
    this.root.className = "game compound-split";
    this.root.append(homeBar(this.svc, "Compound Split"));
    this.root.append(el("p", { class: "sub", text: `${s.dayId} · UTC · ${ATTEMPT_LIMIT - s.attemptsUsed} tries · ${s.lockedPairs.length}/${COMPOUND_COUNT} found` }));
    this.root.append(el("p", { class: "help", text: "Pair the halves into four compound words (order matters)." }));
    this.live = liveRegion();
    this.root.append(this.live);

    const grid = el("div", { class: "cs-grid" });
    grid.setAttribute("role", "group");
    grid.setAttribute("aria-label", "Word halves");
    for (const i of this.order) {
      const locked = isLocked(s, i);
      const btn = el("button", { class: `cs-half${this.selected.includes(i) ? " selected" : ""}${locked ? " locked" : ""}`, text: this.puzzle.halves[i] }) as HTMLButtonElement;
      btn.type = "button";
      btn.disabled = done || locked;
      const posInSel = this.selected.indexOf(i);
      btn.setAttribute("aria-label", `${this.puzzle.halves[i]}${locked ? ", used" : posInSel === 0 ? ", selected first" : posInSel === 1 ? ", selected second" : ""}`);
      btn.setAttribute("aria-pressed", String(this.selected.includes(i)));
      btn.addEventListener("click", () => {
        if (locked || done) return;
        const at = this.selected.indexOf(i);
        if (at >= 0) this.selected.splice(at, 1);
        else if (this.selected.length < 2) this.selected.push(i);
        if (this.selected.length === 2) { this.trySubmit(); return; }
        this.render();
      });
      grid.append(btn);
    }
    this.root.append(grid);

    // Found compounds.
    if (s.lockedPairs.length) {
      const found = el("ul", { class: "cs-found" });
      found.setAttribute("aria-label", "Compounds found");
      for (const p of s.lockedPairs) found.append(el("li", { class: "cs-found-item", text: p.compound }));
      this.root.append(found);
    }

    const controls = el("div", { class: "controls" });
    const hintBtn = el("button", { text: "Hint", class: "btn btn-secondary" }) as HTMLButtonElement;
    hintBtn.type = "button";
    hintBtn.disabled = done;
    hintBtn.addEventListener("click", () => {
      const next = applyHint(this.state, this.puzzle);
      if (next) {
        this.state = next;
        if (this.state.status === "won") { this.stats = recordWon(recordPlayed(this.stats, this.state.dayId), this.state.dayId); saveStats(this.svc.storage, this.svc.keyFor("stats"), this.stats); }
        this.persist();
      }
      this.render();
      this.announce(next ? "Locked one compound." : "No hint available.");
    });
    const shareBtn = el("button", { text: "Share", class: "btn btn-secondary" }) as HTMLButtonElement;
    shareBtn.type = "button";
    shareBtn.addEventListener("click", () => void this.doShare());
    controls.append(hintBtn, shareBtn);
    this.root.append(controls);

    if (s.status === "won") this.root.append(el("p", { class: "win", text: "Solved!" }));
    if (s.status === "lost") this.root.append(el("p", { class: "lose", text: "Out of tries." }));
    void canSubmit;
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

export const compoundSplitPlugin: GamePlugin = {
  meta: { id: "compound-split", name: "Compound Split", tagline: "Recombine eight halves into four compound words.", glyph: "🧩", accent: "#4ade80" },
  contentPackPath: "./compound-split.json",
  async mount(root, services) {
    const game = new CompoundSplit(root, services);
    await game.init("./compound-split.json");
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
