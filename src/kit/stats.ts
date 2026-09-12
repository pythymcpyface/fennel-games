import type { StoragePort } from "./ports.ts";

// Shared per-game stats + streak (unified across all hub games). Pure logic +
// storage helpers. Each game gets an isolated namespace via keyFor().

export const STATS_SCHEMA_VERSION = 1;

export interface Stats {
  schemaVersion: number;
  played: number;
  won: number;
  currentStreak: number;
  maxStreak: number;
  playedDays: string[];
  wonDays: string[];
  lastWonDay: string | null;
}

export function emptyStats(): Stats {
  return {
    schemaVersion: STATS_SCHEMA_VERSION,
    played: 0,
    won: 0,
    currentStreak: 0,
    maxStreak: 0,
    playedDays: [],
    wonDays: [],
    lastWonDay: null,
  };
}

export function isNextDay(a: string, b: string): boolean {
  const da = Date.parse(a + "T00:00:00Z");
  const db = Date.parse(b + "T00:00:00Z");
  if (Number.isNaN(da) || Number.isNaN(db)) return false;
  return db - da === 24 * 60 * 60 * 1000;
}

export function recordPlayed(stats: Stats, dayId: string): Stats {
  if (stats.playedDays.includes(dayId)) return stats;
  return { ...stats, played: stats.played + 1, playedDays: [...stats.playedDays, dayId] };
}

export function recordWon(stats: Stats, dayId: string): Stats {
  if (stats.wonDays.includes(dayId)) return stats;
  const continues = stats.lastWonDay !== null && isNextDay(stats.lastWonDay, dayId);
  const currentStreak = continues ? stats.currentStreak + 1 : 1;
  return {
    ...stats,
    won: stats.won + 1,
    wonDays: [...stats.wonDays, dayId],
    currentStreak,
    maxStreak: Math.max(stats.maxStreak, currentStreak),
    lastWonDay: dayId,
  };
}

export function migrateStats(raw: unknown): Stats {
  if (typeof raw !== "object" || raw === null) return emptyStats();
  const r = raw as Record<string, unknown>;
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0);
  const arr = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
  const stats: Stats = {
    schemaVersion: STATS_SCHEMA_VERSION,
    played: num(r.played),
    won: num(r.won),
    currentStreak: num(r.currentStreak),
    maxStreak: num(r.maxStreak),
    playedDays: arr(r.playedDays),
    wonDays: arr(r.wonDays),
    lastWonDay: typeof r.lastWonDay === "string" ? r.lastWonDay : null,
  };
  if (stats.won > stats.played) stats.played = stats.won;
  if (stats.maxStreak < stats.currentStreak) stats.maxStreak = stats.currentStreak;
  return stats;
}

export function loadStats(storage: StoragePort, key: string): Stats {
  const raw = storage.read(key);
  if (raw === null) return emptyStats();
  try {
    return migrateStats(JSON.parse(raw));
  } catch {
    return emptyStats();
  }
}

export function saveStats(storage: StoragePort, key: string, stats: Stats): void {
  storage.write(key, JSON.stringify(stats));
}
