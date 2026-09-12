# Tradeoff — Improvement Notes

Mechanic: swap one letter per turn to raise a word's letter-value score; beat par.

## Fun
- **Score pop**: each swap animates the delta (+3) rising off the changed letter; the score
  bar fills toward par (`$support-warning`→`$support-success` at par).
- Changed letter flips (fast-02); the word "settles" with a subtle bounce.
- Par-beat: gold flash + haptic.

## Addiction
- Optimisation loop is inherently replayable → "% of theoretical best" score + personal
  best per start word. "Beat par in fewest swaps" efficiency badge.
- Streak + swaps-used distribution.

## Marketability / share
- Share the score progress bar 🟩🟩🟩⬛⬛ + swaps/par — "how high can you climb?" hook.
- Scrabble-adjacent audience is large and monetizable (word-value crowd).

## Carbon UI
- Accent → Red 50/Magenta (`#fa4d56`) ≈ current rose; or Blue 60 for neutrality.
- Current word → `code-02` mono, changed letter highlighted `$support-info`.
- Score line → Carbon progress/meter styling; `$button-primary` = Swap; path shown as
  `cds-tag` breadcrumb. Input `$field-01`.
