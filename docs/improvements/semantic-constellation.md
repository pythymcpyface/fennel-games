# Semantic Constellation — Improvement Notes

Mechanic: a Strands-style 6×6 perfect-cover grid with TWO hidden anchors (stars).
Two 5-letter theme answers belong to cluster A (decisively closer to anchor A by
GloVe rank margin), two to cluster B; an 8-letter spangram bridges both and spans
top→bottom. Finding a theme word reveals its cluster (🔵 A / 🟣 B); both cluster
themes reveal on completion. Bonus words earn hints. No lose.

## Fun
- **Two-star reveal**: each theme word snaps into its group colour; the aha is
  realising the board hides two mini-themes bridged by the spangram. On win, both
  anchors reveal.
- No-penalty Strands flow; bonus words gift hints.

## Addiction
- Deduction (which group? what are the two stars?) + no-penalty flow. Decisive
  rank-margin gate keeps clusters fair despite 50d GloVe noise. 120 boards; streak.

## Marketability / share
- Discovery-order ribbon of 🔵/🟣 cluster squares + 🟡 spangram + 💡 hints —
  spoiler-free (no letters, no anchors). Pairs with Twin Trails as a "two-group"
  mini-series.

## Carbon UI
- Accent → Purple 60 (`#8a3ffc`); cluster chips `$support-info` (A) / `--cds-purple-40`
  (B). Reuses the shared `.elt-grid` (keyboard + SR).

## Build / determinism
- Reuses shared `kit/grid-pack.ts`. Build picks two distant anchors, ranks a
  bounded universe against each, selects 2+2 themes by decisive signed rank margin
  (gate rejects coin-flips + enforces 2/2 balance), a both-anchor spangram +
  fillers, packs, validates. Obscenity + function-word filters. 120 boards.
