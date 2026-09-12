# Vowel Ghost — Improvement Notes

Mechanic: restore stripped vowels to a themed set of consonant skeletons.

## Fun
- **Ghost-fill animation**: solved vowels "materialise" into the skeleton with a fade-in
  (ghost theme) — the letters appear like apparitions settling into place.
- Per-skeleton solve → the word glows green and the ghost 👻 winks.
- Reduced-motion: instant fill.

## Addiction
- Themed sets → "themes completed" collection; streak + attempts (shared budget) distribution.
- The reveal of a whole themed set is satisfying — surface "theme: Fruit ✓" on win.

## Marketability / share
- Share solved-grid 🟩🟩⬛🟩🟩 + attempts — the consonant skeletons (e.g. PPL RNG GRP) make
  intriguing spoiler-safe screenshots.

## Carbon UI
- Accent → Cool Gray 50 (`#8d8d8d`) with a spectral tint — ghostly neutral fits the theme.
- Skeleton chips → `cds-tile` mono (`code-01`), selected `$border-interactive`, solved
  `$support-success`. Input `$field-01`; first-vowel-position hint → `$support-info` toast.
