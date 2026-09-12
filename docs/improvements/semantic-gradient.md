# Semantic Gradient — Improvement Notes

Mechanic: a Strands-style 6×6 perfect-cover grid. A hidden ANCHOR word ties the
theme: four 5-letter theme answers are GloVe neighbours at graded closeness
(hot→cold bands by rank margin), plus an 8-letter spangram that spans top→bottom.
Finding a theme word reveals its temperature to the still-hidden anchor. Win = all
theme + spangram; anchor revealed on completion. Bonus words earn hints. No lose.

## Fun
- **Hot/cold reveal**: each found theme word colours in with its band (🔴 hot …
  🟦 cold), building a Semantle-style "I'm circling it" tension before the anchor
  drops. On win, animate the anchor reveal.
- No-penalty Strands flow; bonus words gift hints.

## Addiction
- Two ahas (find words → deduce the hidden anchor from the temperatures). Coarse
  bands keep it fair despite 50d GloVe noise. 120 boards; streak + band-ribbon share.

## Marketability / share
- Discovery-order ribbon of band squares (🔴🟠🔵🟦) + 🟡 spangram + 💡 hints — a
  fresh Semantle×Strands share, spoiler-free (no letters, no anchor).

## Carbon UI
- Accent → Magenta (`#ff7eb6`); band chips map to `$support-error`/`--cds-orange-40`/
  `$support-info`/`--cds-blue-60`. Reuses the shared `.elt-grid` (keyboard + SR).

## Build / determinism
- Reuses shared `kit/grid-pack.ts` packer. Build picks an anchor, `buildRankTable`
  over a bounded universe, selects 4 themes in decisive rank bands (gate rejects
  non-decisive separation), spangram + fillers, packs, validates. Obscenity
  blocklist. 120 boards.
