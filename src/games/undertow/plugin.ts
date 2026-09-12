import type { GamePlugin, GameServices, GameInstance, DailyResult } from "../../kit/types.ts";
import { canonicalizeDayId, derivePuzzleId } from "../../kit/selection.ts";
import { loadStats, saveStats, recordPlayed, recordWon, type Stats } from "../../kit/stats.ts";
import { saveAttempt, loadAttempt } from "../../kit/persistence.ts";
import type { AttemptState, Coord, Puzzle } from "./types.ts";
import { initAttempt, applySelection, cellsBetween, isSolved, allFound } from "./engine.ts";
import { buildShareText, isSpoilerSafe } from "./share.ts";
import { carbonButton, carbonNotification } from "../../kit/carbon.ts";

interface ContentPack {
  contentPackVersion: string;
  datasetId: string;
  puzzleCount: number;
  puzzles: Puzzle[];
}

class Undertow implements GameInstance {
  private pack!: ContentPack;
  private puzzle!: Puzzle;
  private state!: AttemptState;
  private stats!: Stats;
  private live!: HTMLElement;
  private anchor: Coord | null = null; // first-clicked cell of a pending selection

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
    if (r.puzzleId !== this.puzzle.puzzleId || !Array.isArray(r.foundTargetIds)) return null;
    const validIds = new Set(this.puzzle.targets.map((t) => t.id));
    const foundTargetIds = r.foundTargetIds.filter((id): id is string => typeof id === "string" && validIds.has(id));
    const mistakeCount = typeof r.mistakeCount === "number" && r.mistakeCount >= 0 ? Math.floor(r.mistakeCount) : 0;
    return { puzzleId: this.puzzle.puzzleId, dayId, foundTargetIds, mistakeCount, isComplete: r.isComplete === true };
  }

  currentResult(): DailyResult {
    return {
      gameId: "undertow",
      dayId: this.state.dayId,
      played: this.state.foundTargetIds.length > 0 || this.state.isComplete,
      solved: isSolved(this.state, this.puzzle),
    };
  }

  private persist(): void {
    saveAttempt(this.svc.storage, this.svc.keyFor(`state:${this.state.dayId}`), this.state);
    this.svc.onResult(this.currentResult());
  }

  private foundCells(): Set<string> {
    const set = new Set<string>();
    for (const t of this.puzzle.targets) {
      if (!this.state.foundTargetIds.includes(t.id)) continue;
      const cells = cellsBetween(t.start, t.end);
      cells?.forEach((c) => set.add(`${c.row},${c.col}`));
    }
    return set;
  }

  render(): void {
    const solved = isSolved(this.state, this.puzzle);
    const done = allFound(this.state, this.puzzle);
    this.root.innerHTML = "";
    this.root.className = "game undertow";
    this.root.append(homeBar(this.svc, "Undertow"));
    this.root.append(
      el("p", { class: "sub", text: `${this.state.dayId} · UTC · ${this.state.foundTargetIds.length}/${this.puzzle.targets.length} found · ${this.state.mistakeCount} mistakes` }),
      el("p", { class: "help", text: "Every hidden word is spelled BACKWARDS. Select a straight line to read it in reverse. Beware forward words — they're false currents (mistakes)." }),
    );

    this.live = liveRegion();
    this.root.append(this.live);
    this.root.append(this.buildGrid());

    if (done) {
      this.root.append(
        carbonNotification(
          solved ? "All currents found!" : "Complete",
          `Found ${this.state.foundTargetIds.length}/${this.puzzle.targets.length} with ${this.state.mistakeCount} mistake(s).`,
          solved ? "success" : "info",
        ),
      );
    } else if (this.anchor) {
      this.root.append(carbonNotification("Selecting", `Start cell set at row ${this.anchor.row + 1}, col ${this.anchor.col + 1}. Pick the end cell.`, "info"));
    }

    const controls = el("div", { class: "controls" });
    controls.append(carbonButton({ text: "Share", kind: "secondary", disabled: !done, onClick: () => void this.doShare() }));
    this.root.append(controls);
  }

  private buildGrid(): HTMLElement {
    const found = this.foundCells();
    const grid = el("div", { class: "ut-grid" });
    grid.style.gridTemplateColumns = `repeat(${this.puzzle.cols}, 1fr)`;
    grid.setAttribute("role", "grid");
    grid.setAttribute("aria-label", "Letter grid — select a straight line to read a word backwards");
    for (let r = 0; r < this.puzzle.rows; r++) {
      for (let c = 0; c < this.puzzle.cols; c++) {
        const key = `${r},${c}`;
        const letter = this.puzzle.grid[r][c];
        const cell = carbonButton({
          text: letter,
          kind: "ghost",
          size: "sm",
          ariaLabel: `Row ${r + 1} column ${c + 1}, letter ${letter}`,
          disabled: allFound(this.state, this.puzzle),
          onClick: () => this.onCell({ row: r, col: c }),
        });
        cell.classList.add("ut-cell");
        if (found.has(key)) cell.classList.add("ut-found");
        if (this.anchor && this.anchor.row === r && this.anchor.col === c) cell.classList.add("ut-anchor");
        cell.setAttribute("role", "gridcell");
        grid.append(cell);
      }
    }
    return grid;
  }

  private onCell(cell: Coord): void {
    if (allFound(this.state, this.puzzle)) return;
    if (this.anchor === null) {
      this.anchor = cell;
      this.render();
      this.announce(`Start at row ${cell.row + 1}, column ${cell.col + 1}. Now choose the end cell.`);
      return;
    }
    if (this.anchor.row === cell.row && this.anchor.col === cell.col) {
      this.anchor = null; // cancel
      this.render();
      this.announce("Selection cancelled.");
      return;
    }
    const start = this.anchor;
    this.anchor = null;
    const out = applySelection(this.state, this.puzzle, start, cell);
    this.state = out.state;

    switch (out.resolution.matchType) {
      case "TARGET_MATCH":
        this.announce("Found a reversed word.");
        break;
      case "DECOY_MATCH":
        this.announce("False current — that's a forward word. Mistake.");
        break;
      case "ALREADY_FOUND":
        this.announce("Already found.");
        break;
      default:
        this.announce("No word on that line.");
    }

    if (allFound(this.state, this.puzzle) && !this.state.isComplete) {
      this.state = { ...this.state, isComplete: true };
    }
    if (this.state.isComplete) {
      this.stats = isSolved(this.state, this.puzzle)
        ? recordWon(recordPlayed(this.stats, this.state.dayId), this.state.dayId)
        : recordPlayed(this.stats, this.state.dayId);
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

export const undertowPlugin: GamePlugin = {
  meta: { id: "undertow", name: "Undertow", tagline: "Every word runs backwards — find the reversed currents.", glyph: "🌊", accent: "#33b1ff" },
  contentPackPath: "./undertow.json",
  async mount(root, services) {
    const game = new Undertow(root, services);
    await game.init("./undertow.json");
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
