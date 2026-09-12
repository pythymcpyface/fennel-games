# Ladderless — Improvement Notes

Mechanic: warmer/colder semantic hunt for a hidden target; guesses ranked by tier.

## Fun
- **Thermometer visual**: render the best-rank as a rising mercury column (Carbon
  `$support-warning`→`$support-success` gradient) — the "warmer" metaphor made literal.
- Animate each guess row sliding in with tier color; flip to green on `best`.
- "🔥 warmer / 🧊 colder" delta badge vs previous best, with a short count-up of tier.
- Reduced-motion: static bar + text.

## Addiction
- Streak + "average guesses to solve" stat (Ladderless is skill-expressive → players chase
  efficiency). Guess-count distribution histogram in a stats modal.
- Par-beating badge ("Under par!") is a strong collectible; track lifetime under-pars.

## Marketability / share
- Share the tier trajectory as a spoiler-safe sparkline of blocks: `🟦🟦🟨🟩⭐ 4/par4`.
  The "closing in" shape is intriguing without leaking the word.

## Carbon UI
- Card accent → Blue 60 (`#0f62fe`) — matches current cyan-ish identity, maps to
  `$border-interactive`.
- Guess list rows → `cds-tile`; warmer/colder cue via `$support-success`/`$support-warning`
  fills + existing ▲/▼ glyph (non-color channel).
- Input → Carbon Text input (`$field-01`); Guess → `$button-primary`.
- Thermometer uses spacing `$spacing-02` increments.
