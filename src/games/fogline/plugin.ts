import type { GamePlugin, GameServices, GameInstance, DailyResult } from "../../kit/types.ts";
import { canonicalizeDayId, derivePuzzleId } from "../../kit/selection.ts";
import { loadStats, saveStats, recordPlayed, recordWon, type Stats } from "../../kit/stats.ts";
import { saveAttempt, loadAttempt } from "../../kit/persistence.ts";
import type { AttemptState, Coord, Puzzle } from "./types.ts";
import { initAttempt, applySelection, isRevealed, isSolved, idx } from "./engine.ts";
import { buildShareText, isSpoilerSafe } from "./share.ts";
import { carbonButton, carbonNotification } from "../../kit/carbon.ts";

interface ContentPack {
  contentPackVersion: string;
  datasetId: string;
  puzzleCount: number;
  puzzles: Puzzle[];
}

class Fogline implements GameInstance {
  private pack!: ContentPack;
  private puzzle!: Puzzle;
  private state!: AttemptState;
  private stats!: Stats;
  private live!: HTMLElement;
  private anchor: Coord | null = null;

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
    if (r.puzzleId !== this.puzzle.puzzleId || !Array.isArray(r.revealed)) return null;
    if (r.revealed.length !== this.puzzle.rows * this.puzzle.cols) return null;
    const validIds = new Set(this.puzzle.targets.map((t) => t.id));
    return {
      puzzleId: this.puzzle.puzzleId,
      dayId,
      revealed: r.revealed.map((x) => x === true),
      foundTargetIds: Array.isArray(r.foundTargetIds) ? r.foundTargetIds.filter((id): id is string => typeof id === "string" && validIds.has(id)) : [],
      selectionCount: typeof r.selectionCount === "number" && r.selectionCount >= 0 ? Math.floor(r.selectionCount) : 0,
      isComplete: r.isComplete === true,
    };
  }

  currentResult(): DailyResult {
    return {
      gameId: "fogline",
      dayId: this.state.dayId,
      played: this.state.selectionCount > 0 || this.state.isComplete,
      solved: isSolved(this.state, this.puzzle),
    };
  }

  private persist(): void {
    saveAttempt(this.svc.storage, this.svc.keyFor(`state:${this.state.dayId}`), this.state);
    this.svc.onResult(this.currentResult());
  }

  render(): void {
    const done = isSolved(this.state, this.puzzle);
    this.root.innerHTML = "";
    this.root.className = "game fogline";
    this.root.append(homeBar(this.svc, "Fogline"));
    this.root.append(
      el("p", { class: "sub", text: `${this.state.dayId} · UTC · ${this.state.foundTargetIds.length}/${this.puzzle.targets.length} found · ${this.state.selectionCount} selections` }),
      el("p", { class: "help", text: "Most of the grid is fogged. Find words in the clear to make the fog recede — each find reveals more letters. You can't select into the fog." }),
    );

    this.live = liveRegion();
    this.root.append(this.live);
    this.root.append(this.buildGrid());

    if (done) {
      this.root.append(carbonNotification("Fog lifted!", `Cleared all ${this.puzzle.targets.length} words in ${this.state.selectionCount} selections.`, "success"));
    } else if (this.anchor) {
      this.root.append(carbonNotification("Selecting", `Start at row ${this.anchor.row + 1}, col ${this.anchor.col + 1}. Pick the end cell.`, "info"));
    }

    const controls = el("div", { class: "controls" });
    controls.append(carbonButton({ text: "Share", kind: "secondary", disabled: !done, onClick: () => void this.doShare() }));
    this.root.append(controls);
  }

  private buildGrid(): HTMLElement {
    const foundCells = new Set<number>();
    for (const t of this.puzzle.targets) {
      if (!this.state.foundTargetIds.includes(t.id)) continue;
      for (let i = 0; i < t.word.length; i++) foundCells.add(idx({ row: t.start.row + t.dir.row * i, col: t.start.col + t.dir.col * i }, this.puzzle));
    }
    const grid = el("div", { class: "fg-grid" });
    grid.style.gridTemplateColumns = `repeat(${this.puzzle.cols}, 1fr)`;
    grid.setAttribute("role", "grid");
    grid.setAttribute("aria-label", "Foggy letter grid — find words in the revealed cells");
    for (let r = 0; r < this.puzzle.rows; r++) {
      for (let c = 0; c < this.puzzle.cols; c++) {
        const here = { row: r, col: c };
        const revealed = isRevealed(this.state, this.puzzle, here);
        const letter = this.puzzle.grid[r][c];
        const cell = carbonButton({
          text: revealed ? letter : "·",
          kind: "ghost",
          size: "sm",
          ariaLabel: revealed ? `Row ${r + 1} column ${c + 1}, revealed, letter ${letter}` : `Row ${r + 1} column ${c + 1}, fogged`,
          disabled: !revealed || isSolved(this.state, this.puzzle),
          onClick: () => this.onCell(here),
        });
        cell.classList.add("fg-cell");
        if (!revealed) cell.classList.add("fg-fogged");
        if (foundCells.has(idx(here, this.puzzle))) cell.classList.add("fg-found");
        if (this.anchor && this.anchor.row === r && this.anchor.col === c) cell.classList.add("fg-anchor");
        cell.setAttribute("role", "gridcell");
        grid.append(cell);
      }
    }
    return grid;
  }

  private onCell(cell: Coord): void {
    if (isSolved(this.state, this.puzzle)) return;
    if (this.anchor === null) {
      this.anchor = cell;
      this.render();
      this.announce(`Start at row ${cell.row + 1}, column ${cell.col + 1}. Now choose the end cell.`);
      return;
    }
    if (this.anchor.row === cell.row && this.anchor.col === cell.col) {
      this.anchor = null;
      this.render();
      this.announce("Selection cancelled.");
      return;
    }
    const start = this.anchor;
    this.anchor = null;
    const out = applySelection(this.state, this.puzzle, start, cell);
    this.state = out.state;

    switch (out.resolution.matchType) {
      case "FOUND":
        this.announce("Found a word — the fog recedes.");
        break;
      case "BLOCKED_BY_FOG":
        this.announce("Selection blocked by fog.");
        break;
      case "ALREADY_FOUND":
        this.announce("Already found.");
        break;
      default:
        this.announce("No word on that line.");
    }

    if (this.state.isComplete) {
      this.stats = recordWon(recordPlayed(this.stats, this.state.dayId), this.state.dayId);
      saveStats(this.svc.storage, this.svc.keyFor("stats"), this.stats);
    }
    this.persist();
    this.render();
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

export const foglinePlugin: GamePlugin = {
  meta: { id: "fogline", name: "Fogline", tagline: "Find words in the clear to make the fog recede.", glyph: "🌫️", accent: "#a56eff" },
  contentPackPath: "./fogline.json",
  async mount(root, services) {
    const game = new Fogline(root, services);
    await game.init("./fogline.json");
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
