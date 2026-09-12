# Overlap — Improvement Notes

Mechanic: find the unique word that bridges two anchor words; Wordle-style letter reveal.

## Fun
- **Anchor "magnet" animation**: the two anchors slide toward the guessed bridge on a
  correct solve, snapping together (expressive easing).
- Tile-flip reveal on the letter grid (staggered ~30ms/cell) — highest-ROI polish.
- On solve, briefly show the two real compounds/collocations formed (the "aha").

## Addiction
- Track streak + guess distribution. Add a "connections seen" lifetime counter (how many
  bridge words discovered) as a collection metric.
- Difficulty tiering by anchor obscurity → "expert bridge" badge.

## Marketability / share
- Share the letter-reveal grid rows (🟩🟨⬛) + guess count — already spoiler-safe; add the
  two anchor words are NOT shared (only the pattern), preserving the puzzle for friends.

## Carbon UI
- Accent → Purple 60 (`#8a3ffc`) ≈ current violet; maps to a Carbon step.
- Anchors → `cds-tag` (bold) with `$layer-02`; bridge grid cells reuse the shared
  `.cell state-*` → `$support-success`/`$support-warning`/`$border-strong-01`.
- Input `$field-01`; Guess `$button-primary`; Share `$button-secondary`.
