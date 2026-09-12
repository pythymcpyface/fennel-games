# Web Hub — Improvement Notes

Mechanic: a board of 8 same-length words; one "hub" is a one-letter change away from
more board words than any other. Tap the most-connected word. Uses wordkit's
edit-distance graph; a unique max-degree gate (margin ≥ 2) keeps the answer decisive.

## Fun
- **Radiate flourish**: on solve, edges fan out from the hub to each linked word (a
  spider-web bloom). Wrong picks briefly show their own smaller link count. Reduced-motion:
  static count.
- Single-tap, 3 tries → the fastest game in the hub; great as a daily "warm-up".

## Addiction
- Spotting the hub among look-alikes is a satisfying visual-search aha; degree reveal on
  solve rewards the insight. Streak + connectivity-signature share.

## Marketability / share
- Compact 🟩/🟦 connectivity share is spoiler-safe and quick to post. Pairs naturally
  with Edit Clusters as a "graph games" mini-series for cross-promo.

## Carbon UI
- Accent → Blue 30 (`#82cfff`). Tiles `cds-tile`; hub `$support-success`; misses tinted
  `$support-info`; degree suffix `$text-secondary` on reveal.
