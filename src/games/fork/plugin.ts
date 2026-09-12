import type { GamePlugin, GameServices, GameInstance, DailyResult } from "../../kit/types.ts";
import { canonicalizeDayId, derivePuzzleId } from "../../kit/selection.ts";
import { loadStats, saveStats, recordPlayed, recordWon, type Stats } from "../../kit/stats.ts";
import { saveAttempt, loadAttempt } from "../../kit/persistence.ts";
import type { AttemptState, Puzzle } from "./types.ts";
import { initAttempt, addTrunk, setFork, addBranch, totalSteps } from "./engine.ts";
import { buildShareText, isSpoilerSafe } from "./share.ts";
import { carbonButton } from "../../kit/carbon.ts";

interface ContentPack {
  contentPackVersion: string;
  datasetId: string;
  puzzleCount: number;
  dictionary: string[];
  puzzles: Puzzle[];
}

class Fork implements GameInstance {
  private pack!: ContentPack;
  private dictionary!: Set<string>;
  private puzzle!: Puzzle;
  private state!: AttemptState;
  private stats!: Stats;
  private live!: HTMLElement;
  private draftTrunk = "";
  private draftA = "";
  private draftB = "";

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
    return { gameId: "fork", dayId: this.state.dayId, played: this.state.trunk.length > 1 || this.state.isComplete, solved: this.state.isComplete };
  }

  private persist(): void {
    saveAttempt(this.svc.storage, this.svc.keyFor(`state:${this.state.dayId}`), this.state);
    this.svc.onResult(this.currentResult());
  }

  render(): void {
    const s = this.state;
    const done = s.isComplete;
    this.root.innerHTML = "";
    this.root.className = "game fork";
    this.root.append(homeBar(this.svc, "Fork"));
    this.root.append(
      el("p", { class: "sub", text: `${s.dayId} · UTC · ${totalSteps(s)} steps / par ${this.puzzle.par}` }),
      el("p", { class: "help", text: "Build one ladder from START, pick a fork point, then branch to BOTH targets. Fewest total steps wins." }),
    );
    const ends = el("div", { class: "fk-ends" });
    ends.append(
      el("span", { class: "fk-end", text: `START ${this.puzzle.start}` }),
      el("span", { class: "fk-end fk-a", text: `A: ${this.puzzle.targetA}` }),
      el("span", { class: "fk-end fk-b", text: `B: ${this.puzzle.targetB}` }),
    );
    this.root.append(ends);
    this.live = liveRegion();
    this.root.append(this.live);

    // Trunk with fork-point selectors
    const trunkEl = el("div", { class: "fk-trunk" });
    trunkEl.setAttribute("role", "list");
    trunkEl.setAttribute("aria-label", "Trunk path; choose a fork point");
    s.trunk.forEach((w, i) => {
      const rung = el("button", { class: `fk-rung${s.forkIndex === i ? " fork" : ""}`, text: w }) as HTMLButtonElement;
      rung.type = "button";
      rung.disabled = done;
      rung.setAttribute("aria-label", `Trunk ${w}${s.forkIndex === i ? ", fork point" : ", set as fork point"}`);
      rung.setAttribute("aria-pressed", String(s.forkIndex === i));
      rung.addEventListener("click", () => { this.state = setFork(this.state, i); this.persist(); this.render(); });
      trunkEl.append(rung);
      if (i < s.trunk.length - 1) trunkEl.append(el("span", { class: "fk-sep", text: "→" }));
    });
    this.root.append(trunkEl);

    if (!done && s.forkIndex === null) this.root.append(this.buildTrunkInput());

    if (s.forkIndex !== null && !done) {
      this.root.append(this.buildBranch("A", s.branchA, this.puzzle.targetA));
      this.root.append(this.buildBranch("B", s.branchB, this.puzzle.targetB));
    }

    const controls = el("div", { class: "controls" });
    const shareBtn = carbonButton({ text: "Share", kind: "secondary", onClick: () => void this.doShare() });
    controls.append(shareBtn);
    this.root.append(controls);

    if (done) {
      const delta = totalSteps(s) - this.puzzle.par;
      this.root.append(el("p", { class: "win", text: delta <= 0 ? `Both reached at par! ${totalSteps(s)} steps.` : `Both reached in ${totalSteps(s)} steps (par ${this.puzzle.par}).` }));
    }
  }

  private buildTrunkInput(): HTMLElement {
    return this.buildWordInput("trunk", this.draftTrunk, (v) => (this.draftTrunk = v), () => this.submitTrunk());
  }

  private buildBranch(which: "A" | "B", words: string[], target: string): HTMLElement {
    const wrap = el("div", { class: `fk-branch fk-branch-${which.toLowerCase()}` });
    wrap.append(el("p", { class: "help", text: `Branch ${which} → ${target}` }));
    const chain = el("div", { class: "fk-chain" });
    words.forEach((w, i) => {
      chain.append(el("span", { class: "fk-rung", text: w }));
      if (i < words.length - 1) chain.append(el("span", { class: "fk-sep", text: "→" }));
    });
    wrap.append(chain);
    const draft = which === "A" ? this.draftA : this.draftB;
    wrap.append(this.buildWordInput(which, draft, (v) => { if (which === "A") this.draftA = v; else this.draftB = v; }, () => this.submitBranch(which)));
    return wrap;
  }

  private buildWordInput(kind: string, draft: string, setDraft: (v: string) => void, onSubmit: () => void): HTMLElement {
    const wrap = el("div", { class: "fk-input" });
    const input = el("input", { class: "fk-field" }) as HTMLInputElement;
    input.type = "text";
    input.maxLength = this.puzzle.wordLength;
    input.value = draft;
    input.setAttribute("aria-label", `Next word for ${kind} (${this.puzzle.wordLength} letters)`);
    input.autocapitalize = "characters";
    input.autocomplete = "off";
    input.addEventListener("input", () => {
      const v = input.value.replace(/[^A-Za-z]/g, "").toUpperCase().slice(0, this.puzzle.wordLength);
      setDraft(v);
      input.value = v;
    });
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") onSubmit(); });
    const go = carbonButton({ text: "Add", onClick: onSubmit });
    wrap.append(input, go);
    return wrap;
  }

  private submitTrunk(): void {
    const out = addTrunk(this.state, this.puzzle, this.draftTrunk, this.dictionary);
    if (!out.accepted) return this.announce(this.reasonMsg(out.reason));
    this.state = out.state;
    this.draftTrunk = "";
    if (this.state.trunk.length === 2) { this.stats = recordPlayed(this.stats, this.state.dayId); saveStats(this.svc.storage, this.svc.keyFor("stats"), this.stats); }
    this.persist();
    this.render();
  }

  private submitBranch(which: "A" | "B"): void {
    const draft = which === "A" ? this.draftA : this.draftB;
    const out = addBranch(this.state, this.puzzle, which, draft, this.dictionary);
    if (!out.accepted) return this.announce(this.reasonMsg(out.reason));
    this.state = out.state;
    if (which === "A") this.draftA = ""; else this.draftB = "";
    if (this.state.isComplete) {
      this.stats = recordWon(recordPlayed(this.stats, this.state.dayId), this.state.dayId);
      saveStats(this.svc.storage, this.svc.keyFor("stats"), this.stats);
    }
    this.persist();
    this.render();
    if (this.state.isComplete) this.announce("Both targets reached — solved!");
  }

  private reasonMsg(reason?: string): string {
    return reason === "dictionary" ? "Not in word list."
      : reason === "not-one-change" ? "Change exactly one letter."
      : reason === "length" ? `Must be ${this.puzzle.wordLength} letters.`
      : "Not allowed.";
  }

  private async doShare(): Promise<void> {
    const text = buildShareText(this.state, this.puzzle, this.state.dayId);
    const words = [this.puzzle.start, this.puzzle.targetA, this.puzzle.targetB, ...this.state.trunk, ...this.state.branchA, ...this.state.branchB];
    if (!isSpoilerSafe(text, words)) return this.announce("Sharing blocked.");
    const res = await this.svc.share.share(text);
    this.announce(res.ok ? (res.method === "clipboard" ? "Copied." : "Shared.") : "Sharing unavailable.");
  }

  private announce(msg: string): void {
    if (this.live) this.live.textContent = msg;
  }
}

export const forkPlugin: GamePlugin = {
  meta: { id: "fork", name: "Fork", tagline: "One ladder, two targets — branch to both.", glyph: "🍴", accent: "#42be65" },
  contentPackPath: "./fork.json",
  async mount(root, services) {
    const game = new Fork(root, services);
    await game.init("./fork.json");
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
