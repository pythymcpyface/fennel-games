# Edit-Ladder Trails — Improvement Notes

Mechanic: a Strands-style 6×6 letter grid that is a *perfect cover* — every tile
belongs to exactly one answer, traced as a non-linear 8-direction path. Theme = an
edit-distance-1 ladder of four 5-letter rungs (HOSES→HOLES→MOLES→MILES) plus an
8-letter spangram that spans top→bottom; two 4-letter fillers earn hints. Relaxed,
no lose state.

## Fun
- **Ladder reveal**: as rungs are found, the ladder line fills in and the "each
  word is one letter from the last" aha lands. On win, animate the spangram path
  lighting up top→bottom. Reduced-motion: instant.
- No-penalty tracing (Strands flow): wrong traces just clear; bonus words gift hints.

## Addiction
- Two-stage discovery (find words → see the edit-ladder theme) + no-penalty flow =
  gentle, high-completion loop. 150 daily boards; streak + spoiler-free share.

## Marketability / share
- Spoiler-free discovery-order ribbon (🔵 rungs, 🟡 spangram, 🟢 bonus, 💡 hints),
  no letters — a fresh Strands-like share distinct from Wordle/Connections grids.

## Carbon UI
- Accent → Blue 50 (`#4589ff`). Grid cells `cds-tile`; in-trace `$border-interactive`;
  found `$support-success`; hint-revealed ring `$support-warning`. Fully keyboard
  operable (arrow-key focus, tap-to-extend, tap-last-to-submit) + SR grid semantics.

## Build / determinism
- Content generated at build time by a node-budgeted seeded backtracking packer
  (`content-build.packBoard`) proven by spike (116/120 boards, ~65ms/day). Fairness
  gate (`validatePuzzle`) enforces perfect cover + contiguous paths + spanning
  spangram + valid ladder. Obscenity blocklist filters the corpus (RISK-012).
