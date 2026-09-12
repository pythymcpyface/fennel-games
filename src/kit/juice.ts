// Shared game-feel ("juice") helpers — REQ-006/007/008. Reduced-motion aware.
// Pure DOM/CSS helpers; no game state, no network. Games opt in via these functions
// and the matching CSS classes in styles.css. All effects degrade gracefully when
// prefers-reduced-motion is set (handled in CSS) and no-op on missing nodes (ERROR-002).

function prefersReducedMotion(): boolean {
  return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * REQ-006 — staggered tile-flip/reveal on a row of result cells. Adds the `.flip`
 * class with an incremental delay; under reduced motion the CSS makes it instant.
 * Safe if `cells` is empty or contains detached nodes.
 */
export function revealCells(cells: ArrayLike<Element>, stepMs = 30): void {
  const list = Array.from(cells);
  list.forEach((cell, i) => {
    if (!(cell instanceof HTMLElement)) return;
    const delay = prefersReducedMotion() ? 0 : i * stepMs;
    cell.style.setProperty("--flip-delay", `${delay}ms`);
    // restart animation if re-revealed
    cell.classList.remove("flip");
    void cell.offsetWidth; // reflow to retrigger
    cell.classList.add("flip");
  });
}

/**
 * REQ-007 — invalid-input shake on an element. Non-color feedback; the caller is
 * still responsible for the aria-live message + text/icon (the games already do this).
 * Under reduced motion the CSS suppresses movement (a brief outline pulse remains).
 */
export function shake(el: Element | null): void {
  if (!(el instanceof HTMLElement)) return;
  el.classList.remove("shake");
  void el.offsetWidth;
  el.classList.add("shake");
  el.addEventListener("animationend", () => el.classList.remove("shake"), { once: true });
}

/**
 * REQ-008 — win celebration. Adds a celebratory pop to the banner and, unless reduced
 * motion is set, sprinkles a few lightweight confetti pieces (pure DOM, no library, no
 * network). Auto-cleans up. `accent` colors the confetti to the game's accent.
 */
export function celebrate(banner: Element | null, accent = "var(--cds-support-success)"): void {
  if (!(banner instanceof HTMLElement)) return;
  banner.classList.remove("win-pop");
  void banner.offsetWidth;
  banner.classList.add("win-pop");
  if (prefersReducedMotion()) return;

  const host = document.createElement("div");
  host.className = "confetti-host";
  host.setAttribute("aria-hidden", "true");
  const colors = [accent, "var(--cds-support-warning)", "var(--cds-support-info)", "var(--cds-text-primary)"];
  for (let i = 0; i < 24; i++) {
    const p = document.createElement("i");
    p.className = "confetti-bit";
    p.style.left = `${Math.random() * 100}%`;
    p.style.background = colors[i % colors.length];
    p.style.animationDelay = `${Math.random() * 120}ms`;
    p.style.transform = `rotate(${Math.random() * 360}deg)`;
    host.append(p);
  }
  banner.append(host);
  setTimeout(() => host.remove(), 1400);
}
