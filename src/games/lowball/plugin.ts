import type { GamePlugin, GameServices, GameInstance, DailyResult } from "../../kit/types.ts";
import { canonicalizeDayId } from "../../kit/selection.ts";
import { loadStats, saveStats, recordPlayed, recordWon, type Stats } from "../../kit/stats.ts";
import { saveAttempt, loadAttempt } from "../../kit/persistence.ts";
import type { AttemptState, InvalidReason, Puzzle, RoundMode } from "./types.ts";
import { MAX_PANEL_SCORE, PANEL_DISCLOSURE, SWEEPS_TOTAL } from "./types.ts";
import {
  initAttempt,
  submitAnswer,
  canSubmit,
  totalFor,
  advanceTick,
  isBarLit,
  repairState,
  selectDailyPuzzleId,
  selectPracticePuzzleId,
} from "./engine.ts";
import { buildShareText, isSpoilerSafe, canShare, buildMpShareText, isMpShareSpoilerSafe } from "./share.ts";
import {
  MultiplayerClient,
  validateDisplayName,
  normalizeRoomCode,
  buildWsUrl,
  buildHttpUrl,
  type ClientEvent,
  type MpLeaderboardEntry,
} from "./multiplayer-client.ts";

interface ContentPack {
  contentPackVersion: string;
  datasetId: string;
  puzzleCount: number;
  puzzles: Puzzle[];
}

/** Milliseconds between tension-counter ticks. View-only concern (ADR-001). */
const TICK_MS = 12;

/**
 * Relay WebSocket base URL (REQ-040).
 * Override by setting VITE_RELAY_URL at build time:
 *   VITE_RELAY_URL=wss://lowball-relay.<account>.workers.dev npm run build
 * Defaults to the wrangler dev local URL so local dev works without env vars.
 */
const RELAY_BASE_URL: string =
  (import.meta as { env?: Record<string, string | undefined> }).env?.["VITE_RELAY_URL"] ??
  "ws://127.0.0.1:8787";

// ---------------------------------------------------------------------------
// Multiplayer state kept alongside the single-player state (never mixed).
// ---------------------------------------------------------------------------

type MpPhase =
  | "idle"           // no MP session
  | "lobby-create"   // waiting for room creation response
  | "lobby-wait"     // in lobby, waiting for host to start
  | "round-active"   // sweep in progress
  | "round-done";    // leaderboard shown

interface MpState {
  phase: MpPhase;
  roomCode: string;
  mySlotIndex: number;
  isHost: boolean;
  myDisplayName: string;
  players: { slotIndex: number; displayName: string; isHost: boolean }[];
  // current sweep
  sweepIndex: number;
  deadlineTs: number;
  submissions: Map<number, { word: string | null; score: number; verdict: string; runningTotal: number }>;
  // tiebreak
  tiebreakRound: number;
  tiedSlots: number[];
  // puzzle info
  categoryLabel: string;
  parValue: number;
  affixType: string;
  affixValue: string;
  // leaderboard
  leaderboard: MpLeaderboardEntry[] | null;
  // error / status message
  errorMsg: string;
}

function freshMpState(): MpState {
  return {
    phase: "idle",
    roomCode: "",
    mySlotIndex: -1,
    isHost: false,
    myDisplayName: "",
    players: [],
    sweepIndex: 0,
    deadlineTs: 0,
    submissions: new Map(),
    tiebreakRound: 0,
    tiedSlots: [],
    categoryLabel: "",
    parValue: 0,
    affixType: "suffix",
    affixValue: "",
    leaderboard: null,
    errorMsg: "",
  };
}

class Lowball implements GameInstance {
  private pack!: ContentPack;
  private puzzle!: Puzzle;
  private state!: AttemptState;
  private stats!: Stats;
  private dayId!: string;
  private dailyPuzzleId: string | null = null;
  private practiceOrdinal = 0;
  private mode: RoundMode = "daily";
  private live!: HTMLElement;
  private errorMsg = "";
  private timer: ReturnType<typeof setInterval> | null = null;
  private reducedMotion = false;
  // REQ-036: multiplayer client + state (null = single-player mode)
  private mpClient: MultiplayerClient | null = null;
  private mpState: MpState = freshMpState();
  private countdownTimer: ReturnType<typeof setInterval> | null = null;
  /** Tension-counter value for the multiplayer view (own score reveal). */
  private mpTickCounter = 0;
  private mpTickTimer: ReturnType<typeof setInterval> | null = null;

  constructor(private readonly root: HTMLElement, private readonly svc: GameServices) {}

  // --- storage keys: two distinct namespaces, never parametrised (ADR-003) ----

  private dailyKey(): string {
    return this.svc.keyFor(`daily:${this.dayId}`);
  }

  private practiceKey(): string {
    return this.svc.keyFor("practice");
  }

  /** Persist the daily round. The only path permitted to touch shared stats. */
  private saveDailyState(): void {
    saveAttempt(this.svc.storage, this.dailyKey(), this.state);
    this.svc.onResult(this.currentResult());
  }

  /**
   * Persist the practice round. Deliberately a separate function with no shared
   * call site, so no future edit can route practice data at the daily key or reach
   * the stats record (REQ-022, REQ-023).
   */
  private savePracticeState(): void {
    saveAttempt(this.svc.storage, this.practiceKey(), {
      ordinal: this.practiceOrdinal,
      round: this.state,
    });
  }

  async init(packPath: string): Promise<void> {
    this.pack = JSON.parse(await this.svc.assets.loadText(packPath)) as ContentPack;
    this.stats = loadStats(this.svc.storage, this.svc.keyFor("stats"));
    this.dayId = canonicalizeDayId(this.svc.clock.nowMs(), "UTC");
    this.reducedMotion =
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    this.dailyPuzzleId = selectDailyPuzzleId(
      this.dayId,
      this.pack.contentPackVersion,
      this.pack.datasetId,
      this.pack.puzzleCount,
    );

    // REQ-036: if a room code was passed via the invite link, start in multiplayer
    // lobby mode (join flow). Otherwise fall through to single-player daily.
    if (this.svc.roomCode) {
      this.startMpJoin(normalizeRoomCode(this.svc.roomCode));
    } else {
      this.startDaily();
    }
  }

  private puzzleById(id: string | null): Puzzle {
    return this.pack.puzzles.find((p) => p.puzzleId === id) ?? this.pack.puzzles[0];
  }

  /**
   * Load or begin today's daily round. A saved round from an earlier UTC day is
   * discarded rather than resumed (REQ-003); corrupt state repairs to null and also
   * starts fresh (REQ-028).
   */
  private startDaily(): void {
    this.stopTicking();
    this.mode = "daily";
    this.puzzle = this.puzzleById(this.dailyPuzzleId);
    const saved = loadAttempt<AttemptState>(this.svc.storage, this.dailyKey(), repairState);
    this.state =
      saved !== null && saved.dayId === this.dayId && saved.puzzleId === this.puzzle.puzzleId
        ? saved
        : initAttempt(this.puzzle, this.dayId, "daily");
    // REQ-030: a terminal verdict that never reached the stats record is reconciled
    // once here. recordPlayed/recordWon are idempotent per day, so this is safe.
    if (this.state.verdict !== "pending") this.recordDailyOutcome();
  }

  /** Begin a fresh practice round. Overwrites the single practice slot (REQ-026). */
  private startPractice(): void {
    this.stopTicking();
    this.mode = "practice";
    this.practiceOrdinal += 1;
    const id = selectPracticePuzzleId(
      this.dayId,
      this.practiceOrdinal,
      this.pack.puzzleCount,
      this.dailyPuzzleId,
    );
    this.puzzle = this.puzzleById(id);
    this.state = initAttempt(this.puzzle, this.dayId, "practice");
    this.savePracticeState();
  }

  /** Mirror the round outcome into shared stats. Daily only, never practice. */
  private recordDailyOutcome(): void {
    this.stats = recordPlayed(this.stats, this.dayId);
    if (this.state.verdict === "win") this.stats = recordWon(this.stats, this.dayId);
    saveStats(this.svc.storage, this.svc.keyFor("stats"), this.stats);
  }

  currentResult(): DailyResult {
    // Guard: on the multiplayer join path, this.state is never initialised
    // (startMpJoin is called instead of startDaily). Return a safe neutral
    // result so the hub dashboard does not crash. (REQ-FIX-001)
    if (!this.state) {
      return { gameId: "lowball", dayId: this.dayId, played: false, solved: false };
    }
    // Practice never contributes to the hub dashboard.
    const isDaily = this.mode === "daily";
    return {
      gameId: "lowball",
      dayId: this.dayId,
      played: isDaily && this.state.sweepIndex > 0,
      solved: isDaily && this.state.verdict === "win",
    };
  }

  // --- tension counter: the view decides WHEN, the engine decides WHAT ---------

  private stopTicking(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private startTicking(): void {
    this.stopTicking();
    if (this.reducedMotion) return;
    this.timer = setInterval(() => {
      // The hub tears a game down by clearing its root's innerHTML, and
      // GameInstance exposes no unmount hook, so an interval started here would
      // otherwise keep firing against a detached DOM after the player navigates
      // home. Detachment is the teardown signal.
      if (!this.root.isConnected) {
        this.stopTicking();
        return;
      }
      const next = advanceTick(this.state);
      if (next === this.state) {
        this.stopTicking();
        return;
      }
      this.state = next;
      this.paintCounter();
    }, TICK_MS);
  }

  /** Repaint only the counter, so the drain does not steal input focus. */
  private paintCounter(): void {
    const col = this.root.querySelector(".lb-bars");
    const num = this.root.querySelector(".lb-score-num");
    if (col !== null) {
      col.querySelectorAll(".lb-bar").forEach((bar, i) => {
        bar.classList.toggle("lb-bar-on", isBarLit(i, this.state.tickCounter));
      });
    }
    if (num !== null) num.textContent = String(this.state.tickCounter);
  }

  render(): void {
    // REQ-036: delegate to MP views when in multiplayer mode.
    // phase "idle" with a roomCode means guest arrived via invite link —
    // show the name-entry lobby (pre-connection) rather than single-player.
    const isMpMode = this.mpState.phase !== "idle" || this.mpState.roomCode !== "";
    if (isMpMode) {
      if (this.mpState.phase === "round-done") {
        this.renderLeaderboard();
      } else if (this.mpState.phase === "round-active") {
        this.renderLiveRound();
      } else {
        this.renderLobby();
      }
      return;
    }

    this.root.innerHTML = "";
    this.root.className = "game lowball";
    this.root.append(homeBar(this.svc, "Lowball"));

    const s = this.state;
    const player = s.players[s.activePlayerIndex];
    const terminal = s.verdict !== "pending";

    this.root.append(
      el("p", {
        class: "sub",
        text: `${this.dayId} · UTC · par ${this.puzzle.parValue}${this.mode === "practice" ? " · practice" : ""}`,
      }),
    );

    // Category prompt.
    const prompt = el("h2", { class: "lb-prompt", text: this.puzzle.categoryLabel });
    this.root.append(prompt);
    this.root.append(
      el("p", {
        class: "lb-rule",
        text: `Lowest score wins. Sweep ${Math.min(s.sweepIndex + 1, SWEEPS_TOTAL)} of ${SWEEPS_TOTAL}. Beat par ${this.puzzle.parValue}.`,
      }),
    );

    this.live = liveRegion();
    this.root.append(this.live);

    // --- tension counter: 100 bars plus the same number as text (REQ-051) ------
    const counter = el("div", { class: "lb-counter" });
    const bars = el("div", { class: "lb-bars" });
    bars.setAttribute("aria-hidden", "true"); // the numeric text is the accessible channel
    for (let i = 0; i < MAX_PANEL_SCORE; i++) {
      const bar = el("span", { class: "lb-bar" });
      if (isBarLit(i, s.tickCounter)) bar.classList.add("lb-bar-on");
      bars.append(bar);
    }
    const readout = el("div", { class: "lb-readout" });
    readout.append(
      el("strong", { class: "lb-score-num", text: String(s.tickTarget === null ? 0 : s.tickCounter) }),
      el("span", { class: "lb-score-of", text: " / 100" }),
    );
    counter.append(bars, readout);
    this.root.append(counter);
    // REQ-053: never imply real people were surveyed.
    this.root.append(el("p", { class: "lb-disclosure", text: PANEL_DISCLOSURE }));

    // --- answer input (REQ-049) ------------------------------------------------
    if (!terminal) {
      const form = el("form", { class: "row" }) as HTMLFormElement;
      const input = el("input", { class: "text-input" }) as HTMLInputElement;
      input.id = "lb-answer";
      input.type = "text";
      input.autocomplete = "off";
      input.setAttribute("aria-label", `Your answer — ${this.puzzle.categoryLabel}`);
      const submit = el("button", { text: "Submit", class: "btn" }) as HTMLButtonElement;
      submit.type = "submit";
      form.append(input, submit);
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        this.handleSubmit(input.value);
      });
      this.root.append(form);
    }

    const error = el("p", { class: "error" });
    error.setAttribute("role", "alert");
    error.textContent = this.errorMsg;
    this.root.append(error);

    // --- sweeps so far ---------------------------------------------------------
    if (player.sweeps.length > 0) {
      const list = el("ul", { class: "lb-sweeps" });
      list.setAttribute("aria-label", "Your answers");
      player.sweeps.forEach((sw, i) => {
        const li = el("li", { class: "lb-sweep" });
        li.append(
          el("span", { class: "lb-sweep-n", text: `${i + 1}.` }),
          el("span", { class: "lb-sweep-word", text: sw.answerWord === "" ? "(blank)" : sw.answerWord }),
          el("span", { class: "lb-sweep-score", text: String(sw.panelScore) }),
        );
        if (sw.invalidReason !== null) {
          li.append(el("span", { class: "lb-sweep-bad", text: INVALID_LABEL[sw.invalidReason] }));
        }
        list.append(li);
      });
      this.root.append(list);
      this.root.append(
        el("p", { class: "lb-total", text: `Total ${totalFor(player)} · par ${this.puzzle.parValue}` }),
      );
    }

    if (terminal) this.root.append(this.buildReveal());

    // --- controls --------------------------------------------------------------
    const controls = el("div", { class: "controls" });
    if (canShare(s)) {
      const shareBtn = el("button", { text: "Share", class: "btn btn-secondary" }) as HTMLButtonElement;
      shareBtn.type = "button";
      shareBtn.addEventListener("click", () => void this.doShare());
      controls.append(shareBtn);
    }
    // REQ-009: Multiplayer entry point from single-player mode
    const mpBtn = el("button", { text: "Multiplayer", class: "btn btn-secondary" }) as HTMLButtonElement;
    mpBtn.type = "button";
    mpBtn.setAttribute("aria-label", "Host or join a multiplayer game");
    mpBtn.addEventListener("click", () => {
      this.stopTicking();
      this.startMpCreate();
    });
    controls.append(mpBtn);
    const practiceBtn = el("button", {
      text: this.mode === "practice" ? "Another practice" : "Practice round",
      class: "btn btn-secondary",
    }) as HTMLButtonElement;
    practiceBtn.type = "button";
    practiceBtn.addEventListener("click", () => {
      this.errorMsg = "";
      this.startPractice();
      this.render();
      this.announce(`Practice round. ${this.puzzle.categoryLabel}.`);
    });
    controls.append(practiceBtn);
    if (this.mode === "practice") {
      const backBtn = el("button", { text: "Back to today", class: "btn btn-secondary" }) as HTMLButtonElement;
      backBtn.type = "button";
      backBtn.addEventListener("click", () => {
        this.errorMsg = "";
        this.startDaily();
        this.render();
        this.announce(`Today's category. ${this.puzzle.categoryLabel}.`);
      });
      controls.append(backBtn);
    }
    this.root.append(controls);
  }

  /**
   * Post-round reveal. Findable zero-scorers are badged differently from unfindable
   * ones (REQ-052) so a lucky junk word is not celebrated as a genuine find.
   */
  private buildReveal(): HTMLElement {
    const wrap = el("div", { class: "lb-reveal" });
    const player = this.state.players[this.state.activePlayerIndex];
    const total = totalFor(player);
    wrap.append(
      el("p", {
        class: this.state.verdict === "win" ? "win" : "lose",
        text:
          this.state.verdict === "win"
            ? `Total ${total} — under par ${this.puzzle.parValue}. Won.`
            : `Total ${total} — par was ${this.puzzle.parValue}. Lost.`,
      }),
    );
    wrap.append(el("h3", { class: "lb-reveal-h", text: "Every valid answer" }));
    // REQ-053 requires the disclosure wherever a panel score is presented. The reveal
    // is the densest score presentation in the game and is appended far below the
    // counter's disclosure, so it carries its own rather than relying on scroll
    // position to keep the earlier one in view.
    wrap.append(el("p", { class: "lb-disclosure", text: PANEL_DISCLOSURE }));
    const list = el("ul", { class: "lb-answers" });
    for (const a of this.puzzle.answers) {
      const li = el("li", { class: "lb-answer" });
      li.append(
        el("span", { class: "lb-answer-word", text: a.word }),
        el("span", { class: "lb-answer-score", text: String(a.panelScore) }),
      );
      if (a.panelScore === 0) {
        li.append(
          el("span", {
            class: a.isFindable ? "lb-badge lb-badge-findable" : "lb-badge lb-badge-obscure",
            text: a.isFindable ? "pointless · findable" : "pointless · obscure",
          }),
        );
      }
      list.append(li);
    }
    wrap.append(list);
    return wrap;
  }

  private handleSubmit(raw: string): void {
    if (!canSubmit(this.state)) return;
    const out = submitAnswer(this.state, this.puzzle, raw, { reducedMotion: this.reducedMotion });
    if (out.error !== null) return;
    this.state = out.state;
    const sweep = out.sweep;

    if (this.mode === "daily") {
      if (this.state.verdict !== "pending") this.recordDailyOutcome();
      this.saveDailyState();
    } else {
      this.savePracticeState();
    }

    this.errorMsg = sweep !== null && sweep.invalidReason !== null ? INVALID_LABEL[sweep.invalidReason] : "";
    this.render();
    this.startTicking();

    const score = sweep?.panelScore ?? 0;
    const suffix =
      this.state.verdict === "pending"
        ? ""
        : this.state.verdict === "win"
          ? ` Total ${totalFor(this.state.players[0])}, under par ${this.puzzle.parValue}. Won.`
          : ` Total ${totalFor(this.state.players[0])}, par ${this.puzzle.parValue}. Lost.`;
    // REQ-050: the score reaches assistive tech as text, not only as bar height.
    this.announce(`${sweep?.answerWord === "" ? "Blank" : sweep?.answerWord}: ${score} of 100.${suffix}`);
    document.getElementById("lb-answer")?.focus();
  }

  private async doShare(): Promise<void> {
    const text = buildShareText(this.state, this.puzzle.parValue);
    if (!isSpoilerSafe(text, this.puzzle)) {
      this.announce("Sharing blocked.");
      return;
    }
    const res = await this.svc.share.share(text);
    this.announce(res.ok ? (res.method === "clipboard" ? "Result copied." : "Result shared.") : "Sharing unavailable.");
  }

  private announce(msg: string): void {
    if (this.live !== undefined) this.live.textContent = msg;
  }

  // ===========================================================================
  // MULTIPLAYER — lobby, live round, leaderboard views (REQ-009 through REQ-048)
  // Single-player render() above is completely untouched (REQ-037).
  // ===========================================================================

  /** REQ-036: called from init() when svc.roomCode is present (join flow).
   * Sets phase to "idle" so renderLobby shows the name-entry form with the
   * room code pre-filled. The WS connection opens only after the guest
   * types their name and clicks "Join Room". (BUG-FIX: was "lobby-wait",
   * which skipped the name form entirely.)
   */
  private startMpJoin(roomCode: string): void {
    this.stopMpCountdown();
    this.stopMpTicking();
    this.mpTickCounter = 0;
    this.mpState = { ...freshMpState(), phase: "idle", roomCode };
    this.renderLobby();
  }

  /** REQ-009 (Create Room): called from lobby UI "Host a game" button. */
  private startMpCreate(): void {
    this.stopMpCountdown();
    this.stopMpTicking();
    this.mpTickCounter = 0;
    this.mpState = { ...freshMpState(), phase: "lobby-create" };
    this.renderLobby();
  }

  /** Connect the WebSocket after the user types their display name. */
  private connectMp(displayName: string): void {
    const wsUrl = buildWsUrl(RELAY_BASE_URL, this.mpState.roomCode);
    const client = new MultiplayerClient((event: ClientEvent) => this.handleMpEvent(event));
    this.mpClient = client;
    this.mpState = { ...this.mpState, myDisplayName: displayName };

    // Pass displayName in a query param (Worker reads it before routing to DO)
    const urlWithName = `${wsUrl}?name=${encodeURIComponent(displayName)}`;
    client.connect(urlWithName);
  }

  /** Handle all server-side events (REQ-016, REQ-013, REQ-031, etc.). */
  private handleMpEvent(event: ClientEvent): void {
    switch (event.kind) {
      case "open":
        // Connection established — send join/create message if needed
        break;

      case "joined":
        this.mpState = {
          ...this.mpState,
          phase: "lobby-wait",  // transition out of idle pre-connection state
          mySlotIndex: event.slotIndex,
          isHost: event.isHost,
          myDisplayName: event.displayName,
        };
        this.renderLobby();
        break;

      case "player-list":
        this.mpState = { ...this.mpState, players: event.players };
        this.renderLobby();
        break;

      case "start":
        this.mpState = {
          ...this.mpState,
          phase: "round-active",
          categoryLabel: event.categoryLabel,
          parValue: event.parValue,
          affixType: event.affixType,
          affixValue: event.affixValue,
        };
        this.renderLiveRound();
        break;

      case "sweep-start":
        this.mpState = {
          ...this.mpState,
          sweepIndex: event.sweepIndex,
          deadlineTs: event.deadlineTs,
          submissions: new Map(),
          tiebreakRound: 0,
        };
        // Reset the tension counter for the new sweep (REQ-051).
        this.stopMpTicking();
        this.mpTickCounter = 0;
        this.renderLiveRound();
        this.startMpCountdown();
        break;

      case "tiebreak-start":
        this.mpState = {
          ...this.mpState,
          tiebreakRound: event.round,
          tiedSlots: event.tiedSlots,
          deadlineTs: event.deadlineTs,
          submissions: new Map(),
        };
        this.stopMpTicking();
        this.mpTickCounter = 0;
        this.renderLiveRound();
        this.startMpCountdown();
        break;

      case "reveal": {
        const updated = new Map(this.mpState.submissions);
        updated.set(event.slotIndex, {
          word: event.word,
          score: event.score,
          verdict: event.verdict,
          runningTotal: event.runningTotal,
        });
        this.mpState = { ...this.mpState, submissions: updated };
        this.updateLiveReveal(event.slotIndex);
        // REQ-051: animate the tension counter for this player's OWN reveal only.
        if (event.slotIndex === this.mpState.mySlotIndex) {
          this.startMpTicking(event.score);
        }
        break;
      }

      case "leaderboard":
        this.mpState = { ...this.mpState, phase: "round-done", leaderboard: event.board };
        this.stopMpCountdown();
        this.stopMpTicking();
        this.renderLeaderboard();
        break;

      case "host-left":
        this.mpState = { ...this.mpState, errorMsg: "Host left — game ended." };
        this.renderLobby();
        break;

      case "error":
        this.mpState = { ...this.mpState, errorMsg: event.reason };
        if (this.mpState.phase === "round-active") {
          this.renderLiveRound();
        } else {
          this.renderLobby();
        }
        break;

      case "close":
        if (event.code !== 1000) {
          this.mpState = { ...this.mpState, errorMsg: `Disconnected (${event.reason || event.code})` };
          if (this.mpState.phase === "round-active") {
            this.renderLiveRound();
          } else {
            this.renderLobby();
          }
        }
        break;
    }
  }

  // -------------------------------------------------------------------------
  // MP countdown (REQ-043: aria-live region updated; REQ-013: deadline-based)
  // -------------------------------------------------------------------------

  /**
   * Seconds remaining in the current sweep, floored at 0.
   * Uses round() rather than ceil() so a fresh 30 000 ms deadline reads "30s"
   * for a full second instead of flicking to 29s almost immediately.
   */
  private mpSecondsLeft(): number {
    return Math.max(0, Math.round((this.mpState.deadlineTs - Date.now()) / 1000));
  }

  /**
   * Countdown text. Before the first sweep-start frame arrives deadlineTs is 0,
   * which would render a misleading "0s"; show an em dash until a real deadline
   * is known.
   */
  private mpCountdownText(): string {
    return this.mpState.deadlineTs === 0 ? "—" : `${this.mpSecondsLeft()}s`;
  }

  /** Paint the countdown. Single source of truth for both render and tick. */
  private paintMpCountdown(): void {
    const cdEl = this.root.querySelector(".lb-mp-countdown");
    if (cdEl !== null) cdEl.textContent = this.mpCountdownText();
  }

  private startMpCountdown(): void {
    this.stopMpCountdown();
    let lastAnnounced = -1;
    // Paint immediately: setInterval's first tick is 250 ms away, and until then
    // the element would keep the previous sweep's value — the visible "timer did
    // not reset" glitch between sweeps.
    this.paintMpCountdown();
    this.countdownTimer = setInterval(() => {
      const secsLeft = this.mpSecondsLeft();
      this.paintMpCountdown();
      // Announce at 10s, 5s for screen readers (REQ-043)
      if ((secsLeft === 10 || secsLeft === 5) && secsLeft !== lastAnnounced) {
        lastAnnounced = secsLeft;
        const liveEl = this.root.querySelector(".sr-live");
        if (liveEl) liveEl.textContent = `${secsLeft} seconds remaining`;
      }
      if (secsLeft === 0) this.stopMpCountdown();
    }, 250);
  }

  private stopMpCountdown(): void {
    if (this.countdownTimer !== null) {
      clearInterval(this.countdownTimer);
      this.countdownTimer = null;
    }
  }

  // -------------------------------------------------------------------------
  // Multiplayer tension counter (REQ-051) — animates the bar column up to this
  // player's own revealed score, matching the single-player reveal.
  // -------------------------------------------------------------------------

  private stopMpTicking(): void {
    if (this.mpTickTimer !== null) {
      clearInterval(this.mpTickTimer);
      this.mpTickTimer = null;
    }
  }

  /** Animate the counter from 0 up to `target`, then stop. */
  private startMpTicking(target: number): void {
    this.stopMpTicking();
    this.mpTickCounter = 0;
    this.paintMpCounter();
    if (this.reducedMotion) {
      // Respect prefers-reduced-motion: jump straight to the final value.
      this.mpTickCounter = target;
      this.paintMpCounter();
      return;
    }
    this.mpTickTimer = setInterval(() => {
      if (!this.root.isConnected || this.mpTickCounter >= target) {
        this.mpTickCounter = Math.min(this.mpTickCounter, target);
        this.stopMpTicking();
        return;
      }
      this.mpTickCounter += 1;
      this.paintMpCounter();
    }, TICK_MS);
  }

  /** Repaint only the counter bars/readout, without rebuilding the view. */
  private paintMpCounter(): void {
    const col = this.root.querySelector(".lb-bars");
    const num = this.root.querySelector(".lb-score-num");
    if (col !== null) {
      col.querySelectorAll(".lb-bar").forEach((bar, i) => {
        bar.classList.toggle("lb-bar-on", isBarLit(i, this.mpTickCounter));
      });
    }
    if (num !== null) num.textContent = String(this.mpTickCounter);
  }

  // -------------------------------------------------------------------------
  // REQ-009: Lobby view (Create + Join + waiting list)
  // REQ-044: keyboard Tab order; REQ-061: aria-labels
  // -------------------------------------------------------------------------

  private renderLobby(): void {
    this.root.innerHTML = "";
    this.root.className = "game lowball";
    this.root.append(homeBar(this.svc, "Lowball — Multiplayer"));

    const live = liveRegion();
    this.root.append(live);
    this.live = live;

    const s = this.mpState;

    // Error/status message
    if (s.errorMsg) {
      const err = el("p", { class: "error", text: s.errorMsg });
      err.setAttribute("role", "alert");
      this.root.append(err);
    }

    if (s.phase === "idle" || s.phase === "lobby-create") {
      // Pre-connection: show name entry + create/join options
      this.root.append(el("h2", { class: "lb-mp-title", text: "Host a game" }));
      this.root.append(el("p", { class: "sub", text: "Up to 4 players · Lowest score wins" }));

      const nameLabel = el("label", { class: "lb-mp-label", text: "Your name" }) as HTMLLabelElement;
      nameLabel.htmlFor = "lb-mp-name";
      const nameInput = el("input", { class: "text-input" }) as HTMLInputElement;
      nameInput.id = "lb-mp-name";
      nameInput.type = "text";
      nameInput.maxLength = 20;
      nameInput.setAttribute("aria-label", "Your display name — shown to other players");
      nameInput.setAttribute("autocomplete", "off");

      const hostBtn = el("button", { text: "Create Room", class: "btn" }) as HTMLButtonElement;
      hostBtn.type = "button";
      hostBtn.addEventListener("click", () => {
        const v = validateDisplayName(nameInput.value);
        if (!v.valid) {
          this.mpState = { ...this.mpState, errorMsg: v.error ?? "Invalid name." };
          // Re-render to show error (REQ-004)
          this.renderLobby();
          // Announce for screen readers
          live.textContent = v.error ?? "Invalid name.";
          return;
        }
        // POST /create to generate room code, then connect WS
        void this.createAndConnectRoom(v.trimmed!);
      });

      const divider = el("p", { class: "lb-mp-or", text: "— or —" });

      this.root.append(el("h2", { class: "lb-mp-title", text: "Join a game" }));
      const codeLabel = el("label", { class: "lb-mp-label", text: "Room code" }) as HTMLLabelElement;
      codeLabel.htmlFor = "lb-mp-code";
      const codeInput = el("input", { class: "text-input" }) as HTMLInputElement;
      codeInput.id = "lb-mp-code";
      codeInput.type = "text";
      codeInput.maxLength = 6;
      codeInput.setAttribute("aria-label", "6-character room code — from your invite link");
      codeInput.setAttribute("autocomplete", "off");
      // REQ-038: pre-fill from invite link
      if (s.roomCode) codeInput.value = s.roomCode;

      const joinNameLabel = el("label", { class: "lb-mp-label", text: "Your name" }) as HTMLLabelElement;
      joinNameLabel.htmlFor = "lb-mp-join-name";
      const joinNameInput = el("input", { class: "text-input" }) as HTMLInputElement;
      joinNameInput.id = "lb-mp-join-name";
      joinNameInput.type = "text";
      joinNameInput.maxLength = 20;
      joinNameInput.setAttribute("aria-label", "Your display name — shown to other players");
      joinNameInput.setAttribute("autocomplete", "off");

      const joinBtn = el("button", { text: "Join Room", class: "btn" }) as HTMLButtonElement;
      joinBtn.type = "button";
      joinBtn.addEventListener("click", () => {
        const v = validateDisplayName(joinNameInput.value);
        if (!v.valid) {
          this.mpState = { ...this.mpState, errorMsg: v.error ?? "Invalid name." };
          this.renderLobby();
          live.textContent = v.error ?? "Invalid name.";
          return;
        }
        const code = normalizeRoomCode(codeInput.value);
        if (!/^[A-Z0-9]{6}$/.test(code)) {
          this.mpState = { ...this.mpState, errorMsg: "Enter a valid 6-character room code." };
          this.renderLobby();
          live.textContent = "Enter a valid 6-character room code.";
          return;
        }
        this.mpState = { ...this.mpState, roomCode: code };
        this.connectMp(v.trimmed!);
      });

      // Tab order: nameInput → hostBtn → divider → codeInput → joinNameInput → joinBtn
      this.root.append(nameLabel, nameInput, hostBtn, divider, codeLabel, codeInput, joinNameLabel, joinNameInput, joinBtn);

      // Also show single-player escape hatch
      const spBtn = el("button", { text: "Play solo instead", class: "btn btn-secondary" }) as HTMLButtonElement;
      spBtn.type = "button";
      spBtn.addEventListener("click", () => {
        this.mpClient?.close();
        this.stopMpCountdown();
        this.stopMpTicking();
        this.mpState = freshMpState();
        this.startDaily();
        this.render();
      });
      this.root.append(spBtn);

    } else if (s.phase === "lobby-wait") {
      // In lobby — connected, waiting for players or for host to start
      // REQ-038: show invite link if host
      if (s.isHost && s.roomCode) {
        const inviteUrl = `${window.location.origin}${window.location.pathname}#/game/lowball?room=${s.roomCode}`;
        this.root.append(el("h2", { class: "lb-mp-title", text: "Room ready" }));
        this.root.append(el("p", { class: "sub", text: `Room code: ${s.roomCode}` }));

        const linkPara = el("p", { class: "lb-mp-invite" });
        const linkEl = el("span", { class: "lb-mp-invite-url", text: inviteUrl });
        linkPara.append(el("span", { text: "Invite link: " }), linkEl);
        this.root.append(linkPara);

        const copyBtn = el("button", { text: "Copy invite link", class: "btn btn-secondary" }) as HTMLButtonElement;
        copyBtn.type = "button";
        copyBtn.setAttribute("aria-label", "Copy invite link to clipboard");
        copyBtn.addEventListener("click", () => {
          // Try the modern Clipboard API first; fall back to execCommand which
          // works in all browser contexts including Capacitor WebViews and older
          // browsers where navigator.clipboard may be undefined or restricted.
          const fallbackCopy = () => {
            try {
              const ta = document.createElement("textarea");
              ta.value = inviteUrl;
              ta.style.position = "fixed";
              ta.style.opacity = "0";
              ta.style.top = "0";
              document.body.appendChild(ta);
              ta.focus();
              ta.select();
              const ok = document.execCommand("copy");
              document.body.removeChild(ta);
              this.live.textContent = ok ? "Link copied." : "Copy failed — paste manually.";
            } catch {
              this.live.textContent = "Copy failed — paste manually.";
            }
          };

          if (typeof navigator.clipboard?.writeText === "function") {
            navigator.clipboard.writeText(inviteUrl).then(
              () => { this.live.textContent = "Link copied."; },
              fallbackCopy,
            );
          } else {
            fallbackCopy();
          }
        });
        this.root.append(copyBtn);
      } else {
        this.root.append(el("h2", { class: "lb-mp-title", text: `Joined · ${s.roomCode}` }));
        this.root.append(el("p", { class: "sub", text: "Waiting for host to start…" }));
      }

      // Player list
      const list = el("ul", { class: "lb-mp-player-list" });
      list.setAttribute("aria-label", "Players in room");
      for (const p of s.players) {
        const li = el("li", { class: "lb-mp-player" });
        li.append(
          el("span", { class: "lb-mp-player-name", text: p.displayName }),
          el("span", { class: "lb-mp-player-role", text: p.isHost ? " (host)" : "" }),
        );
        list.append(li);
      }
      this.root.append(list);
      this.root.append(el("p", { class: "sub", text: `${s.players.length}/4 players` }));

      // REQ-009: Start button only for host with ≥2 players
      if (s.isHost) {
        const startBtn = el("button", { text: "Start Game", class: "btn" }) as HTMLButtonElement;
        startBtn.type = "button";
        const canStart = s.players.length >= 2;
        startBtn.disabled = !canStart;
        startBtn.setAttribute("aria-disabled", String(!canStart));
        startBtn.setAttribute("aria-label", canStart ? "Start game" : "Start game — need at least 2 players");
        startBtn.addEventListener("click", () => {
          if (canStart) this.mpClient?.send({ type: "start" });
        });
        this.root.append(startBtn);
      }
    }

    setTimeout(() => (this.root.querySelector("#lb-mp-name") as HTMLInputElement | null)?.focus(), 50);
  }

  /** POST /create to Worker, then open WS. */
  private async createAndConnectRoom(displayName: string): Promise<void> {
    try {
      // Use https:// for the REST call even though RELAY_BASE_URL is wss://
      const createUrl = buildHttpUrl(RELAY_BASE_URL, "/create");
      const res = await fetch(createUrl, { method: "POST" });
      if (!res.ok) throw new Error(`create failed: ${res.status}`);
      const body = await res.json() as { roomCode: string };
      const code = body.roomCode as string;
      this.mpState = { ...this.mpState, phase: "lobby-wait", roomCode: code };
      this.connectMp(displayName);
      this.renderLobby();
    } catch (err) {
      this.mpState = { ...this.mpState, errorMsg: "Could not create room. Check your connection." };
      this.renderLobby();
      console.error("[lowball-mp] create room error:", err);
    }
  }

  // -------------------------------------------------------------------------
  // REQ-016: Live round view (4-player grid, countdown, live reveals)
  // -------------------------------------------------------------------------

  private renderLiveRound(): void {
    this.root.innerHTML = "";
    this.root.className = "game lowball";
    this.root.append(homeBar(this.svc, "Lowball — Multiplayer"));

    const live = liveRegion();
    this.root.append(live);
    this.live = live;

    const s = this.mpState;
    const isTiebreak = s.tiebreakRound > 0;
    const sweepLabel = isTiebreak
      ? `Tiebreak round ${s.tiebreakRound}`
      : `Sweep ${s.sweepIndex + 1} of 2`;

    this.root.append(el("h2", { class: "lb-prompt", text: s.categoryLabel }));
    this.root.append(el("p", { class: "lb-rule", text: `${sweepLabel} · Lowest total wins` }));

    // REQ-043: countdown with aria-live (updated by startMpCountdown)
    const countdown = el("p", { class: "lb-mp-countdown", text: this.mpCountdownText() });
    countdown.setAttribute("aria-live", "off"); // programmatic announcements at 10s/5s only
    countdown.setAttribute("aria-label", "Time remaining for this sweep");
    this.root.append(countdown);

    if (s.errorMsg) {
      const err = el("p", { class: "error", text: s.errorMsg });
      err.setAttribute("role", "alert");
      this.root.append(err);
    }

    // --- tension counter (REQ-051) --------------------------------------------
    // Present in multiplayer too, so the panel-score reveal reads the same as
    // single-player. Driven by mpTickCounter, which animates up to this player's
    // own revealed score for the current sweep.
    const myReveal = s.submissions.get(s.mySlotIndex);
    const counter = el("div", { class: "lb-counter" });
    const bars = el("div", { class: "lb-bars" });
    bars.setAttribute("aria-hidden", "true"); // numeric text is the accessible channel
    for (let i = 0; i < MAX_PANEL_SCORE; i++) {
      const bar = el("span", { class: "lb-bar" });
      if (isBarLit(i, this.mpTickCounter)) bar.classList.add("lb-bar-on");
      bars.append(bar);
    }
    const readout = el("div", { class: "lb-readout" });
    readout.append(
      el("strong", { class: "lb-score-num", text: String(myReveal === undefined ? 0 : this.mpTickCounter) }),
      el("span", { class: "lb-score-of", text: " / 100" }),
    );
    counter.append(bars, readout);
    this.root.append(counter);
    // REQ-053: never imply real people were surveyed.
    this.root.append(el("p", { class: "lb-disclosure", text: PANEL_DISCLOSURE }));

    // 2×2 player grid (REQ-016 live reveals)
    const grid = el("div", { class: "lb-mp-grid" });
    grid.setAttribute("role", "group");
    grid.setAttribute("aria-label", "Players");
    for (const p of s.players) {
      const isMe = p.slotIndex === s.mySlotIndex;
      const isTiedActive = isTiebreak && s.tiedSlots.includes(p.slotIndex);
      const isSpectating = isTiebreak && !isTiedActive;
      const reveal = s.submissions.get(p.slotIndex);

      const card = el("div", { class: `lb-mp-card${isMe ? " lb-mp-card-me" : ""}${isSpectating ? " lb-mp-card-spectate" : ""}` });
      card.append(el("div", { class: "lb-mp-card-name", text: p.displayName + (isMe ? " (you)" : "") + (p.isHost ? " ★" : "") }));

      if (reveal) {
        card.append(el("div", { class: "lb-mp-card-word", text: reveal.word ?? "(timeout)" }));
        card.append(el("div", { class: "lb-mp-card-score", text: String(reveal.score) }));
        card.append(el("div", { class: "lb-mp-card-total", text: `Total: ${reveal.runningTotal}` }));
      } else {
        card.append(el("div", { class: "lb-mp-card-pending", text: isSpectating ? "Spectating" : "Thinking…" }));
      }
      grid.append(card);
    }
    this.root.append(grid);

    // Answer input — only shown if it's my turn and I haven't submitted
    const iAmTiedActive = !isTiebreak || s.tiedSlots.includes(s.mySlotIndex);
    const iHaveSubmitted = s.submissions.has(s.mySlotIndex);
    if (iAmTiedActive && !iHaveSubmitted) {
      const form = el("form", { class: "row" }) as HTMLFormElement;
      const input = el("input", { class: "text-input" }) as HTMLInputElement;
      input.id = "lb-mp-answer";
      input.type = "text";
      input.autocomplete = "off";
      input.setAttribute("aria-label", `Your answer — ${s.categoryLabel}`);
      const submitBtn = el("button", { text: "Submit", class: "btn" }) as HTMLButtonElement;
      submitBtn.type = "submit";
      form.append(input, submitBtn);
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        const word = input.value;
        if (word.trim()) {
          this.mpClient?.send({ type: "submit", word: word.trim() });
          input.value = "";
          input.disabled = true;
          submitBtn.disabled = true;
        }
      });
      this.root.append(form);
      setTimeout(() => input.focus(), 50);
    } else if (iAmTiedActive && iHaveSubmitted) {
      this.root.append(el("p", { class: "sub", text: "Answer locked in — waiting for others…" }));
    } else {
      this.root.append(el("p", { class: "sub", text: "Spectating this tiebreak sweep" }));
    }
  }

  /** Partial DOM update for a single player card (REQ-016 live reveal). */
  private updateLiveReveal(slotIndex: number): void {
    const reveal = this.mpState.submissions.get(slotIndex);
    if (!reveal) return;
    const cards = this.root.querySelectorAll(".lb-mp-card");
    const card = Array.from(cards).find((_, i) => this.mpState.players[i]?.slotIndex === slotIndex);
    if (!card) return;

    // Update pending → revealed
    const pending = card.querySelector(".lb-mp-card-pending");
    if (pending) pending.remove();
    // Insert score if not already there
    if (!card.querySelector(".lb-mp-card-score")) {
      card.append(el("div", { class: "lb-mp-card-word", text: reveal.word ?? "(timeout)" }));
      card.append(el("div", { class: "lb-mp-card-score", text: String(reveal.score) }));
      card.append(el("div", { class: "lb-mp-card-total", text: `Total: ${reveal.runningTotal}` }));
    }
    // Announce for screen readers
    const player = this.mpState.players.find((p) => p.slotIndex === slotIndex);
    if (player && this.live) {
      this.live.textContent = `${player.displayName}: ${reveal.word ?? "timeout"}, score ${reveal.score}.`;
    }
  }

  // -------------------------------------------------------------------------
  // REQ-031 + REQ-032: Leaderboard view
  // -------------------------------------------------------------------------

  private renderLeaderboard(): void {
    this.root.innerHTML = "";
    this.root.className = "game lowball";
    this.root.append(homeBar(this.svc, "Lowball — Multiplayer"));

    const live = liveRegion();
    this.root.append(live);
    this.live = live;

    const board = this.mpState.leaderboard ?? [];

    this.root.append(el("h2", { class: "lb-mp-title", text: "Final Scores" }));
    this.root.append(el("p", { class: "sub", text: this.dayId }));

    const grid = el("div", { class: "lb-mp-leaderboard" });
    grid.setAttribute("role", "list");
    grid.setAttribute("aria-label", "Final leaderboard");
    for (const entry of [...board].sort((a, b) => a.rank - b.rank)) {
      const isMe = entry.slotIndex === this.mpState.mySlotIndex;
      const isWinner = entry.rank === 1;
      const card = el("div", { class: `lb-mp-lb-row${isMe ? " lb-mp-lb-me" : ""}${isWinner ? " win" : ""}` });
      card.setAttribute("role", "listitem");
      card.append(
        el("span", { class: "lb-mp-lb-rank", text: entry.isJointWinner ? "=" : `#${entry.rank}` }),
        el("span", { class: "lb-mp-lb-name", text: entry.displayName + (isMe ? " (you)" : "") }),
        el("span", { class: "lb-mp-lb-total", text: String(entry.roundTotal) }),
      );
      grid.append(card);
    }
    this.root.append(grid);

    // REQ-032: Share button
    // In MP mode the puzzle isn't loaded locally; we pass null so isMpShareSpoilerSafe
    // is skipped (spoiler safety for MP share relies on buildMpShareText's structural
    // guarantee that no answer words are included, same pattern as buildShareText).
    const shareBtn = el("button", { text: "Share result", class: "btn btn-secondary" }) as HTMLButtonElement;
    shareBtn.type = "button";
    shareBtn.setAttribute("aria-label", "Share your multiplayer result");
    shareBtn.addEventListener("click", () => {
      void this.doMpShare(board, null);
    });
    this.root.append(shareBtn);

    // Play again / back to solo
    const soloBtn = el("button", { text: "Play solo", class: "btn btn-secondary" }) as HTMLButtonElement;
    soloBtn.type = "button";
    soloBtn.addEventListener("click", () => {
      this.mpClient?.close();
      this.stopMpCountdown();
      this.stopMpTicking();
      this.mpState = freshMpState();
      this.startDaily();
      this.render();
    });
    this.root.append(soloBtn);

    // Announce winner for screen readers
    const winner = board.find((e) => e.rank === 1);
    if (winner) {
      live.textContent = winner.isJointWinner
        ? `Joint winners! Tied with total ${winner.roundTotal}.`
        : winner.slotIndex === this.mpState.mySlotIndex
          ? `You won! Total ${winner.roundTotal}.`
          : `${winner.displayName} won with total ${winner.roundTotal}.`;
    }
  }

  private async doMpShare(board: MpLeaderboardEntry[], puzzle: Puzzle | null): Promise<void> {
    const text = buildMpShareText(board, this.mpState.mySlotIndex, this.dayId);
    if (puzzle && !isMpShareSpoilerSafe(text, puzzle)) {
      this.announce("Sharing blocked — spoiler detected.");
      return;
    }
    const res = await this.svc.share.share(text);
    this.announce(res.ok ? (res.method === "clipboard" ? "Result copied." : "Result shared.") : "Sharing unavailable.");
  }
}

const INVALID_LABEL: Record<InvalidReason, string> = {
  not_in_list: "Not in the answer list — scored 100.",
  affix_mismatch: "Does not fit the category — scored 100.",
  duplicate: "Already given — scored 100.",
  empty: "No answer entered — scored 100.",
};

export const lowballPlugin: GamePlugin = {
  meta: {
    id: "lowball",
    name: "Lowball",
    tagline: "Correct but obscure — the rarer your answer, the lower your score.",
    glyph: "🔻",
    accent: "#a78bfa",
  },
  contentPackPath: "./lowball.json",
  async mount(root, services) {
    const game = new Lowball(root, services);
    await game.init("./lowball.json");
    game.render();
    return game;
  },
};

// Shared tiny DOM helpers (duplicated per plugin to keep plugins self-contained).
type ElOpts = { text?: string; class?: string };
function el(tag: string, opts: ElOpts = {}): HTMLElement {
  const node = document.createElement(tag);
  if (opts.text !== undefined) node.textContent = opts.text;
  if (opts.class !== undefined) node.className = opts.class;
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
