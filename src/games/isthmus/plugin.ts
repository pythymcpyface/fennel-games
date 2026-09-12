import type { GamePlugin, GameServices, GameInstance, DailyResult } from "../../kit/types.ts";
import { canonicalizeDayId, derivePuzzleId } from "../../kit/selection.ts";
import { loadStats, saveStats, recordPlayed, recordWon, type Stats } from "../../kit/stats.ts";
import { saveAttempt, loadAttempt } from "../../kit/persistence.ts";
import type { AttemptState, Coord, Puzzle, ValidationStatus } from "./types.ts";
import { initAttempt, submit, extend, undo, clearPath, sameCoord, spelledText, canSubmit } from "./engine.ts";
import { buildShareText, isSpoilerSafe } from "./share.ts";
import { carbonButton } from "../../kit/carbon.ts";

interface ContentPack {
  contentPackVersion: string;
  datasetId: string;
  puzzleCount: number;
  dictionary: string[];
  puzzles: Puzzle[];
}

const STATUS_MSG: Record<ValidationStatus, string> = {
  EMPTY: "Select tiles from the top edge to the bottom edge.",
  NOT_ADJACENT: "Tiles must connect (including diagonals).",
  REUSED_TILE: "You can't reuse a tile.",
  NOT_SHORE_TO_SHORE: "Path must start on the top edge and end on the bottom.",
  NOT_A_WORD: "That path doesn't spell a word.",
  VALID: "Bridged! The shores are connected.",
};

class Isthmus implements GameInstance {
  private pack!: ContentPack;
  private dictionary!: Set<string>;
  private puzzle!: Puzzle;
  private state!: AttemptState;
  private stats!: Stats;
  private live!: HTMLElement;
  private cursor: Coord = { row: 0, col: 0 };

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
    return { gameId: "isthmus", dayId: this.state.dayId, played: this.state.attempts > 0 || this.state.isSolved, solved: this.state.isSolved };
  }

  private persist(): void {
    saveAttempt(this.svc.storage, this.svc.keyFor(`state:${this.state.dayId}`), this.state);
    this.svc.onResult(this.currentResult());
  }

  private inPath(c: Coord): number {
    return this.state.path.findIndex((p) => sameCoord(p, c));
  }

  render(): void {
    const s = this.state;
    const done = s.isSolved;
    this.root.innerHTML = "";
    this.root.className = "game isthmus";
    this.root.append(homeBar(this.svc, "Isthmus"));
    this.root.append(
      el("p", { class: "sub", text: `${s.dayId} · UTC · ${s.attempts} tries` }),
      el("p", { class: "help", text: "Trace a word from the TOP edge to the BOTTOM edge; tiles connect in any of 8 directions." }),
    );
    this.live = liveRegion();
    this.root.append(this.live);

    const grid = el("div", { class: "isth-grid" });
    grid.style.gridTemplateColumns = `repeat(${this.puzzle.cols}, 1fr)`;
    grid.setAttribute("role", "grid");
    grid.setAttribute("aria-label", "Letter board; top and bottom rows are the shores");
    for (let r = 0; r < this.puzzle.rows; r++) {
      for (let c = 0; c < this.puzzle.cols; c++) {
        const coord = { row: r, col: c };
        const idx = this.inPath(coord);
        const shore = r === 0 ? " top-shore" : r === this.puzzle.rows - 1 ? " bottom-shore" : "";
        const inPath = idx >= 0 ? " in-path" : "";
        const btn = el("button", { class: `isth-tile${shore}${inPath}`, text: this.puzzle.grid[r][c] }) as HTMLButtonElement;
        btn.type = "button";
        btn.disabled = done;
        const order = idx >= 0 ? `, step ${idx + 1}` : "";
        const shoreLabel = r === 0 ? ", top shore" : r === this.puzzle.rows - 1 ? ", bottom shore" : "";
        btn.setAttribute("aria-label", `Row ${r + 1} column ${c + 1}: ${this.puzzle.grid[r][c]}${shoreLabel}${order}`);
        btn.setAttribute("aria-pressed", String(idx >= 0));
        btn.tabIndex = sameCoord(this.cursor, coord) ? 0 : -1;
        btn.addEventListener("click", () => this.tapTile(coord));
        btn.addEventListener("keydown", (e) => this.onKey(e, coord));
        grid.append(btn);
      }
    }
    this.root.append(grid);

    const preview = el("p", { class: "isth-preview", text: spelledText(s.path, this.puzzle.grid) || "—" });
    preview.setAttribute("aria-label", `Current path spells ${spelledText(s.path, this.puzzle.grid) || "nothing yet"}`);
    this.root.append(preview);

    const controls = el("div", { class: "controls" });
    const submitBtn = btn2("Submit", done, () => this.trySubmit());
    const undoBtn = btn2("Undo", done || s.path.length === 0, () => { this.state = undo(this.state); this.persist(); this.render(); }, true);
    const clearBtn = btn2("Clear", done || s.path.length === 0, () => { this.state = clearPath(this.state); this.persist(); this.render(); }, true);
    const shareBtn = btn2("Share", false, () => void this.doShare(), true);
    controls.append(submitBtn, undoBtn, clearBtn, shareBtn);
    this.root.append(controls);

    if (s.isSolved) this.root.append(el("p", { class: "win", text: `Bridged in ${s.attempts} tries!` }));
  }

  private tapTile(coord: Coord): void {
    this.cursor = coord;
    const idx = this.inPath(coord);
    if (idx >= 0 && idx === this.state.path.length - 1) {
      // tapping the current last tile removes it (undo)
      this.state = undo(this.state);
    } else {
      this.state = extend(this.state, coord, this.puzzle);
    }
    this.persist();
    this.render();
    this.focusCursor();
  }

  private onKey(e: KeyboardEvent, coord: Coord): void {
    const moves: Record<string, [number, number]> = {
      ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1],
    };
    if (moves[e.key]) {
      e.preventDefault();
      const [dr, dc] = moves[e.key];
      const nr = Math.min(this.puzzle.rows - 1, Math.max(0, coord.row + dr));
      const nc = Math.min(this.puzzle.cols - 1, Math.max(0, coord.col + dc));
      this.cursor = { row: nr, col: nc };
      this.render();
      this.focusCursor();
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      this.tapTile(coord);
    }
  }

  private focusCursor(): void {
    queueMicrotask(() => {
      const tiles = this.root.querySelectorAll<HTMLButtonElement>(".isth-tile");
      const i = this.cursor.row * this.puzzle.cols + this.cursor.col;
      tiles[i]?.focus();
    });
  }

  private trySubmit(): void {
    if (!canSubmit(this.state)) return;
    const out = submit(this.state, this.puzzle, this.dictionary);
    this.state = out.state;
    if (this.state.isSolved) {
      this.stats = recordWon(recordPlayed(this.stats, this.state.dayId), this.state.dayId);
      saveStats(this.svc.storage, this.svc.keyFor("stats"), this.stats);
    } else if (this.state.attempts === 1) {
      this.stats = recordPlayed(this.stats, this.state.dayId);
      saveStats(this.svc.storage, this.svc.keyFor("stats"), this.stats);
    }
    this.persist();
    this.render();
    this.announce(STATUS_MSG[out.status]);
  }

  private async doShare(): Promise<void> {
    const solutionWord = spelledText(this.puzzle.solution, this.puzzle.grid);
    const text = buildShareText(this.state, this.state.dayId);
    if (!isSpoilerSafe(text, [solutionWord])) return this.announce("Sharing blocked.");
    const res = await this.svc.share.share(text);
    this.announce(res.ok ? (res.method === "clipboard" ? "Copied." : "Shared.") : "Sharing unavailable.");
  }

  private announce(msg: string): void {
    if (this.live) this.live.textContent = msg;
  }
}

export const isthmusPlugin: GamePlugin = {
  meta: { id: "isthmus", name: "Isthmus", tagline: "Bridge the shores with one word-path.", glyph: "🌉", accent: "#33b1ff" },
  contentPackPath: "./isthmus.json",
  async mount(root, services) {
    const game = new Isthmus(root, services);
    await game.init("./isthmus.json");
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
function btn2(label: string, disabled: boolean, onClick: () => void, secondary = false): HTMLElement {
  return carbonButton({ text: label, kind: secondary ? "secondary" : "primary", disabled, onClick });
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
