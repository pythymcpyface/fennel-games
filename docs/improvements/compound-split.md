# Compound Split — Improvement Notes

Mechanic: pair 8 shuffled halves into 4 compound words (order matters).

## Fun
- **Snap-together animation**: selecting two halves that form a compound animates them
  fusing into one tile with a satisfying click + brief glow (fast-02); wrong pairs recoil.
- Found compounds collect into a "solved" tray with a stamp.
- Win: all four compounds do a celebratory shuffle. Reduced-motion: instant lock.

## Addiction
- Combinatorial "aha" per pair; NYT-Connections-adjacent grouping satisfaction without
  ambiguity (unique matching guaranteed). Streak + attempts distribution.
- "Compounds discovered" lifetime collection.

## Marketability / share
- Connections-style audience is huge. Share found-count 🟩🟩🟩⬛ + attempts — grouping
  games share extremely well. Never leak the words.

## Carbon UI
- Accent → Green 40 (`#42be65`).
- Half tiles → selectable `cds-tile` grid (`aria-pressed`, already), selected
  `$border-interactive`, locked `$support-success`. Found tray → `cds-tag` pills.
  Hint `$button-secondary`.
