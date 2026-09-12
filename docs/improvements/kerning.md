# Kerning — Improvement Notes

Mechanic: re-space a letter run so it reads as a different hidden phrase (reading A→B).

## Fun
- **Re-space slide**: as gaps toggle, tokens glide apart/together smoothly (fast-02); the
  perceptual "flip" from one reading to another is the joy — make the transition buttery.
- On solve, reading B locks with a snap; briefly flash reading A→B to show the transform.
- Reduced-motion: instant respacing.

## Addiction
- The "same letters, different meaning" reveal is a mini-aha per solve → collection of
  discovered re-readings. Streak + attempts distribution.

## Marketability / share
- Adjacent to Sever's virality (typography flip). Share correct-break pattern (⬛🟨🟩) +
  the letter run screenshot is spoiler-safe and intriguing.

## Carbon UI
- Accent → Orange 40 (`#ff832b`).
- Reuses Sever's `.strip/.gap/.preview` — map to `$layer-01`, `$border-tile-01` gaps,
  `$support-success` on-break bar. Submit `$button-primary`.
