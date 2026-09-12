# Odd Sense — Improvement Notes

Mechanic: 5 words, 4 share a hidden sense, 1 is the polysemy impostor; pick it. Hint
eliminates a themed word.

## Fun
- On solve, **reveal the theme with a flourish**: the 4 themed words glow `$support-success`
  and regroup, the odd word flips to show its true category (the "aha"). This is the payoff
  — make it the centerpiece.
- Wrong pick → the chosen word shakes (reduced-motion: red strike + label), theme stays hidden.
- Progressive tension: each wrong guess dims one more, raising stakes.

## Addiction
- The reveal is dopamine — track "themes cracked" collection + streak. Guess-attempt
  distribution (1/2/3/4 tries).
- Category variety keeps it fresh; surface "you've seen N of M categories" as light collection.

## Marketability / share
- Share attempts as 🟥🟥🟩 — the impostor mechanic ("could YOU spot it?") is a natural
  challenge-a-friend hook. Never share words/theme.

## Carbon UI
- Accent → Green 50 (`#24a148` / `$support-success`) ≈ current green identity.
- Word choices → selectable `cds-tile` (`$layer-01`, selected `$layer-selected-01`,
  `aria-pressed`). Eliminated → `$text-disabled` + strikethrough. Odd reveal → `$support-success`.
- Reveal panel → `cds-tile` on `$layer-02` with `$spacing-05` padding.
