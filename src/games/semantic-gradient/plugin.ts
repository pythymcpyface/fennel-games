import type { GamePlugin, GameServices, GameInstance, DailyResult } from "../../kit/types.ts";
import { canonicalizeDayId } from "../../kit/selection.ts";
import { resolveDailyPuzzleIndex } from "../../kit/dev.ts";
import { loadStats, saveStats, recordPlayed, recordWon, type Stats } from "../../kit/stats.ts";
import { saveAttempt, loadAttempt } from "../../kit/persistence.ts";
import type { AttemptState, Band, Puzzle } from "./types.ts";
import { ROWS, COLS } from "./types.ts";
import { initAttempt, submitTrace, spendHint, canSpendHint, hintTarget, areAdjacent } from "./engine.ts";
import { buildShareText, isSpoilerSafe } from "./share.ts";

interface ContentPack {
  contentPackVersion: string;
  datasetId: string;
  puzzleCount: number;
  puzzles: Puzzle[];
}

const BAND_LABEL: Record<Band, string> = { hot: "🔴 hot", warm: "🟠 warm", cool: "🔵 cool", cold: "🟦 cold" };

class SemanticGradient implements GameInstance {
  private pack!: ContentPack;
  private puzzle!: Puzzle;
  private state!: AttemptState;
  private stats!: Stats;
  private live!: HTMLElement;
  private trace: number[] = [];        // in-progress path (cell indices)
  private revealedCell: number | null = null; // last hint-revealed start cell

  constructor(private readonly root: HTMLElement, private readonly svc: GameServices) {}

  async init(packPath: string): Promise<void> {
    this.pack = JSON.parse(await this.svc.assets.loadText(packPath)) as ContentPack;
    this.stats = loadStats(this.svc.storage, this.svc.keyFor("stats"));
    const dayId = canonicalizeDayId(this.svc.clock.nowMs(), "UTC");
    const idx = resolveDailyPuzzleIndex(
      "semantic-gradient", dayId, this.pack.contentPackVersion, this.pack.datasetId, this.pack.puzzleCount,
      { read: (k) => this.svc.storage.read(k) },
      (word) => this.pack.puzzles.findIndex((p) => p.anchor === word.toLowerCase() || p.answers.some((a) => a.word === word.toLowerCase())),
    );
    this.puzzle = this.pack.puzzles[idx];
    const saved = loadAttempt<AttemptState>(this.svc.storage, this.svc.keyFor(`state:${dayId}`), (raw) => raw as AttemptState);
    this.state = saved ?? initAttempt(this.puzzle, dayId);
  }

  currentResult(): DailyResult {
    return {
      gameId: "semantic-gradient",
      dayId: this.state.dayId,
      played: this.state.status === "won" || this.state.foundIds.length > 0,
      solved: this.state.status === "won",
    };
  }

  private persist(): void {
    saveAttempt(this.svc.storage, this.svc.keyFor(`state:${this.state.dayId}`), this.state);
    this.svc.onResult(this.currentResult());
  }

  private cellOfFoundAnswer(cell: number): boolean {
    for (const id of this.state.foundIds) {
      const a = this.puzzle.answers.find((x) => x.id === id);
      if (a && a.path.includes(cell)) return true;
    }
    return false;
  }

  private tapCell(cell: number): void {
    if (this.state.status === "won") return;
    const n = this.trace.length;
    if (n > 0 && this.trace[n - 1] === cell) { this.commitTrace(); return; }       // tap last cell = submit
    if (this.trace.includes(cell)) {                                               // tap earlier cell = backtrack (REQ-008)
      this.trace = this.trace.slice(0, this.trace.indexOf(cell) + 1);
      this.renderGrid();
      return;
    }
    if (n === 0 || areAdjacent(this.trace[n - 1], cell)) {                         // extend (REQ-006/007)
      this.trace.push(cell);
      this.renderGrid();
    } else {
      this.announce("Not adjacent — start a new trace or tap a nearby tile.");
    }
  }

  private commitTrace(): void {
    if (this.trace.length === 0) return;
    const out = submitTrace(this.state, this.puzzle, this.trace);
    const path = this.trace;
    this.trace = [];
    if (out.found && out.error === null) {
      this.state = out.state;
      if (this.state.status === "won") {
        this.stats = recordWon(recordPlayed(this.stats, this.state.dayId), this.state.dayId);
        saveStats(this.svc.storage, this.svc.keyFor("stats"), this.stats);
      }
      this.persist();
      if (out.found.type === "theme" && out.found.band) this.announce(`Theme word — ${BAND_LABEL[out.found.band]} to the hidden word.`);
      else if (out.found.type === "spangram") this.announce("Found the spangram!");
      else this.announce("Bonus word — hint earned.");
    } else if (out.error === "already_found") {
      this.announce("Already found.");
    } else if (out.error === "not_an_answer") {
      this.announce(`No word there (${path.length} tiles). No penalty — try again.`);
    }
    this.render();
  }

  private doHint(): void {
    if (!canSpendHint(this.state)) { this.announce("No hints yet — find a bonus word to earn one."); return; }
    const target = hintTarget(this.state, this.puzzle);
    const out = spendHint(this.state, this.puzzle);
    this.state = out.state;
    this.revealedCell = out.revealed ? out.revealed.path[0] : null;
    this.persist();
    if (out.revealed) {
      const kind = out.revealed.type === "spangram" ? "spangram" : out.revealed.type === "theme" ? "theme word" : "bonus word";
      this.announce(`Hint: a ${kind} starts on the highlighted tile.`);
    }
    void target;
    this.render();
  }

  render(): void {
    const s = this.state;
    this.root.innerHTML = "";
    this.root.className = "game semantic-gradient";
    this.root.append(homeBar(this.svc, "Semantic Gradient"));
    const themeFound = this.puzzle.answers.filter((a) => a.type !== "filler" && s.foundIds.includes(a.id)).length;
    this.root.append(el("p", { class: "sub", text: `${s.dayId} · UTC · ${themeFound}/5 theme words · ${s.hintBalance} hints` }));
    this.root.append(el("p", { class: "help", text: "Trace words along touching tiles. Four words + one 8-letter spanning word all relate to a hidden word — each theme word shows how close it is (🔴 hot … 🟦 cold). Bonus words earn hints." }));

    this.live = liveRegion();
    this.root.append(this.live);

    this.gridHost = el("div", { class: "elt-grid-host" });
    this.root.append(this.gridHost);
    this.renderGrid();

    const controls = el("div", { class: "controls" });
    if (s.status !== "won") {
      const submitBtn = el("button", { text: "Submit trace", class: "btn" }) as HTMLButtonElement;
      submitBtn.type = "button";
      submitBtn.disabled = this.trace.length === 0;
      submitBtn.addEventListener("click", () => this.commitTrace());
      const clearBtn = el("button", { text: "Clear", class: "btn btn-secondary" }) as HTMLButtonElement;
      clearBtn.type = "button";
      clearBtn.disabled = this.trace.length === 0;
      clearBtn.addEventListener("click", () => { this.trace = []; this.renderGrid(); this.render(); });
      const hintBtn = el("button", { text: `Hint (${s.hintBalance})`, class: "btn btn-secondary" }) as HTMLButtonElement;
      hintBtn.type = "button";
      hintBtn.disabled = !canSpendHint(s);                                   // REQ-012
      hintBtn.setAttribute("aria-label", canSpendHint(s) ? `Use a hint, ${s.hintBalance} available` : "Hint unavailable — find a bonus word to earn one");
      hintBtn.addEventListener("click", () => this.doHint());
      controls.append(submitBtn, clearBtn, hintBtn);
    }
    const shareBtn = el("button", { text: "Share", class: `btn${s.status === "won" ? "" : " btn-secondary"}` }) as HTMLButtonElement;
    shareBtn.type = "button";
    shareBtn.addEventListener("click", () => void this.doShare());
    controls.append(shareBtn);
    this.root.append(controls);

    // Temperature legend of found theme words (spoiler-free: band, not the anchor).
    const foundThemes = this.puzzle.answers.filter((a) => a.type === "theme" && s.foundIds.includes(a.id));
    if (foundThemes.length > 0) {
      const legend = el("div", { class: "sg-bands" });
      for (const a of foundThemes) legend.append(el("span", { class: `sg-band sg-${a.band}`, text: `${a.word} · ${BAND_LABEL[a.band!]}` }));
      this.root.append(legend);
    }

    if (s.status === "won") {
      this.root.append(el("p", { class: "win", text: `Solved! The hidden word was “${this.puzzle.anchor}”.` }));
    }
  }

  private gridHost!: HTMLElement;

  private renderGrid(): void {
    if (!this.gridHost) return;
    this.gridHost.innerHTML = "";
    const grid = el("div", { class: "elt-grid" });
    grid.setAttribute("role", "grid");
    grid.setAttribute("aria-label", "Letter grid");
    for (let r = 0; r < ROWS; r++) {
      const rowEl = el("div", { class: "elt-row" });
      rowEl.setAttribute("role", "row");
      for (let c = 0; c < COLS; c++) {
        const cell = r * COLS + c;
        const inTrace = this.trace.includes(cell);
        const found = this.cellOfFoundAnswer(cell);
        const revealed = this.revealedCell === cell;
        const cls = ["elt-cell"];
        if (inTrace) cls.push("in-trace");
        if (found) cls.push("locked");
        if (revealed) cls.push("revealed");
        const btn = el("button", { class: cls.join(" "), text: this.puzzle.letters[cell] }) as HTMLButtonElement;
        btn.type = "button";
        btn.setAttribute("role", "gridcell");
        btn.dataset.cell = String(cell);
        btn.disabled = this.state.status === "won";
        const stateLabel = found ? "found" : inTrace ? `selected position ${this.trace.indexOf(cell) + 1}` : "unselected";
        btn.setAttribute("aria-label", `Row ${r + 1} column ${c + 1}, letter ${this.puzzle.letters[cell]}, ${stateLabel}`);
        btn.addEventListener("click", () => this.tapCell(cell));
        rowEl.append(btn);
      }
      grid.append(rowEl);
    }
    // keyboard: arrow keys move focus between cells; Enter/Space handled by button click.
    grid.addEventListener("keydown", (e) => this.onGridKey(e));
    this.gridHost.append(grid);
    // preserve focus on the last-focused cell after re-render
    if (this.focusCell !== null) {
      const target = grid.querySelector<HTMLButtonElement>(`[data-cell="${this.focusCell}"]`);
      target?.focus();
    }
  }

  private focusCell: number | null = null;

  private onGridKey(e: KeyboardEvent): void {
    const active = document.activeElement as HTMLElement | null;
    const cur = active?.dataset?.cell !== undefined ? Number(active.dataset.cell) : this.focusCell ?? 0;
    let next = cur;
    if (e.key === "ArrowRight") next = cur % COLS === COLS - 1 ? cur : cur + 1;
    else if (e.key === "ArrowLeft") next = cur % COLS === 0 ? cur : cur - 1;
    else if (e.key === "ArrowDown") next = cur + COLS >= ROWS * COLS ? cur : cur + COLS;
    else if (e.key === "ArrowUp") next = cur - COLS < 0 ? cur : cur - COLS;
    else return;
    e.preventDefault();
    this.focusCell = next;
    this.gridHost.querySelector<HTMLButtonElement>(`[data-cell="${next}"]`)?.focus();
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

export const semanticGradientPlugin: GamePlugin = {
  meta: { id: "semantic-gradient", name: "Semantic Gradient", tagline: "Trace words orbiting a hidden meaning — hot to cold.", glyph: "🌡️", accent: "#ff7eb6" },
  contentPackPath: "./semantic-gradient.json",
  async mount(root, services) {
    const game = new SemanticGradient(root, services);
    await game.init("./semantic-gradient.json");
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
