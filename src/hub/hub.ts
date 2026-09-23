import type { PlatformAdapter } from "../kit/ports.ts";
import type { GamePlugin, GameServices, DailyResult, GameInstance } from "../kit/types.ts";
import { canonicalizeDayId } from "../kit/selection.ts";
import { isDevMode, setDevMode } from "../kit/dev.ts";
import { renderHubScreen } from "./hub-screen.ts";
import { celebrate, revealCells } from "../kit/juice.ts";
import { openStatsModal, secondsUntilNextPuzzle, formatCountdown } from "../kit/retention.ts";

// Hub shell: owns routing (hash-based), the platform adapter, and shared services.
// Games are registered as plugins and mounted on demand.

const STORAGE_ROOT = "fennel-games:v1:";

export class Hub {
  private results = new Map<string, DailyResult>();
  private active: GameInstance | null = null;
  private juiceObserver: MutationObserver | null = null;
  private retentionObserver: MutationObserver | null = null;
  private countdownTimer = 0;

  constructor(
    private readonly adapter: PlatformAdapter,
    private readonly plugins: GamePlugin[],
    private readonly root: HTMLElement,
  ) {}

  start(): void {
    // Persist dev mode if activated via ?dev=1 so it survives SPA navigation.
    if (isDevMode({ read: (k) => this.adapter.storage.read(k) })) {
      setDevMode((k, v) => this.adapter.storage.write(k, v), true);
    }
    // Preload today's cached results per game for the dashboard.
    const dayId = canonicalizeDayId(this.adapter.clock.nowMs(), "UTC");
    for (const p of this.plugins) {
      const raw = this.adapter.storage.read(`${STORAGE_ROOT}${p.meta.id}:result:${dayId}`);
      if (raw) {
        try {
          this.results.set(p.meta.id, JSON.parse(raw) as DailyResult);
        } catch {
          /* ignore */
        }
      }
    }
    window.addEventListener("hashchange", () => this.route());
    this.route();
  }

  private route(): void {
    const hash = window.location.hash.replace(/^#/, "");
    // REQ-036: extract optional ?room= query param from the hash fragment
    // (browsers include the query string in window.location.hash after the #).
    // Example: "#/game/lowball?room=ABC123" → path="/game/lowball", roomCode="ABC123"
    const [path = "", queryPart = ""] = hash.split("?") as [string, string | undefined];
    const roomCode = new URLSearchParams(queryPart ?? "").get("room") ?? undefined;
    const m = path.match(/^\/game\/([a-z0-9-]+)$/);
    if (m) {
      const plugin = this.plugins.find((p) => p.meta.id === m[1]);
      if (plugin) {
        // Lowball variants use the room code to enter multiplayer; other games do not.
        void this.openGame(plugin, plugin.meta.id.startsWith("lowball") ? roomCode : undefined);
        return;
      }
    }
    this.showHub();
  }

  private showHub(): void {
    this.active = null;
    this.juiceObserver?.disconnect();
    this.juiceObserver = null;
    this.retentionObserver?.disconnect();
    this.retentionObserver = null;
    clearInterval(this.countdownTimer);
    renderHubScreen(this.root, this.plugins, this.results, (id) => {
      window.location.hash = `#/game/${id}`;
    }, {
      read: (k) => this.adapter.storage.read(k),
      write: (k, v) => this.adapter.storage.write(k, v),
    });
  }

  private async openGame(plugin: GamePlugin, roomCode?: string): Promise<void> {
    // Direct game→game hash navigation (no showHub() in between) previously left the
    // outgoing game's juice/retention MutationObservers attached. The stale retention
    // observer's inject() closure carried the OLD game's name/statsKey, and its guard
    // (`!bar.querySelector(".stats-btn")`) fired first against the new game's freshly
    // mounted `.game-bar`, planting a Stats button that opened the wrong game's modal.
    // Disconnecting here mirrors the cleanup showHub() already performs.
    this.juiceObserver?.disconnect();
    this.juiceObserver = null;
    this.retentionObserver?.disconnect();
    this.retentionObserver = null;
    clearInterval(this.countdownTimer);
    this.root.innerHTML = "";
    // REQ-036: pass roomCode into services so the lowball plugin can pre-fill
    // the join screen. All other 49 games receive services without roomCode (REQ-037).
    const services = this.servicesFor(plugin.meta.id, roomCode);
    try {
      this.active = await plugin.mount(this.root, services);
      // seed the dashboard with the freshly-mounted game's result.
      this.results.set(plugin.meta.id, this.active.currentResult());
      this.attachJuice(plugin.meta.accent);
      this.attachRetention(plugin.meta.id, plugin.meta.name);
    } catch (err) {
      this.root.innerHTML = "";
      const p = document.createElement("p");
      p.className = "hub-error";
      p.setAttribute("role", "alert");
      p.textContent = "This game could not be loaded.";
      this.root.append(p);
      // eslint-disable-next-line no-console
      console.error(err);
    }
  }

  /**
   * REQ-006/008 — attach shared juice to the active game root with zero per-plugin
   * changes: celebrate once when a `.win` first appears, and flip freshly-rendered
   * result rows. Reduced-motion handled inside the juice helpers/CSS.
   */
  private attachJuice(accent: string): void {
    this.juiceObserver?.disconnect();
    let celebrated = false;
    const obs = new MutationObserver(() => {
      const win = this.root.querySelector(".win");
      if (win && !celebrated) {
        celebrated = true;
        celebrate(win, accent);
      }
      if (!win) celebrated = false; // reset when leaving the solved view
      // Flip the latest result row if present (Overlap/Emoji/etc.).
      const rows = this.root.querySelectorAll(".grid-row:last-child .cell");
      if (rows.length) revealCells(rows);
      // Bespoke per-family flourishes on freshly-marked elements (idempotent via class guard).
      this.root.querySelectorAll(".num-clue.solved, .hh-token.solved, .vg-skel.solved").forEach((elm) => {
        if (!elm.classList.contains("fl-done")) { elm.classList.add("fl-done", "fl-materialise"); }
      });
      this.root.querySelectorAll(".cs-half.locked, .match-row.locked, .deg-item.locked").forEach((elm) => {
        if (!elm.classList.contains("fl-done")) { elm.classList.add("fl-done", "fl-snap"); }
      });
    });
    obs.observe(this.root, { childList: true, subtree: true });
    this.juiceObserver = obs;
  }

  /**
   * REQ-009/011 — inject a Stats button into the game bar and a next-puzzle countdown
   * onto the completion view, with no per-plugin changes. Idempotent per render.
   */
  private attachRetention(gameId: string, gameName: string): void {
    this.retentionObserver?.disconnect();
    const ns = `${STORAGE_ROOT}${gameId}:`;
    const statsKey = `${ns}stats`;
    const inject = () => {
      // Stats button in the game bar.
      const bar = this.root.querySelector(".game-bar");
      if (bar && !bar.querySelector(".stats-btn")) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "stats-btn";
        btn.textContent = "Stats";
        btn.setAttribute("aria-label", `${gameName} statistics`);
        btn.addEventListener("click", () =>
          openStatsModal({ gameName, statsKey, storage: this.adapter.storage, opener: btn }),
        );
        bar.append(btn);
      }
      // Countdown on the completion view.
      const end = this.root.querySelector(".win, .lose");
      if (end && !this.root.querySelector(".next-countdown")) {
        const box = document.createElement("p");
        box.className = "next-countdown";
        box.setAttribute("aria-live", "off");
        end.after(box);
        const tick = () => {
          if (!box.isConnected) { clearInterval(this.countdownTimer); return; }
          box.textContent = `Next puzzle in ${formatCountdown(secondsUntilNextPuzzle(this.adapter.clock))}`;
        };
        tick();
        clearInterval(this.countdownTimer);
        this.countdownTimer = setInterval(tick, 1000) as unknown as number;
      }
    };
    inject(); // initial pass — the game bar exists at mount time
    const obs = new MutationObserver(inject);
    obs.observe(this.root, { childList: true, subtree: true });
    this.retentionObserver = obs;
  }

  private servicesFor(gameId: string, roomCode?: string): GameServices {
    const ns = `${STORAGE_ROOT}${gameId}:`;
    return {
      storage: this.adapter.storage,
      clock: this.adapter.clock,
      share: this.adapter.share,
      assets: this.adapter.assets,
      // REQ-036: roomCode is forwarded to the lowball plugin; undefined for all others.
      roomCode,
      keyFor: (suffix) => `${ns}${suffix}`,
      onResult: (result) => {
        this.results.set(gameId, result);
        const dayId = result.dayId;
        this.adapter.storage.write(`${ns}result:${dayId}`, JSON.stringify(result));
      },
      goHome: () => {
        window.location.hash = "#/";
      },
    };
  }
}
