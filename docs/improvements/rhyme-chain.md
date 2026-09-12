# Rhyme Chain — Improvement Notes

Mechanic: build the longest chain where each clued word rhymes with the previous.

## Fun
- **Chain-link animation**: each accepted word links to the previous with a visual chain
  connector that "snaps" (fast-02) + a soft rhyme chime (optional sound).
- Show the rhyme rime (e.g. "-AIT") subtly pulsing to reinforce the phonetic pattern.
- Win: the whole chain does a wave animation head-to-tail.

## Addiction
- Chain LENGTH is a natural score → leaderboard-free "longest chain today / personal best".
- Guess distribution by chain length; "perfect chain" (no wrong attempts) badge.

## Marketability / share
- Share chain length as 🔗🔗🔗🔗⬛ (reached 4/5) — the length bar invites "beat my chain".
- Rhyme is kid-friendly → strong education/family positioning.

## Carbon UI
- Accent → Magenta 60 (`#d02670`) ≈ current pink.
- Chain display → row of `cds-tag` connected by CSS chain glyphs; current clue in a
  `cds-tile`; input `$field-01`.
- First-letter hint → `$support-info` inline notification.
- Spacing `$spacing-03` between links.
