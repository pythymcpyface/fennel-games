# Homophone Heist — Improvement Notes

Mechanic: decode a sentence written in sound-alikes into the intended sentence.

## Fun
- **Read-aloud reveal**: an optional "play it" button speaks the homophone sentence (TTS)
  so players HEAR the joke — core to the mechanic. On solve, the sentence re-renders into
  its real words with a satisfying settle.
- Per-word solve → the token flips from sound-alike to real word (fast-02).
- Reduced-motion: instant flip.

## Addiction
- The humour/aha ("EYE SCREAM FOUR ICE SCREAM") is the retention hook → collection of
  decoded sentences. Streak + attempts (shared budget).

## Marketability / share
- Extremely viral, screenshot-native: the homophone sentence itself is funny and
  spoiler-safe to share ("decode this:"). Strong social-feed fit.

## Carbon UI
- Accent → Yellow 40 (`#f1c21b`) speaker motif.
- Sentence tokens → `cds-tile` mono (`code-01`), selected `$border-interactive`, solved
  `$support-success`. Input `$field-01`; homophone feedback → `$support-info`/`$support-warning`.
- Optional 🔊 play → `cds-button` ghost.
