# Borrowed — Improvement Notes

Mechanic: match each loanword to the language English borrowed it from.

## Fun
- **World-map flourish**: on a correct match, a subtle pin drops on a stylised map / the
  language tag flies to the word. On solve, show a mini "etymology fact" per word (the aha).
- Correct matches lock green; wrong ones swap back with a shake.
- Reduced-motion: instant lock + fact text.

## Addiction
- Etymology facts are inherently sticky/educational → "facts learned" collection; streak.
- Strong EdTech/museum/trivia positioning (recurring institutional appeal).

## Marketability / share
- "Did you know ROBOT is Czech?" facts are viral trivia. Share correct-count row
  (🟥🟧🟨🟩⭐) + tease one fact. Reveal-on-loss shows answers (already built).

## Carbon UI
- Accent → Green 50 (`#24a148`) / globe motif.
- Word→language rows → `cds-dropdown`/select per word (`$field-01`), locked row
  `$support-success` left border + ✓ `cds-tag`. Check `$button-primary`.
- Reveal panel → `cds-tile` on `$layer-02`.
