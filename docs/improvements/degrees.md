# Degrees — Improvement Notes

Mechanic: order 5 words along a hidden intensity scale (weakest→strongest).

## Fun
- **Slider/thermometer track**: render the 5 slots on a visible gradient rail
  (`$support-info`→`$support-error` or cool→hot). Dragging/reordering animates items sliding
  along the rail (fast-02).
- On check, correct-position items lock with a green pin; wrong ones jiggle.
- Win: the rail fills and the scale label reveals with a sweep.

## Addiction
- "Correct positions" partial feedback drives one-more-try. Streak + attempts distribution.
- Scale-category collection ("temperature, size, loudness… N seen").

## Marketability / share
- Share the per-attempt correct-count row (🟥🟧🟨🟩⭐) — the gradient cells are eye-catching
  and spoiler-safe.

## Carbon UI
- Accent → Purple 60 (`#8a3ffc`).
- Ordered list → `cds-tile` rows with up/down `cds-button` (ghost) — already keyboard-operable.
- Locked slot → `$support-success` left border + 🔒 tag. Rail uses Carbon gradient of
  `$support-*` steps. Spacing `$spacing-03` between rows.
