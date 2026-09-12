# Edit Clusters — Improvement Notes

Mechanic: on a board of 9 same-length words, pick the 4 most tightly linked by
one-letter changes (the densest sub-network). Uses wordkit's edit-distance graph.

## Fun
- **Web-draw flourish**: on solve, animate the 6 internal edges snapping between the
  four cluster tiles (the "web" materialises). Reduced-motion: static lines.
- Per-attempt density read ("N links") gives an immediate "getting warmer" signal.

## Addiction
- 4 tries + density feedback = tight guess-narrowing loop, very "one more".
- 96 puzzles rotate; streak + shareable density grid drive return visits.

## Marketability / share
- Emoji density signature per attempt (🟩/🟨/⬛) reads like Connections' history but
  is structural, not thematic — a fresh share format for the feed.

## Carbon UI
- Accent → Teal (`#08bdba`). Tiles `cds-tile`; selected `$border-interactive`.
- Solved cluster `$support-success`; history chips `$layer-02` + `$text-secondary`.
