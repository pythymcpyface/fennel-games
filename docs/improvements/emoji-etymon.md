# Emoji Etymon — Improvement Notes

Mechanic: guess a word from an emoji rebus (🐝🍃 = BELIEF); Wordle-style letter feedback.

## Fun
- **Rebus reveal**: on solve, the emojis morph into the syllables they represent
  (🐝→"BE", 🍃→"LIEF") — the aha made visible. Big delight-per-solve.
- Tile-flip reveal on the letter grid (staggered) — highest-ROI polish.
- Oversized, centered emoji with a gentle idle float; reduced-motion: static.

## Addiction
- Rebus decoding + emoji delight → very shareable, Gen-Z reach. Streak + guess distribution.
- "Rebuses cracked" collection; hint reveals the sounds-like breakdown.

## Marketability / share
- The emoji rebus IS the marketing — the share artifact can safely include the emoji +
  result grid (🐝🍃 🟩🟨⬛ 3/6) without leaking the answer. Screenshot-native, high viral
  ceiling. Sponsorable/seasonal emoji packs.

## Carbon UI
- Accent → Rose/Red 40 (`#fa4d56`).
- Emoji rebus → large centered display (`$spacing-06` margins); guess grid reuses shared
  `.cell state-*` → `$support-success`/`$support-warning`/`$border-strong-01`. Input
  `$field-01`; hint → `$support-info` inline notification. Guess `$button-primary`.
