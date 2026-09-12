# Word Morph — Improvement Notes

Mechanic: change one letter at a time to reach the target word (word ladder).

## Fun
- **Ladder-rung animation**: each valid word drops onto the next rung with a settle bounce;
  the changed letter flips (fast-02) and briefly highlights.
- Show remaining minimum moves as a faint "par" ghost; beating it triggers celebration.
- Reduced-motion: instant rung placement.

## Addiction
- Classic, highly replayable; "solved in optimal moves" is a strong efficiency badge.
- Streak + moves-used distribution; lifetime "ladders climbed" collection.

## Marketability / share
- Share the ladder height / moves vs par as 🪜 blocks — "COLD→WARM in 4, can you?" hook.
- Word ladders are a known, searchable category → good app-store discoverability.

## Carbon UI
- Accent → Blue 60 (`#0f62fe`).
- Ladder rungs → stacked `cds-tile` (`$layer-01`), current rung `$layer-selected-01`,
  changed letter `$support-info`. Input `$field-01`; Enter `$button-primary`.
- Preview/moves line → `body-01` on `$text-secondary`.
