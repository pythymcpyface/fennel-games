# Odd-One Gradient — Improvement Notes

Mechanic: five words share a theme; tap the one that least belongs. Wrong (belonging)
taps warm up on a hot/cold scale as they near the outlier. Uses GloVe rank margins
(median rank of the other members, universe centred on each word).

## Fun
- **Thermal tint**: each wrong tap tints its tile on a blue→red heat ramp; the outlier
  pops green. The board literally "warms" toward the answer. Reduced-motion: instant tint.
- 3 taps only → high tension, quick sessions.

## Addiction
- Near-miss heat feedback is the classic Semantle-style pull, but bounded (discrete
  buckets, 3 tries) so it never becomes a grind. Streak + heat-grid share.

## Marketability / share
- 🟦🟧🟩 heat rows are instantly legible and spoiler-safe (no words, no theme). Great
  "how many tries did it take you?" bait.

## Carbon UI
- Accent → Magenta (`#ff7eb6`). Tiles `cds-tile`; heat ramp uses `$support-info` →
  `$support-warning` → `$support-error`; outlier `$support-success`.
