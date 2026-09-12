// Real IBM Carbon Design System integration (Phase E).
//
// Imports the actual @carbon/web-components custom elements so tags like
// <cds-button>, <cds-tag>, <cds-inline-notification>, and <cds-tile> are
// registered as real Carbon components (not hand-rolled look-alikes). Games and
// the hub build UI with these primitives via the helpers in ./carbon.ts.
//
// Importing a component module has the side effect of calling customElements
// .define(...) for that component. We import only what the hub actually uses to
// keep the bundle lean. The g100 dark theme is applied at the document root.

import "@carbon/web-components/es/components/button/index.js";
import "@carbon/web-components/es/components/tag/index.js";
import "@carbon/web-components/es/components/notification/index.js";
import "@carbon/web-components/es/components/tile/index.js";

/**
 * Apply a Carbon theme. Carbon's prebuilt CSS ships theme classes (`cds--g100`,
 * `cds--g90`, `cds--g10`, `cds--white`) that set the full `--cds-*` token set —
 * including component tokens like `--cds-button-primary` — so real Carbon
 * components render in the chosen theme. We apply it to <body> so tokens
 * inherit into every component (and pierce shadow DOM via CSS custom properties).
 */
export function applyCarbonTheme(theme: "g100" | "g90" | "g10" | "white" = "g100"): void {
  const cls = `cds--${theme}`;
  document.body.classList.add(cls);
  document.documentElement.setAttribute("data-carbon-theme", theme);
}
