import type { GamePlugin, GameServices, GameInstance, DailyResult } from "../../kit/types.ts";
import { canonicalizeDayId, derivePuzzleId } from "../../kit/selection.ts";
import { loadStats, saveStats, recordPlayed, recordWon, type Stats } from "../../kit/stats.ts";
import { saveAttempt, loadAttempt } from "../../kit/persistence.ts";
import type { AttemptState, Puzzle, MorphemeStatus, ReasonCodePlayer } from "./types.ts";
import {
  initAttempt,
  selectBase,
  togglePrefix,
  toggleSuffix,
  clearSelection,
  canSubmit,
  submit,
  assembleSurfaceForm,
  MAX_ATTEMPTS,
} from "./engine.ts";
import { buildShareText, isSpoilerSafe } from "./share.ts";

interface ContentPack {
  contentPackVersion: string;
  datasetId: string;
  puzzleCount: number;
  /** Large en-GB validation dictionary (wordkit-derived, decoupled from targets). */
  lexicon: string[];
  puzzles: Puzzle[];
}

const REASON_SYMBOL: Record<ReasonCodePlayer, string> = {
  VALID: "✓",
  INVALID_WORD: "✗",
  NOT_TODAYS_ANSWER: "○",
  RULES_MISMATCH: "△",
};
const REASON_TEXT: Record<ReasonCodePlayer, string> = {
  VALID: "Correct! You solved it.",
  INVALID_WORD: "Not a real word — try a different build.",
  NOT_TODAYS_ANSWER: "Valid word, but not today's answer. Check the tile hints.",
  RULES_MISMATCH: "That build breaks a rule and can't be formed.",
};
const STATUS_SYMBOL: Record<MorphemeStatus, string> = { CORRECT: "✓", PRESENT: "~", ABSENT: "·" };
const STATUS_TEXT: Record<MorphemeStatus, string> = {
  CORRECT: "correct here",
  PRESENT: "used elsewhere",
  ABSENT: "not in answer",
};

class AffixLoom implements GameInstance {
  private pack!: ContentPack;
  private lexicon!: Set<string>;
  private puzzle!: Puzzle;
  private state!: AttemptState;
  private stats!: Stats;
  private live!: HTMLElement;

  constructor(private readonly root: HTMLElement, private readonly svc: GameServices) {}

  async init(packPath: string): Promise<void> {
    this.pack = JSON.parse(await this.svc.assets.loadText(packPath)) as ContentPack;
    this.lexicon = new Set(this.pack.lexicon);
    this.stats = loadStats(this.svc.storage, this.svc.keyFor("stats"));
    const dayId = canonicalizeDayId(this.svc.clock.nowMs(), "UTC");
    const puzzleId = derivePuzzleId(dayId, this.pack.contentPackVersion, this.pack.datasetId, this.pack.puzzleCount);
    this.puzzle = this.pack.puzzles[Number(puzzleId.slice(4))];
    const saved = loadAttempt<AttemptState>(
      this.svc.storage,
      this.svc.keyFor(`state:${dayId}`),
      (raw) => raw as AttemptState,
    );
    this.state = saved ?? initAttempt(this.puzzle, dayId);
  }

  currentResult(): DailyResult {
    return {
      gameId: "affix-loom",
      dayId: this.state.dayId,
      played: this.state.attemptsUsed > 0 || this.state.isSolved,
      solved: this.state.isSolved,
    };
  }

  private persist(): void {
    saveAttempt(this.svc.storage, this.svc.keyFor(`state:${this.state.dayId}`), this.state);
    this.svc.onResult(this.currentResult());
  }

  render(): void {
    const s = this.state;
    const done = s.isSolved || s.isFailed;
    this.root.innerHTML = "";
    this.root.className = "game affix-loom";
    this.root.append(homeBar(this.svc, "Affix Loom"));
    this.root.append(
      el("p", { class: "sub", text: `${s.dayId} · UTC · ${MAX_ATTEMPTS - s.attemptsUsed} attempts left` }),
      el("p", { class: "clue", text: `Clue: ${this.puzzle.clue}` }),
      el("p", { class: "help", text: "Weave prefixes and suffixes onto a base to build today's word." }),
    );
    this.live = liveRegion();
    this.root.append(this.live);

    const preview = assembleSurfaceForm(this.puzzle, s.selection) ?? (s.selection.base_id ? "…" : "");
    const loom = el("div", { class: "loom" });
    loom.setAttribute("aria-label", "Current word");
    loom.append(el("span", { text: preview || "Pick a base word, then add affixes", class: preview ? "" : "placeholder" }));
    this.root.append(loom);

    this.root.append(
      tileGroup("Base word", this.puzzle.bases.map((b) => {
        const btn = tileButton(b.token, s.selection.base_id === b.id, done);
        btn.addEventListener("click", () => { this.state = selectBase(this.state, b.id); this.persist(); this.render(); });
        return btn;
      })),
      tileGroup("Prefixes", this.puzzle.prefixes.map((p) => {
        const btn = tileButton(p.token + "-", s.selection.prefix_ids.includes(p.id), done);
        btn.addEventListener("click", () => { this.state = togglePrefix(this.state, p.id); this.persist(); this.render(); });
        return btn;
      })),
      tileGroup("Suffixes", this.puzzle.suffixes.map((sfx) => {
        const btn = tileButton("-" + sfx.token, s.selection.suffix_ids.includes(sfx.id), done);
        btn.addEventListener("click", () => { this.state = toggleSuffix(this.state, sfx.id); this.persist(); this.render(); });
        return btn;
      })),
    );

    const controls = el("div", { class: "controls" });
    const submitBtn = el("button", { text: "Submit", class: "btn" }) as HTMLButtonElement;
    submitBtn.type = "button";
    submitBtn.disabled = done || s.selection.base_id === null;
    submitBtn.addEventListener("click", () => {
      if (!canSubmit(this.state)) return;
      const out = submit(this.state, this.puzzle, this.lexicon);
      this.state = out.state;
      if (this.state.isSolved) {
        this.stats = recordWon(recordPlayed(this.stats, this.state.dayId), this.state.dayId);
        saveStats(this.svc.storage, this.svc.keyFor("stats"), this.stats);
      } else if (this.state.isFailed) {
        this.stats = recordPlayed(this.stats, this.state.dayId);
        saveStats(this.svc.storage, this.svc.keyFor("stats"), this.stats);
      }
      this.persist();
      this.render();
      this.announce(REASON_TEXT[out.result.reason_player]);
    });
    const clearBtn = el("button", { text: "Clear", class: "btn btn-secondary" }) as HTMLButtonElement;
    clearBtn.type = "button";
    clearBtn.disabled = done;
    clearBtn.addEventListener("click", () => { this.state = clearSelection(this.state); this.persist(); this.render(); });
    const shareBtn = el("button", { text: "Share", class: "btn btn-secondary" }) as HTMLButtonElement;
    shareBtn.type = "button";
    shareBtn.addEventListener("click", () => void this.doShare());
    controls.append(submitBtn, clearBtn, shareBtn);
    this.root.append(controls);

    const list = el("div", { class: "attempts" });
    for (const a of s.attempts) {
      const row = el("div", { class: `attempt ${a.reason}` });
      const head = el("div", { class: "attempt-head" });
      head.append(el("span", { text: `${REASON_SYMBOL[a.reason]} ${a.surface || "—"}` }));
      head.append(el("span", { class: "sr-only", text: REASON_TEXT[a.reason] }));
      row.append(head);
      if (a.grades.length > 0) {
        const chips = el("div", { class: "grades" });
        chips.setAttribute("role", "list");
        chips.setAttribute("aria-label", "Tile hints");
        for (const g of a.grades) {
          const label = g.slot === "PREFIX" ? `${g.token}-` : g.slot === "SUFFIX" ? `-${g.token}` : g.token;
          const chip = el("span", { class: `grade ${g.status}` });
          chip.setAttribute("role", "listitem");
          chip.append(el("span", { text: `${STATUS_SYMBOL[g.status]} ${label}` }));
          chip.append(el("span", { class: "sr-only", text: `${label}: ${STATUS_TEXT[g.status]}` }));
          chips.append(chip);
        }
        row.append(chips);
      }
      list.append(row);
    }
    this.root.append(list);

    if (s.isSolved) this.root.append(el("p", { class: "win", text: `Solved in ${s.attemptsUsed}/${MAX_ATTEMPTS}!` }));
    if (s.isFailed) this.root.append(el("p", { class: "lose", text: "Out of attempts." }));
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

export const affixLoomPlugin: GamePlugin = {
  meta: { id: "affix-loom", name: "Affix Loom", tagline: "Weave affixes onto a base to build the word.", glyph: "🧵", accent: "#8b5cf6" },
  contentPackPath: "./affix-loom.json",
  async mount(root, services) {
    const game = new AffixLoom(root, services);
    await game.init("./affix-loom.json");
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
function tileGroup(label: string, tiles: HTMLElement[]): HTMLElement {
  const wrap = el("div", { class: "tiles" });
  wrap.setAttribute("role", "group");
  wrap.setAttribute("aria-label", label);
  wrap.append(el("div", { class: "tile-group-label", text: label }));
  for (const t of tiles) wrap.append(t);
  return wrap;
}
function tileButton(text: string, pressed: boolean, disabled: boolean): HTMLButtonElement {
  const btn = el("button", { class: "tile", text }) as HTMLButtonElement;
  btn.type = "button";
  btn.setAttribute("aria-pressed", String(pressed));
  if (pressed) btn.classList.add("on");
  btn.disabled = disabled;
  return btn;
}
