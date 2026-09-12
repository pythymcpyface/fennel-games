# Tier List — Improvement Notes

Mechanic: five words from well-separated SCOWL frequency bands are shuffled; order them
most-common → rarest. Ground-truth data (wordTier) → one correct order, clear steps.
One submit per try returns the count in the right position.

## Fun
- **Rank-slot settle**: rows animate into their new slot on each move; on solve, the
  list ripples top→bottom with a "locked" stamp. Reduced-motion: instant.
- Accessible ▲/▼ reordering (no drag needed) keeps it fast on mobile and keyboard.

## Addiction
- "Am I really sure `huckster` is rarer than `premised`?" second-guessing is moreish;
  4 tries + position-count feedback narrows it down. Streak + position-bar share.

## Marketability / share
- 🟦⬜ position bars are spoiler-safe and beg comparison ("I got 3/5 on try one"). The
  reveal (tiers shown) teaches a fun bit of vocabulary each day.

## Carbon UI
- Accent → Teal 30 (`#3ddbd9`). Rows `cds-tile`; move buttons `$layer-02` + icon-only
  with aria-labels; rank hint `$text-helper`; position bars `$support-info`.
