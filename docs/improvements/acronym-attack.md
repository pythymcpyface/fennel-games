# Acronym Attack — Improvement Notes

Mechanic: expand an acronym into a themed phrase, one valid word per letter; elegance score.

## Fun
- **Live validity marks** (already added) — enhance with a green check that pops per row as
  each word validates; the acronym letters "light up" left-to-right as filled.
- On submit, the phrase assembles into a banner and the elegance score counts up.
- Creativity is the fun: show a subtle "elegance" meter rewarding longer/rarer words.

## Addiction
- Generative → high replay/expression. "Personal best elegance" per acronym; share others'
  answers. Streak + best-score tracking.
- Compare-your-answer social loop is the core hook (everyone's expansion differs).

## Marketability / share
- Uniquely shareable: the player's OWN witty expansion is the artifact ("MOON = My Own
  Orbiting Nonsense") — highly viral, screenshot-native. Add a one-tap "share my acronym".
- Sponsorable (branded daily acronyms).

## Carbon UI
- Accent → Magenta/Purple (`#8a3ffc`).
- Per-letter rows → acronym letter in a `cds-tag`, `cds-text-input` per word; valid row
  `$support-success` border, invalid `$support-error`. Submit `$button-primary`.
