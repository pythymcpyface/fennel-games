import type { GamePlugin, GameServices, GameInstance, DailyResult } from "../../kit/types.ts";
import { canonicalizeDayId, derivePuzzleId } from "../../kit/selection.ts";
import { loadStats, saveStats, recordPlayed, recordWon, type Stats } from "../../kit/stats.ts";
import { saveAttempt, loadAttempt } from "../../kit/persistence.ts";
import type { AttemptState, AuditResult, Puzzle } from "./types.ts";
import { initAttempt, toggleFlag, submit, scoreAudit, canSubmit } from "./engine.ts";
import { buildShareText, isSpoilerSafe } from "./share.ts";
import { carbonButton, carbonNotification } from "../../kit/carbon.ts";

interface ContentPack {
  contentPackVersion: string;
  datasetId: string;
  puzzleCount: number;
  puzzles: Puzzle[];
}

class FaultLines implements GameInstance {
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
    const saved = loadAttempt<AttemptState>(this.svc.storage, this.svc.keyFor(`state:${dayId}`), (raw) => this.repair(raw, dayId));
    this.state = saved ?? initAttempt(this.puzzle, dayId);
  }

  private repair(raw: unknown, dayId: string): AttemptState | null {
    if (typeof raw !== "object" || raw === null) return null;
    const r = raw as Partial<AttemptState>;
    if (r.puzzleId !== this.puzzle.puzzleId || !Array.isArray(r.flags)) return null;
    if (r.flags.length !== this.puzzle.entries.length) return null;
    const flags = r.flags.map((f) => f === true);
    return { puzzleId: this.puzzle.puzzleId, dayId, flags, isComplete: r.isComplete === true };
  }

  currentResult(): DailyResult {
    const solved = this.state.isComplete && scoreAudit(this.state, this.puzzle).solved;
    return { gameId: "fault-lines", dayId: this.state.dayId, played: this.state.isComplete, solved };
  }

  private persist(): void {
    saveAttempt(this.svc.storage, this.svc.keyFor(`state:${this.state.dayId}`), this.state);
    this.svc.onResult(this.currentResult());
  }

  render(): void {
    const done = this.state.isComplete;
    const result = done ? scoreAudit(this.state, this.puzzle) : null;
    this.root.innerHTML = "";
    this.root.className = "game fault-lines";
    this.root.append(homeBar(this.svc, "Fault Lines"));
    const flagged = this.state.flags.filter(Boolean).length;
    this.root.append(
      el("p", { class: "sub", text: `${this.state.dayId} · UTC · ${this.puzzle.faultCount} faults planted · ${flagged} flagged` }),
      el("p", { class: "help", text: "This crossword is already filled in — but some answers are wrong. Flag every entry you think is a fault, then submit. False accusations cost you." }),
    );

    this.live = liveRegion();
    this.root.append(this.live);

    this.root.append(this.buildGrid(result));
    this.root.append(this.buildEntryList(done, result));

    if (done && result) {
      this.root.append(
        carbonNotification(
          result.solved ? "Perfect audit!" : "Complete",
          `Score ${result.score >= 0 ? "+" : ""}${result.score} · found ${result.correctFlags}/${this.puzzle.faultCount} faults, ${result.falseAccusations} false accusation(s).`,
          result.solved ? "success" : "info",
        ),
      );
    }

    const controls = el("div", { class: "controls" });
    if (!done) controls.append(carbonButton({ text: "Submit audit", onClick: () => this.trySubmit() }));
    controls.append(carbonButton({ text: "Share", kind: "secondary", disabled: !done, onClick: () => void this.doShare() }));
    this.root.append(controls);
  }

  private buildGrid(result: AuditResult | null): HTMLElement {
    const grid = el("div", { class: "fl-grid" });
    grid.style.gridTemplateColumns = `repeat(${this.puzzle.cols}, 1fr)`;
    grid.setAttribute("role", "img");
    grid.setAttribute("aria-label", "Filled crossword grid under audit");
    // Map each non-faulty/faulty cell for post-submit tinting.
    const faultyCells = new Set<number>();
    if (result) {
      this.puzzle.entries.forEach((e, i) => {
        if (this.state.flags[i]) e.cells.forEach((c) => faultyCells.add(c));
      });
    }
    for (let i = 0; i < this.puzzle.rows * this.puzzle.cols; i++) {
      const cell = el("div", { class: "fl-cell" });
      if (this.puzzle.blocks[i]) {
        cell.classList.add("fl-block");
      } else {
        cell.textContent = this.puzzle.letters[i];
        if (result && faultyCells.has(i)) cell.classList.add("fl-cell-flagged");
      }
      grid.append(cell);
    }
    return grid;
  }

  private buildEntryList(done: boolean, result: AuditResult | null): HTMLElement {
    const list = el("div", { class: "fl-entries" });
    list.setAttribute("role", "group");
    list.setAttribute("aria-label", "Crossword entries to audit");
    this.puzzle.entries.forEach((entry, i) => {
      const flagged = this.state.flags[i];
      const row = el("div", { class: "fl-entry" });
      if (done && result) {
        row.classList.add(result.correctnessByEntry[i] ? "fl-judged-right" : "fl-judged-wrong");
      }
      const label = el("div", { class: "fl-entry-label" });
      label.append(
        el("span", { class: "fl-entry-num", text: `${entry.number}${entry.direction === "ACROSS" ? "A" : "D"}` }),
        el("span", { class: "fl-entry-answer", text: entry.displayedAnswer }),
        el("span", { class: "fl-entry-clue", text: entry.clue }),
      );
      row.append(label);

      const btn = carbonButton({
        text: done ? (flagged ? "Flagged" : "OK") : flagged ? "Flagged as fault" : "Flag as fault",
        kind: flagged ? "danger" : "secondary",
        disabled: done,
        ariaLabel: `${flagged ? "Unflag" : "Flag"} ${entry.number} ${entry.direction === "ACROSS" ? "across" : "down"} as a fault`,
        onClick: () => this.tryToggle(i),
      });
      btn.setAttribute("role", "switch");
      btn.setAttribute("aria-checked", flagged ? "true" : "false");
      row.append(btn);
      list.append(row);
    });
    return list;
  }

  private tryToggle(entryIndex: number): void {
    const out = toggleFlag(this.state, this.puzzle, entryIndex);
    if (!out.accepted) {
      if (out.reason === "complete") this.announce("The audit is locked.");
      return;
    }
    this.state = out.state;
    this.persist();
    this.render();
    const e = this.puzzle.entries[entryIndex];
    this.announce(`${e.number} ${e.direction === "ACROSS" ? "across" : "down"} ${this.state.flags[entryIndex] ? "flagged as a fault" : "unflagged"}.`);
  }

  private trySubmit(): void {
    if (!canSubmit(this.state)) return;
    const out = submit(this.state, this.puzzle);
    if (!out.accepted || !out.result) return;
    this.state = out.state;
    this.stats = out.result.solved
      ? recordWon(recordPlayed(this.stats, this.state.dayId), this.state.dayId)
      : recordPlayed(this.stats, this.state.dayId);
    saveStats(this.svc.storage, this.svc.keyFor("stats"), this.stats);
    this.persist();
    this.render();
    this.announce(`Audit submitted. Score ${out.result.score}. Found ${out.result.correctFlags} of ${this.puzzle.faultCount} faults.`);
  }

  private async doShare(): Promise<void> {
    const result = scoreAudit(this.state, this.puzzle);
    const text = buildShareText(result, this.puzzle, this.state.dayId);
    if (!isSpoilerSafe(text, this.puzzle)) return this.announce("Sharing blocked.");
    const res = await this.svc.share.share(text);
    this.announce(res.ok ? (res.method === "clipboard" ? "Copied." : "Shared.") : "Sharing unavailable.");
  }

  private announce(msg: string): void {
    if (this.live) this.live.textContent = msg;
  }
}

export const faultLinesPlugin: GamePlugin = {
  meta: { id: "fault-lines", name: "Fault Lines", tagline: "The grid's filled in — but some answers are wrong. Spot the faults.", glyph: "🔍", accent: "#ff832b" },
  contentPackPath: "./fault-lines.json",
  async mount(root, services) {
    const game = new FaultLines(root, services);
    await game.init("./fault-lines.json");
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
