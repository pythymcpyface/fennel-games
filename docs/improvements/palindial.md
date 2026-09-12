# Palindial — Improvement Notes

Mechanic: morph a word into its reverse-reading twin via one-letter changes (DEER→REED).

## Fun
- **Mirror animation**: show the target as a mirrored/ghost reflection of the start; each
  move nudges the current word toward its reflection until they meet (satisfying symmetry).
- On win, the word and its reverse briefly overlay/flip to show the palindromic pairing.
- Changed letter flips (fast-02); reduced-motion instant.

## Addiction
- Reversal "whoa" per solve → collection of discovered reverse-pairs. Streak + moves/par.
- Niche but devoted wordplay crowd; efficiency (fewest moves) badge.

## Marketability / share
- "STRESSED is DESSERTS backwards" is classic viral wordplay. Share moves-bar 🔄🟩🟩⬛ +
  the pairing tease (without the path). 

## Carbon UI
- Accent → Cyan 40 (`#33b1ff`).
- Current word `code-02`; target shown mirrored via CSS transform + `$text-secondary`.
  Path breadcrumb → `cds-tag`. Change `$button-primary`; input `$field-01`.
