# Twin Trails — Improvement Notes

Mechanic: two hidden pivots each pulled 4 words; the 8 are shuffled and you sort each
into Trail A or Trail B. One submit per try returns only the count on the correct
trail. Uses GloVe rank margins (rankB − rankA) so each word is decisively on-side.

## Fun
- **Two-lane snap**: tapping a word slides it into its lane with a colour wash (blue A /
  purple B). On solve, both lanes light up with their revealed theme labels.
- Connections-style "N of 8 correct" feedback creates deduction, not luck.

## Addiction
- Partial-count feedback + 4 tries = deduce-and-refine loop; the reveal ("oh, sea vs
  woods!") is a satisfying aha. Streak + count-bar share.

## Marketability / share
- Per-attempt 🟩⬜ count bars mirror the Connections history everyone screenshots, but
  the two-source twist is novel. Strong feed fit.

## Carbon UI
- Accent → Purple (`#be95ff`). Lane A `$support-info`, lane B Purple 40; tiles
  `cds-tile`; count bars `$support-success` on `$layer-02`.
