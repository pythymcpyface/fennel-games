import type { GamePlugin, GameServices, GameInstance, DailyResult } from "../../kit/types.ts";
import { canonicalizeDayId, derivePuzzleId } from "../../kit/selection.ts";
import { loadStats, saveStats, recordPlayed, recordWon, type Stats } from "../../kit/stats.ts";
import { saveAttempt, loadAttempt } from "../../kit/persistence.ts";
import type { AttemptState, Puzzle } from "./types.ts";
import {
  initAttempt,
  select,
  entryStatus,
  correctCount,
  totalEntries,
  isSolved,
} from "./engine.ts";
import { buildShareText, isSpoilerSafe } from "./share.ts";
import { carbonButton, carbonNotification } from "../../kit/carbon.ts";

interface ContentPack {
  contentPackVersion: string;
  datasetId: string;
  puzzleCount: number;
  puzzles: Puzzle[];
}

class Clueback implements GameInstance {
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

  /** Clamp a loaded state to the current puzzle shape (RISK-008). */
  private repair(raw: unknown, dayId: string): AttemptState | null {
    if (typeof raw !== "object" || raw === null) return null;
    const r = raw as Partial<AttemptState>;
    if (r.puzzleId !== this.puzzle.puzzleId || !Array.isArray(r.selections)) return null;
    if (r.selections.length !== this.puzzle.entries.length) return null;
    const selections = r.selections.map((s) => (s === null || (typeof s === "number" && s >= 0 && s < 3) ? s : null));
    return {
      puzzleId: this.puzzle.puzzleId,
      dayId,
      selections,
      isComplete: selections.every((s) => s !== null),
    };
  }

  currentResult(): DailyResult {
    return {
      gameId: "clueback",
      dayId: this.state.dayId,
      played: this.state.isComplete,
      solved: this.state.isComplete && isSolved(this.state, this.puzzle),
    };
  }

  private persist(): void {
    saveAttempt(this.svc.storage, this.svc.keyFor(`state:${this.state.dayId}`), this.state);
    this.svc.onResult(this.currentResult());
  }

  render(): void {
    const s = this.state;
    const done = s.isComplete;
    this.root.innerHTML = "";
    this.root.className = "game clueback";
    this.root.append(homeBar(this.svc, "Clueback"));
    const answered = s.selections.filter((x) => x !== null).length;
    this.root.append(
      el("p", { class: "sub", text: `${s.dayId} · UTC · ${answered}/${totalEntries(this.puzzle)} answered` }),
      el("p", { class: "help", text: "The crossword is already solved. Each answer is missing its clue — pick the real clue from the three. Choices lock in." }),
    );

    this.live = liveRegion();
    this.root.append(this.live);

    const list = el("div", { class: "cb-entries" });
    list.setAttribute("role", "list");
    this.puzzle.entries.forEach((_entry, i) => {
      list.append(this.buildEntry(i));
    });
    this.root.append(list);

    if (done) {
      const correct = correctCount(this.state, this.puzzle);
      const total = totalEntries(this.puzzle);
      const solved = isSolved(this.state, this.puzzle);
      this.root.append(
        carbonNotification(
          solved ? "Clean sweep!" : "Complete",
          `You matched ${correct}/${total} clues.`,
          solved ? "success" : "info",
        ),
      );
    }

    const controls = el("div", { class: "controls" });
    controls.append(carbonButton({ text: "Share", kind: "secondary", disabled: !done, onClick: () => void this.doShare() }));
    this.root.append(controls);
  }

  private buildEntry(index: number): HTMLElement {
    const entry = this.puzzle.entries[index];
    const status = entryStatus(this.state, this.puzzle, index);
    const answered = this.state.selections[index] !== null;

    const row = el("div", { class: `cb-entry cb-${status}` });
    row.setAttribute("role", "listitem");

    // The solved answer chip (always shown — this is the reverse-crossword twist).
    const head = el("div", { class: "cb-answer-row" });
    const ans = el("span", { class: "cb-answer", text: entry.answer });
    ans.setAttribute("aria-label", `Answer ${index + 1}: ${entry.answer.split("").join(" ")}`);
    head.append(ans);
    if (answered) {
      head.append(el("span", { class: "cb-mark", text: status === "answered_correct" ? "🟩 correct" : "⬛ wrong" }));
    }
    row.append(head);

    // The three candidate clues as a radiogroup of buttons.
    const group = el("div", { class: "cb-clues" });
    group.setAttribute("role", "radiogroup");
    group.setAttribute("aria-label", `Pick the real clue for ${entry.answer}`);
    entry.candidates.forEach((clue, ci) => {
      const chosen = this.state.selections[index] === ci;
      const isCorrect = ci === entry.correctIndex;
      const cls = ["cb-clue"];
      if (answered) {
        if (isCorrect) cls.push("cb-clue-correct");
        else if (chosen) cls.push("cb-clue-wrong");
      } else if (chosen) {
        cls.push("cb-clue-chosen");
      }
      const btn = carbonButton({
        text: clue,
        kind: chosen ? "primary" : "secondary",
        disabled: answered,
        onClick: () => this.trySelect(index, ci),
      });
      btn.classList.add(...cls);
      btn.setAttribute("role", "radio");
      btn.setAttribute("aria-checked", chosen ? "true" : "false");
      group.append(btn);
    });
    row.append(group);
    return row;
  }

  private trySelect(entryIndex: number, clueIndex: number): void {
    const out = select(this.state, this.puzzle, entryIndex, clueIndex);
    if (!out.accepted) return;
    this.state = out.state;
    const wasCorrect = clueIndex === this.puzzle.entries[entryIndex].correctIndex;

    if (this.state.isComplete) {
      const solved = isSolved(this.state, this.puzzle);
      this.stats = solved
        ? recordWon(recordPlayed(this.stats, this.state.dayId), this.state.dayId)
        : recordPlayed(this.stats, this.state.dayId);
      saveStats(this.svc.storage, this.svc.keyFor("stats"), this.stats);
    }
    this.persist();
    this.render();
    this.announce(
      this.state.isComplete
        ? `Complete. ${correctCount(this.state, this.puzzle)} of ${totalEntries(this.puzzle)} correct.`
        : wasCorrect
          ? "Correct clue."
          : "That wasn't the real clue.",
    );
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

export const cluebackPlugin: GamePlugin = {
  meta: { id: "clueback", name: "Clueback", tagline: "The grid's solved — find each answer's real clue.", glyph: "🧩", accent: "#4589ff" },
  contentPackPath: "./clueback.json",
  async mount(root, services) {
    const game = new Clueback(root, services);
    await game.init("./clueback.json");
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
