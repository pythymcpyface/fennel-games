// WhatsApp share button for the multiplayer room invite link (host lobby).
import { describe, it, expect, vi, afterEach } from "vitest";
import type { GameServices } from "../src/kit/types.ts";
import type { ClientEvent } from "../src/games/lowball/multiplayer-client.ts";
import { lowballCountriesPlugin, buildWhatsAppInviteUrl } from "../src/games/lowball/plugin.ts";

function services(): GameServices {
  return {
    storage: { read: () => null, write: () => {}, remove: () => {} },
    clock: { nowMs: () => Date.now() },
    share: { share: async () => ({ ok: true, method: "clipboard" as const }) },
    assets: { loadText: async () => JSON.stringify({ contentPackVersion: "1", datasetId: "t", puzzleCount: 1, puzzles: [{ puzzleId: "p", rule: { kind: "suffix", value: "a" }, categoryLabel: "x", parValue: 1, answers: [] }] }) },
    roomCode: "ABC123",
    keyFor: (s: string) => s,
    onResult: () => {},
    goHome: () => {},
  } as GameServices;
}

async function hostLobby(): Promise<HTMLElement> {
  const root = document.createElement("div");
  document.body.append(root);
  const game = (await lowballCountriesPlugin.mount(root, services())) as unknown as { handleMpEvent(e: ClientEvent): void };
  game.handleMpEvent({ kind: "joined", slotIndex: 0, isHost: true, displayName: "Alice" });
  return root;
}
const waButton = (root: HTMLElement) =>
  [...root.querySelectorAll("button")].find((b) => /whatsapp/i.test(b.textContent ?? ""));

describe("WhatsApp room invite", () => {
  afterEach(() => { delete (window as { ontouchstart?: unknown }).ontouchstart; vi.restoreAllMocks(); document.body.innerHTML = ""; });

  it("builds a wa.me link with the game name and invite URL", () => {
    const url = buildWhatsAppInviteUrl("Lowball: Countries", "https://x.test/#/game/lowball-countries?room=ABC123");
    expect(url.startsWith("https://wa.me/?text=")).toBe(true);
    expect(decodeURIComponent(url.split("text=")[1])).toBe("Join my Lowball: Countries game: https://x.test/#/game/lowball-countries?room=ABC123");
  });

  it("shows the button to the host on touch devices and opens WhatsApp with the invite", async () => {
    (window as { ontouchstart?: unknown }).ontouchstart = null;
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    const root = await hostLobby();
    const btn = waButton(root);
    expect(btn?.textContent).toContain("Share invite on WhatsApp");
    btn!.click();
    const text = decodeURIComponent(String(open.mock.calls[0][0]).split("text=")[1]);
    expect(text).toMatch(/^Join my Lowball: Countries game: .*#\/game\/lowball-countries\?room=ABC123$/);
  });

  it("hides the button on non-touch (desktop) browsers", async () => {
    const root = await hostLobby();
    expect(waButton(root)).toBeUndefined();
  });
});
