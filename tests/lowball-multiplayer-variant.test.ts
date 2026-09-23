import { describe, expect, it } from "vitest";
import { buildInviteUrl } from "../src/games/lowball/plugin.ts";

describe("Lowball multiplayer variant routing", () => {
  it("keeps Countries invite links on the Countries route", () => {
    expect(buildInviteUrl("https://example.test", "/fennel-games/", "lowball-countries", "HHA7RT"))
      .toBe("https://example.test/fennel-games/#/game/lowball-countries?room=HHA7RT");
  });

  it("keeps standard Lowball invite links unchanged", () => {
    expect(buildInviteUrl("https://example.test", "/fennel-games/", "lowball", "ABC123"))
      .toBe("https://example.test/fennel-games/#/game/lowball?room=ABC123");
  });
});
