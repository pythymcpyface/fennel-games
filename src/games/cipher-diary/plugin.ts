import type { GamePlugin, GameServices, GameInstance, DailyResult } from "../../kit/types.ts";
import { canonicalizeDayId, derivePuzzleId } from "../../kit/selection.ts";
import { loadStats, saveStats, recordPlayed, recordWon, type Stats } from "../../kit/stats.ts";
import { saveAttempt, loadAttempt } from "../../kit/persistence.ts";
import type { AttemptState, Puzzle } from "./types.ts";
import { initAttempt, assign, evaluate, usedCipherLetters, isSolved } from "./engine.ts";
import { buildShareText, isSpoilerSafe } from "./share.ts";
import { carbonButton, carbonNotification } from "../../kit/carbon.ts";

interface ContentPack {
  contentPackVersion: string;
  datasetId: string;
  puzzleCount: number;
  puzzles: Puzzle[];
}

class CipherDiary implements GameInstance {
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
    if (r.puzzleId !== this.puzzle.puzzleId || typeof r.mapping !== "object" || r.mapping === null) return null;
    // Keep only A-Z->A-Z entries; ensure fragment stays applied.
    const mapping: Record<string, string> = { ...this.puzzle.fragment };
    for (const [k, v] of Object.entries(r.mapping as Record<string, unknown>)) {
      if (/^[A-Z]$/.test(k) && typeof v === "string" && /^[A-Z]$/.test(v)) mapping[k] = v;
    }
    return { puzzleId: this.puzzle.puzzleId, dayId, mapping, isComplete: r.isComplete === true };
  }

  currentResult(): DailyResult {
    return { gameId: "cipher-diary", dayId: this.state.dayId, played: this.state.isComplete, solved: isSolved(this.state, this.puzzle) };
  }

  private persist(): void {
    saveAttempt(this.svc.storage, this.svc.keyFor(`state:${this.state.dayId}`), this.state);
    this.svc.onResult(this.currentResult());
  }

  render(): void {
    const result = evaluate(this.puzzle, this.state.mapping);
    const done = result.solved;
    this.root.innerHTML = "";
    this.root.className = "game cipher-diary";
    this.root.append(homeBar(this.svc, "Cipher Diary"));
    this.root.append(
      el("p", { class: "sub", text: `${this.state.dayId} · UTC · ${result.correct}/${result.total} letters decoded` }),
      el("p", { class: "help", text: "Today's diary entry is enciphered. A few letters carried over from yesterday. Deduce the rest and restore the story." }),
    );

    this.live = liveRegion();
    this.root.append(this.live);

    // Decoded preview.
    const preview = el("div", { class: "cd-preview", text: result.preview });
    preview.setAttribute("aria-label", "Decoded diary so far");
    this.root.append(preview);

    if (!done) {
      this.root.append(this.buildMappingTable());
    } else {
      this.root.append(carbonNotification("Decoded!", "You restored the diary entry.", "success"));
    }

    const controls = el("div", { class: "controls" });
    controls.append(carbonButton({ text: "Share", kind: "secondary", disabled: !done, onClick: () => void this.doShare() }));
    this.root.append(controls);
  }

  private buildMappingTable(): HTMLElement {
    const used = usedCipherLetters(this.puzzle.ciphertext);
    const table = el("div", { class: "cd-table" });
    table.setAttribute("role", "group");
    table.setAttribute("aria-label", "Cipher letter to plaintext mappings");
    used.forEach((c) => {
      const locked = this.puzzle.fragment[c] !== undefined;
      const cell = el("div", { class: `cd-cell${locked ? " cd-locked" : ""}` });
      cell.append(el("span", { class: "cd-cipher", text: c }));
      const input = el("input", { class: "cd-input" }) as HTMLInputElement;
      input.type = "text";
      input.maxLength = 1;
      input.value = this.state.mapping[c] ?? "";
      input.disabled = locked;
      input.autocapitalize = "characters";
      input.autocomplete = "off";
      input.setAttribute("aria-label", locked ? `Cipher ${c} is ${this.state.mapping[c]} (given)` : `Cipher ${c}, ${this.state.mapping[c] ? "assigned " + this.state.mapping[c] : "unassigned"}`);
      input.addEventListener("input", () => this.onAssign(c, input.value));
      cell.append(input);
      table.append(cell);
    });
    return table;
  }

  private onAssign(cipher: string, value: string): void {
    const guess = value.replace(/[^A-Za-z]/g, "").toUpperCase().slice(0, 1);
    const out = assign(this.state, this.puzzle, cipher, guess || null);
    if (!out.accepted) {
      if (out.reason === "conflict") this.announce(`${guess} is already used by another letter.`);
      this.render();
      return;
    }
    this.state = out.state;
    const result = evaluate(this.puzzle, this.state.mapping);
    if (result.solved && !this.state.isComplete) this.state = { ...this.state, isComplete: true };
    if (this.state.isComplete) {
      this.stats = recordWon(recordPlayed(this.stats, this.state.dayId), this.state.dayId);
      saveStats(this.svc.storage, this.svc.keyFor("stats"), this.stats);
    }
    this.persist();
    this.render();
    this.announce(result.solved ? "Fully decoded!" : `${result.correct} of ${result.total} letters correct.`);
    if (!result.solved) this.refocus(cipher);
  }

  private refocus(cipher: string): void {
    queueMicrotask(() => {
      const inputs = this.root.querySelectorAll<HTMLInputElement>(".cd-input");
      // Focus the next editable input after the one just edited.
      const used = usedCipherLetters(this.puzzle.ciphertext);
      const idx = used.indexOf(cipher);
      for (let j = idx + 1; j < inputs.length + used.length; j++) {
        const n = inputs[j % inputs.length];
        if (n && !n.disabled) { n.focus(); return; }
      }
    });
  }

  private async doShare(): Promise<void> {
    const result = evaluate(this.puzzle, this.state.mapping);
    const text = buildShareText(result, this.state.dayId);
    if (!isSpoilerSafe(text)) return this.announce("Sharing blocked.");
    const res = await this.svc.share.share(text);
    this.announce(res.ok ? (res.method === "clipboard" ? "Copied." : "Shared.") : "Sharing unavailable.");
  }

  private announce(msg: string): void {
    if (this.live) this.live.textContent = msg;
  }
}

export const cipherDiaryPlugin: GamePlugin = {
  meta: { id: "cipher-diary", name: "Cipher Diary", tagline: "Decode today's enciphered diary entry.", glyph: "🗝️", accent: "#d4bbff" },
  contentPackPath: "./cipher-diary.json",
  async mount(root, services) {
    const game = new CipherDiary(root, services);
    await game.init("./cipher-diary.json");
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
