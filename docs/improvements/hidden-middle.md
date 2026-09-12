# Hidden Middle — Improvement Notes

Mechanic: find the dictionary word hidden as a contiguous substring in a carrier word,
matching a clue. Hint underlines the span.

## Fun
- **Highlight sweep**: on a wrong-but-inside guess, briefly highlight where that substring
  sits in the carrier (teaches the mechanic). On solve, the answer span pulses green and
  "lifts out" of the carrier.
- Letters not in the answer dim; the hidden word stays bright.
- Reduced-motion: static underline + label.

## Addiction
- "Words found inside words" lifetime counter (collection). Streak + attempts distribution.
- Escalating carrier length as a difficulty ramp; "found a 6+ letter hidden word" badge.

## Marketability / share
- Share attempts ⬛⬛🟩 + carrier length — the "there's a word hiding in SCANDALOUS" hook
  is shareable as a screenshot of just the carrier (spoiler-safe since answer not shown).

## Carbon UI
- Accent → Teal 50 (`#009d9a`) ≈ current teal.
- Carrier word → large `code-02` mono on `$layer-01`; hinted span → `$support-info`
  underline (`text-decoration` + color, non-color channel = underline).
- Guess list rows → `cds-tile` with inside/word cue labels (already text). Input `$field-01`.
