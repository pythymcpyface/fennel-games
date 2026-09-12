import { describe, it, expect, beforeEach } from "vitest";
import { revealCells, shake, celebrate } from "../src/kit/juice.ts";

// Juice helpers are DOM effects; verify they no-op safely and apply expected classes.

beforeEach(() => { document.body.innerHTML = ""; });

describe("shake (REQ-007)", () => {
  it("no-ops on null / non-element", () => {
    expect(() => shake(null)).not.toThrow();
  });
  it("adds the shake class to an element", () => {
    const el = document.createElement("div");
    document.body.append(el);
    shake(el);
    expect(el.classList.contains("shake")).toBe(true);
  });
});

describe("revealCells (REQ-006)", () => {
  it("no-ops on empty list", () => {
    expect(() => revealCells([])).not.toThrow();
  });
  it("adds flip + a per-cell delay var", () => {
    const a = document.createElement("span");
    const b = document.createElement("span");
    document.body.append(a, b);
    revealCells([a, b], 30);
    expect(a.classList.contains("flip")).toBe(true);
    expect(b.classList.contains("flip")).toBe(true);
    // delay var is set (0 under jsdom reduced-motion-unknown, but present)
    expect(a.style.getPropertyValue("--flip-delay")).toMatch(/ms$/);
  });
});

describe("celebrate (REQ-008)", () => {
  it("no-ops on null", () => {
    expect(() => celebrate(null)).not.toThrow();
  });
  it("adds win-pop to the banner", () => {
    const banner = document.createElement("p");
    banner.className = "win";
    document.body.append(banner);
    celebrate(banner, "var(--cds-support-success)");
    expect(banner.classList.contains("win-pop")).toBe(true);
  });
});
