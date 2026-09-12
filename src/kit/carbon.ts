// Helpers that build real IBM Carbon Web Components (<cds-button>, <cds-tag>,
// <cds-inline-notification>). Games call these instead of hand-building <button
// class="btn">, so the actual Carbon component library renders the controls.
//
// The elements are registered by ./carbon-setup.ts (imported at app start).

export type CarbonButtonKind = "primary" | "secondary" | "tertiary" | "ghost" | "danger";

export interface CarbonButtonOptions {
  text: string;
  kind?: CarbonButtonKind;
  disabled?: boolean;
  ariaLabel?: string;
  size?: "sm" | "md" | "lg";
  onClick?: () => void;
}

/**
 * Create a real <cds-button>. Falls back to a native <button class="btn"> if the
 * custom element is not defined (e.g. in the jsdom unit-test environment, where
 * Carbon's ESM is not loaded) so tests and non-browser contexts stay robust.
 */
export function carbonButton(opts: CarbonButtonOptions): HTMLElement {
  const useCarbon = typeof customElements !== "undefined" && customElements.get("cds-button") !== undefined;
  const el = document.createElement(useCarbon ? "cds-button" : "button") as HTMLElement;
  el.textContent = opts.text;
  if (useCarbon) {
    el.setAttribute("kind", opts.kind ?? "primary");
    el.setAttribute("size", opts.size ?? "md");
    if (opts.disabled) el.setAttribute("disabled", "");
  } else {
    (el as HTMLButtonElement).type = "button";
    el.className = `btn${opts.kind === "secondary" ? " btn-secondary" : ""}`;
    (el as HTMLButtonElement).disabled = Boolean(opts.disabled);
  }
  if (opts.ariaLabel) el.setAttribute("aria-label", opts.ariaLabel);
  if (opts.onClick) el.addEventListener("click", opts.onClick);
  return el;
}

/** Create a real <cds-tag> (status pill). Falls back to a <span>. */
export function carbonTag(text: string, type = "gray"): HTMLElement {
  const useCarbon = typeof customElements !== "undefined" && customElements.get("cds-tag") !== undefined;
  if (useCarbon) {
    const el = document.createElement("cds-tag");
    el.setAttribute("type", type);
    el.textContent = text;
    return el;
  }
  const span = document.createElement("span");
  span.className = "tag";
  span.textContent = text;
  return span;
}

/**
 * Create a real <cds-inline-notification> for status/error banners. Falls back to
 * an aria-live <div>. `kind` is one of Carbon's notification kinds.
 */
export function carbonNotification(
  title: string,
  subtitle: string,
  kind: "success" | "error" | "info" | "warning" = "info",
): HTMLElement {
  const useCarbon = typeof customElements !== "undefined" && customElements.get("cds-inline-notification") !== undefined;
  if (useCarbon) {
    const el = document.createElement("cds-inline-notification");
    el.setAttribute("kind", kind);
    el.setAttribute("title", title);
    el.setAttribute("subtitle", subtitle);
    el.setAttribute("low-contrast", "");
    el.setAttribute("hide-close-button", "");
    return el;
  }
  const div = document.createElement("div");
  div.className = `notification ${kind}`;
  div.setAttribute("role", kind === "error" ? "alert" : "status");
  div.textContent = subtitle ? `${title}: ${subtitle}` : title;
  return div;
}

/** True when real Carbon custom elements are registered in this environment. */
export function carbonAvailable(): boolean {
  return typeof customElements !== "undefined" && customElements.get("cds-button") !== undefined;
}
