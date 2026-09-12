# Sever — Improvement Notes

Mechanic: insert space breaks into a run-together string to reveal the hidden phrase;
garden-path humour.

## Fun
- **Live preview animation**: as gaps toggle, the tokens visibly separate/rejoin with a
  slide (fast-02). The garden-path "wrong reading" is the joke — lean into it: on a wrong
  submit that IS all-dictionary-words, show a wry toast ("Valid words… but not today's!").
- Correct break positions "click" into place with a satisfying snap + haptic.
- Win: the intended phrase animates apart cleanly.

## Addiction
- The humour is the retention hook — add a "funniest misreadings" opt-in gallery (local),
  collectible per solve. Streak + attempts distribution.

## Marketability / share
- Garden-path strings are inherently viral. Share the mis-segmentation count pattern
  (⬛🟨🟩) — never the phrase. Consider a "reveal after friends try" link.

## Carbon UI
- Accent → Orange 40 (`#ff832b` / `$support-caution-major`) ≈ current amber.
- Letter strip on `$layer-01`; gap buttons use `$border-tile-01` operable indicator +
  `aria-pressed` (already done). On-break → `$support-success` bar.
- Submit `$button-primary`; spacing `$spacing-01` between letters, `$spacing-03` around gaps.
