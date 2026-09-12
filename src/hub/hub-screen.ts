import type { GamePlugin, DailyResult } from "../kit/types.ts";
import { isDevMode, devOverrideKey } from "../kit/dev.ts";

// NYT-style selection grid + shared streak summary. Pure DOM render.

export interface DevControls {
  read(key: string): string | null;
  write(key: string, value: string): void;
}

export function renderHubScreen(
  root: HTMLElement,
  plugins: GamePlugin[],
  results: Map<string, DailyResult>,
  onOpen: (gameId: string) => void,
  dev?: DevControls,
): void {
  root.innerHTML = "";
  root.className = "hub";

  const header = document.createElement("header");
  header.className = "hub-header";
  const h1 = document.createElement("h1");
  h1.textContent = "Fennel Games";
  const sub = document.createElement("p");
  sub.className = "hub-sub";
  sub.textContent = "A new set of word puzzles every day.";
  header.append(h1, sub);

  const grid = document.createElement("div");
  grid.className = "hub-grid";
  grid.setAttribute("role", "list");

  for (const plugin of plugins) {
    const { meta } = plugin;
    const result = results.get(meta.id);
    const card = document.createElement("button");
    card.type = "button";
    card.className = "hub-card";
    card.style.setProperty("--card-accent", meta.accent);
    card.setAttribute("role", "listitem");
    card.setAttribute(
      "aria-label",
      `${meta.name}: ${meta.tagline}. ${statusLabel(result)}`,
    );

    const glyph = document.createElement("span");
    glyph.className = "hub-glyph";
    glyph.textContent = meta.glyph;
    glyph.setAttribute("aria-hidden", "true");

    const name = document.createElement("span");
    name.className = "hub-name";
    name.textContent = meta.name;

    const tag = document.createElement("span");
    tag.className = "hub-tagline";
    tag.textContent = meta.tagline;

    const status = document.createElement("span");
    status.className = `hub-status ${result?.solved ? "solved" : result?.played ? "played" : "new"}`;
    status.textContent = statusLabel(result);

    card.append(glyph, name, tag, status);
    card.addEventListener("click", () => onOpen(meta.id));
    grid.append(card);
  }

  // Shared streak/summary board.
  const solvedToday = [...results.values()].filter((r) => r.solved).length;
  const board = document.createElement("p");
  board.className = "hub-board";
  board.textContent = `${solvedToday} of ${plugins.length} solved today`;

  root.append(header, grid, board);

  // Dev panel: only shown when dev mode is active (URL ?dev=1 or persisted flag).
  if (dev && isDevMode({ read: dev.read })) {
    root.append(renderDevPanel(plugins, dev));
  }
}

function renderDevPanel(plugins: GamePlugin[], dev: DevControls): HTMLElement {
  const panel = document.createElement("section");
  panel.className = "hub-dev";
  panel.setAttribute("aria-label", "Developer puzzle overrides");
  const h = document.createElement("h2");
  h.className = "hub-dev-title";
  h.textContent = "Dev: force a puzzle (index or start word)";
  panel.append(h);

  const note = document.createElement("p");
  note.className = "hub-dev-note";
  note.textContent = "Set a puzzle index (e.g. 12) or a start/target word. Blank = normal daily puzzle. Overrides apply next time you open the game.";
  panel.append(note);

  for (const plugin of plugins) {
    const row = document.createElement("div");
    row.className = "hub-dev-row";

    const label = document.createElement("label");
    label.className = "hub-dev-label";
    const key = devOverrideKey(plugin.meta.id);
    label.textContent = plugin.meta.name;
    label.htmlFor = `dev-${plugin.meta.id}`;

    const input = document.createElement("input");
    input.className = "hub-dev-input";
    input.id = `dev-${plugin.meta.id}`;
    input.type = "text";
    input.autocomplete = "off";
    input.placeholder = "index or word";
    input.value = dev.read(key) ?? "";
    input.setAttribute("aria-label", `${plugin.meta.name} puzzle override`);
    input.addEventListener("change", () => dev.write(key, input.value.trim()));

    row.append(label, input);
    panel.append(row);
  }
  return panel;
}

function statusLabel(result: DailyResult | undefined): string {
  if (!result || !result.played) return "New";
  return result.solved ? "Solved" : "In progress";
}
