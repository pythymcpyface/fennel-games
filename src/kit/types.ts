// Shared kit types for the Fennel Games hub.

export type PlatformId = "web" | "ios" | "android";
export type DayBoundaryRule = "UTC";

/** Metadata describing a game on the hub selection screen. */
export interface GameMeta {
  /** stable id, used in routes and storage namespaces, e.g. "ladderless". */
  id: string;
  /** display name. */
  name: string;
  /** one-line tagline for the hub card. */
  tagline: string;
  /** short glyph/emoji shown on the card. */
  glyph: string;
  /** theme accent color (hex). */
  accent: string;
}

/**
 * A game plugin. Each game implements this to plug into the hub. The hub owns
 * routing, the platform adapter, shared stats, and the selection screen; the plugin
 * owns its content pack, rules, and its own view rendering into a provided element.
 */
export interface GamePlugin {
  meta: GameMeta;
  /** relative path to the game's bundled content pack asset. */
  contentPackPath: string;
  /**
   * Mount the game into `root` using the shared services. Returns a controller
   * handle the hub can query for the daily result summary (for the streak board).
   */
  mount(root: HTMLElement, services: GameServices): Promise<GameInstance>;
}

/** Per-day result a game reports to the hub for the shared dashboard. */
export interface DailyResult {
  gameId: string;
  dayId: string;
  played: boolean;
  solved: boolean;
}

/** Services the hub injects into each plugin. */
export interface GameServices {
  storage: import("./ports.ts").StoragePort;
  clock: import("./ports.ts").ClockPort;
  share: import("./ports.ts").SharePort;
  assets: import("./ports.ts").AssetPort;
  /**
   * REQ-036: Room code from the invite link query param (?room=<code>).
   * Only populated for the Lowball plugin when an invite link is opened;
   * undefined for all other 49 games and for direct Lowball navigation.
   */
  roomCode?: string;
  /** namespaced storage key helper so games never collide. */
  keyFor(suffix: string): string;
  /** called by the game whenever the day's result changes, for the hub dashboard. */
  onResult(result: DailyResult): void;
  /** navigate back to the hub. */
  goHome(): void;
}

export interface GameInstance {
  /** re-render (e.g. after returning to the tab). */
  render(): void;
  /** current day result for the hub dashboard. */
  currentResult(): DailyResult;
}
