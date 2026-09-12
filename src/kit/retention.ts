import type { StoragePort, ClockPort } from "./ports.ts";
import { loadStats } from "./stats.ts";
import { canonicalizeDayId } from "./selection.ts";

// Shared retention UI — REQ-009/010/011. Pure DOM; offline; no new network. Reads the
// existing per-game shared Stats (kit/stats.ts) from the game's namespaced storage key.

/** REQ-009/010 — accessible stats/streak modal with focus trap + Escape to close. */
export function openStatsModal(opts: {
  gameName: string;
  statsKey: string;
  storage: StoragePort;
  opener?: HTMLElement | null;
}): void {
  const s = loadStats(opts.storage, opts.statsKey);
  const winPct = s.played > 0 ? Math.round((s.won / s.played) * 100) : 0;

  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  const modal = document.createElement("div");
  modal.className = "modal";
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "true");
  modal.setAttribute("aria-label", `${opts.gameName} statistics`);

  const h = document.createElement("h2");
  h.className = "modal-title";
  h.textContent = `${opts.gameName} — Statistics`;
  modal.append(h);

  if (s.played === 0) {
    const empty = document.createElement("p");
    empty.className = "modal-empty";
    empty.textContent = "No games played yet. Solve today's puzzle to start your streak!";
    modal.append(empty);
  } else {
    const grid = document.createElement("div");
    grid.className = "stats-grid";
    for (const [label, value] of [
      ["Played", String(s.played)],
      ["Win %", `${winPct}`],
      ["Current streak", String(s.currentStreak)],
      ["Max streak", String(s.maxStreak)],
    ] as const) {
      const cell = document.createElement("div");
      cell.className = "stat-cell";
      const v = document.createElement("div");
      v.className = "stat-value";
      v.textContent = value;
      const l = document.createElement("div");
      l.className = "stat-label";
      l.textContent = label;
      cell.append(v, l);
      grid.append(cell);
    }
    modal.append(grid);
  }

  const close = document.createElement("button");
  close.type = "button";
  close.className = "btn btn-secondary modal-close";
  close.textContent = "Close";
  modal.append(close);
  overlay.append(modal);
  document.body.append(overlay);

  const focusable = () => Array.from(modal.querySelectorAll<HTMLElement>("button, [tabindex]"));
  const dismiss = () => {
    overlay.remove();
    document.removeEventListener("keydown", onKey);
    opts.opener?.focus();
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") { e.preventDefault(); dismiss(); return; }
    if (e.key === "Tab") {
      const items = focusable();
      if (items.length === 0) return;
      const first = items[0], last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  };
  close.addEventListener("click", dismiss);
  overlay.addEventListener("click", (e) => { if (e.target === overlay) dismiss(); });
  document.addEventListener("keydown", onKey);
  close.focus();
}

/**
 * REQ-011 — seconds until the next UTC daily rollover (offline, device-clock based).
 * Games roll over at UTC midnight (matches canonicalizeDayId's UTC boundary).
 */
export function secondsUntilNextPuzzle(clock: ClockPort): number {
  const now = clock.nowMs();
  const day = 24 * 60 * 60 * 1000;
  const startOfTodayUtc = Date.parse(canonicalizeDayId(now, "UTC") + "T00:00:00Z");
  const next = startOfTodayUtc + day;
  return Math.max(0, Math.floor((next - now) / 1000));
}

/** Format seconds as H:MM:SS for the countdown display. */
export function formatCountdown(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${h}:${pad(m)}:${pad(s)}`;
}
