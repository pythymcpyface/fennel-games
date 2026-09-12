import type { GamePlugin, GameServices, GameInstance, DailyResult } from "../../kit/types.ts";
import { canonicalizeDayId } from "../../kit/selection.ts";
import { resolveDailyPuzzleIndex } from "../../kit/dev.ts";
import { loadStats, saveStats, recordPlayed, recordWon, type Stats } from "../../kit/stats.ts";
import { saveAttempt, loadAttempt } from "../../kit/persistence.ts";
import type { GameState, Puzzle, RankTable, Verdict } from "./types.ts";
import { normalizeGuess, evaluateGuess, reduceGameState, initGameState } from "./engine.ts";
import { validateGuess } from "./validate.ts";
import { selectHint } from "./hint.ts";
import { buildShareText, isSpoilerSafe } from "./share.ts";

interface ContentPack {
  contentPackVersion: string;
  dictionaryId: string;
  puzzleCount: number;
  /** Rank-table universe: bounded pool each rank table ranks against. */
  vocabulary: string[];
  /**
   * Large en-GB validation dictionary for accepting guesses. Decoupled from
   * `vocabulary` (the rank-table universe) so real words validate without
   * bloating O(targets x universe) rank tables. Falls back to `vocabulary`.
   */
  acceptList?: string[];
  puzzles: Record<string, Puzzle>;
  rankTables: Record<string, RankTable>;
}

const VERDICT_LABEL: Record<Verdict, string> = {
  best: "Warmest — you found it!",
  warmer: "Warmer",
  colder: "Colder",
  equal: "Same",
};
const VERDICT_ICON: Record<Verdict, string> = { best: "★", warmer: "▲", colder: "▼", equal: "＝" };

class Ladderless implements GameInstance {
  private pack!: ContentPack;
  private dictionary!: Set<string>;
  private puzzle!: Puzzle;
  private table!: RankTable;
  private state!: GameState;
  private stats!: Stats;
  private live!: HTMLElement;
  private errorMsg = "";

  constructor(private readonly root: HTMLElement, private readonly svc: GameServices) {}

  async init(packPath: string): Promise<void> {
    this.pack = JSON.parse(await this.svc.assets.loadText(packPath)) as ContentPack;
    this.dictionary = new Set(this.pack.acceptList ?? this.pack.vocabulary);
    this.stats = loadStats(this.svc.storage, this.svc.keyFor("stats"));
    const dayId = canonicalizeDayId(this.svc.clock.nowMs(), "UTC");
    const puzzleIds = Object.keys(this.pack.puzzles).sort();
    const idx = resolveDailyPuzzleIndex(
      "ladderless", dayId, this.pack.contentPackVersion, this.pack.dictionaryId, this.pack.puzzleCount,
      { read: (k) => this.svc.storage.read(k) },
      (word) => puzzleIds.findIndex((id) => {
        const p = this.pack.puzzles[id];
        const w = word.toLowerCase();
        return p.startWord === w || p.targetWord === w;
      }),
    );
    const puzzleId = puzzleIds[idx] ?? puzzleIds[0];
    this.puzzle = this.pack.puzzles[puzzleId];
    this.table = this.pack.rankTables[this.puzzle.targetWord];
    const saved = loadAttempt<GameState>(this.svc.storage, this.svc.keyFor(`state:${dayId}`), (raw) => raw as GameState);
    this.state = saved ?? initGameState(puzzleId, dayId, this.table.vocabSize);
  }

  currentResult(): DailyResult {
    return {
      gameId: "ladderless",
      dayId: this.state.dayId,
      played: this.state.guessHistory.length > 0 || this.state.status !== "not_started",
      solved: this.state.status === "won",
    };
  }

  private persist(): void {
    saveAttempt(this.svc.storage, this.svc.keyFor(`state:${this.state.dayId}`), this.state);
    this.svc.onResult(this.currentResult());
  }

  render(): void {
    const s = this.state;
    this.root.innerHTML = "";
    this.root.className = "game ladderless";

    this.root.append(homeBar(this.svc, "Ladderless"));
    this.root.append(el("p", { class: "sub", text: `${s.dayId} · UTC · par ${this.puzzle.parGuesses}` }));
    const start = el("p", { class: "start" });
    start.append(el("span", { text: "Start: " }), el("strong", { text: this.puzzle.startWord }), el("span", { text: " → find the hidden target." }));
    this.root.append(start);

    // Bespoke flourish: thermometer visualising warmth (bestRank → target). Height is a
    // reinforcement of the numeric/text tier already shown elsewhere (non-color-only).
    const warmth = this.table.vocabSize > 1
      ? Math.round(((this.table.vocabSize - s.bestRank) / (this.table.vocabSize - 1)) * 100)
      : 0;
    const thermo = el("div", { class: "thermo" });
    const tube = el("div", { class: "thermo-tube" });
    const mercury = el("div", { class: "thermo-mercury fl-rise" });
    mercury.style.height = `${Math.max(4, warmth)}%`;
    tube.append(mercury);
    thermo.append(tube, el("span", { class: "thermo-label", text: s.guessHistory.length ? `Warmth ${warmth}%` : "Guess to warm up" }));
    this.root.append(thermo);


    this.live = liveRegion();
    this.root.append(this.live);

    const won = s.status === "won";
    const form = el("form", { class: "row" }) as HTMLFormElement;
    const input = el("input", { class: "text-input" }) as HTMLInputElement;
    input.id = "guess-input";
    input.type = "text";
    input.autocomplete = "off";
    input.setAttribute("aria-label", "Your guess");
    input.disabled = won;
    const submit = el("button", { text: "Guess", class: "btn" }) as HTMLButtonElement;
    submit.type = "submit";
    submit.disabled = won;
    form.append(input, submit);
    const error = el("p", { class: "error" });
    error.setAttribute("role", "alert");
    error.textContent = this.errorMsg;

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const res = this.submitGuess(input.value);
      if (!res.ok) {
        this.errorMsg = res.reason === "duplicate" ? "Already guessed." : res.reason === "not_in_dictionary" ? "Not in the word list." : "Invalid guess.";
        this.render();
        this.announce(this.errorMsg);
        return;
      }
      this.errorMsg = "";
      const last = this.state.guessHistory[this.state.guessHistory.length - 1];
      this.render();
      this.announce(`${last.guessWord}: ${VERDICT_LABEL[last.verdict]}, tier ${last.rankTier}.`);
      document.getElementById("guess-input")?.focus();
    });

    const controls = el("div", { class: "controls" });
    const hintBtn = el("button", { text: "Hint", class: "btn btn-secondary" }) as HTMLButtonElement;
    hintBtn.type = "button";
    hintBtn.disabled = won || s.bestRank <= 1;
    hintBtn.addEventListener("click", () => {
      const hint = selectHint(this.state, this.table);
      if (hint) {
        this.state = {
          ...this.state,
          hintCount: this.state.hintCount + 1,
          suggestedHints: [...this.state.suggestedHints, hint],
        };
        this.persist();
      }
      this.render();
      this.announce(hint ? `Hint: try "${hint}".` : "No hint available.");
    });
    const shareBtn = el("button", { text: "Share", class: "btn btn-secondary" }) as HTMLButtonElement;
    shareBtn.type = "button";
    shareBtn.addEventListener("click", () => void this.doShare());
    controls.append(hintBtn, shareBtn);
    this.root.append(form, error, controls);
    // Show the most recent suggested hint visibly (persisted in state.suggestedHints).
    if (s.suggestedHints.length > 0) {
      const hintLine = el("p", { class: "hint-line" });
      hintLine.setAttribute("aria-hidden", "true");
      hintLine.textContent = `Hint: try "${s.suggestedHints[s.suggestedHints.length - 1]}".`;
      this.root.append(hintLine);
    }
    const list = el("ul", { class: "guesses" });
    list.setAttribute("aria-label", "Your guesses");
    [...s.guessHistory].reverse().forEach((g) => {
      const li = el("li", { class: `guess verdict-${g.verdict}` });
      li.append(
        el("span", { class: "gw", text: g.guessWord }),
        el("span", { class: "cue", text: `${VERDICT_ICON[g.verdict]} ${VERDICT_LABEL[g.verdict]}` }),
        el("span", { class: "tier", text: `tier ${g.rankTier}` }),
      );
      list.append(li);
    });
    this.root.append(list);
    if (won) this.root.append(el("p", { class: "win", text: `Solved in ${s.guessHistory.length} guesses!` }));
  }

  private submitGuess(rawInput: string): { ok: boolean; reason?: string } {
    if (this.state.status === "won") return { ok: false, reason: "duplicate" };
    let word: string;
    try {
      word = normalizeGuess(rawInput);
    } catch {
      return { ok: false, reason: "not_in_dictionary" };
    }
    const validation = validateGuess(word, this.dictionary, this.state.guessHistory);
    if (!validation.ok) return { ok: false, reason: validation.reason };
    const wasNotStarted = this.state.status === "not_started";
    const ev = evaluateGuess(word, this.table, this.state.bestRank);
    this.state = reduceGameState(this.state, ev, word, this.svc.clock.nowMs());
    if (wasNotStarted) this.stats = recordPlayed(this.stats, this.state.dayId);
    if (ev.isWin) this.stats = recordWon(this.stats, this.state.dayId);
    saveStats(this.svc.storage, this.svc.keyFor("stats"), this.stats);
    this.persist();
    return { ok: true };
  }

  private async doShare(): Promise<void> {
    const text = buildShareText(this.state, this.puzzle.parGuesses, this.state.dayId);
    if (!isSpoilerSafe(text, this.puzzle.targetWord, this.puzzle.startWord)) {
      this.announce("Sharing blocked.");
      return;
    }
    const res = await this.svc.share.share(text);
    this.announce(res.ok ? (res.method === "clipboard" ? "Result copied." : "Result shared.") : "Sharing unavailable.");
  }

  private announce(msg: string): void {
    if (this.live) this.live.textContent = msg;
  }
}

export const ladderlessPlugin: GamePlugin = {
  meta: {
    id: "ladderless",
    name: "Ladderless",
    tagline: "Warmer or colder — hunt the hidden word by meaning.",
    glyph: "🌡️",
    accent: "#38bdf8",
  },
  contentPackPath: "./ladderless.json",
  async mount(root, services) {
    const game = new Ladderless(root, services);
    await game.init("./ladderless.json");
    game.render();
    return game;
  },
};

// Shared tiny DOM helpers (duplicated per plugin to keep plugins self-contained).
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
