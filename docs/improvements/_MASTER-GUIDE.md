# CIC Games — Master Improvement Guide (Carbon + Fun + Addiction + Marketing)

> Grounding: bob-researcher foundational job `ba392686` (WCAG bar, Carbon spacing
> discipline, spoiler-safe sharing, share-latency risk, tiered checklist) + authoritative
> IBM Carbon Design System token docs (color tokens fetched from carbondesignsystem.com).
> Where the research declined (concrete tokens, game-feel/retention rankings), specifics
> below are sourced from Carbon's own docs + established casual-game design practice, and
> are labelled as such.

This is the cross-cutting reference. Per-game notes live in `docs/improvements/<game>.md`
and only add what is unique to that game's mechanic/UI.

---

## 1. IBM Carbon Design System — concrete token map for our game UIs

Our current CSS uses ad-hoc hex + spacing. Migrate to Carbon tokens (via `@carbon/styles`
or a local token layer). Theme: **g100 (dark)** as default to match our current dark shell;
optional **white** theme for a light mode.

### Color tokens (from Carbon color/tokens docs)

| Our UI element | Carbon token | Notes |
|----------------|--------------|-------|
| App / hub background | `$background` | g100 = Gray 100 #161616 |
| Game card / panel surface | `$layer-01` (then `$layer-02` nested) | container on background |
| Card hover | `$layer-hover-01` | |
| Selected card | `$layer-selected-01` | |
| Guess input field | `$field-01` | `$field-hover-01` on hover |
| Input / tile border | `$border-subtle-01`; interactive `$border-interactive` (Blue 60 #0f62fe) | selected/active borders |
| Operable tile indicator | `$border-tile-01` | for tappable tiles (Sever gaps, Odd Sense words) |
| Primary text | `$text-primary` | |
| Secondary text / labels | `$text-secondary` | streak meta, hints |
| Helper / tertiary | `$text-helper` | |
| Error text | `$text-error` (Red 60 #da1e28) | |
| Text on colored buttons | `$text-on-color` | |
| **Correct / win / warmer** | `$support-success` (Green 50 #24a148); high-contrast `$support-success-inverse` (#42be65) | pair with icon+label, never color-only |
| **Present / partial / warm** | `$support-warning` (Yellow 30 #f1c21b) | |
| **Absent / cold / wrong** | `$support-error` (Red 60) OR neutral `$border-strong-01` for "cold" | wrong≠error; use neutral gray for benign miss |
| Info / hint | `$support-info` (Blue 70) | |
| Focus ring | `$focus` (Blue 60) | keyboard focus — mandatory |
| Primary button | `$button-primary` (Blue 60) | Submit/Guess |
| Secondary button | `$button-secondary` | Hint/Share |

WCAG: Carbon status tokens are AA-tuned on their intended layers; keep text on
`$support-*` fills using `$text-on-color`. Always add a **non-color channel** (icon,
label, shape) to every state — our games already do glyph+label; keep that.

### Spacing tokens (Carbon 2px base scale)

`$spacing-01`=2, `-02`=4, `-03`=8, `-04`=12, `-05`=16, `-06`=24, `-07`=32, `-08`=40,
`-09`=48, `-10`=64. Replace ad-hoc px: tile gaps → `$spacing-03`; panel padding →
`$spacing-05`; section gaps → `$spacing-06`. Align to the 2× grid.

### Type tokens

`productive-heading-05/06` for hub H1 + win banners; `productive-heading-03` for game
titles; `body-01`/`body-02` for help/sub text; `label-01` for tile/meta labels.
Fixed-width word displays → `code-01`/`code-02` (mono) which we already approximate.

### Motion tokens (Carbon motion)

Durations: `$duration-fast-02` (110ms) for tile state changes; `$duration-moderate-01`
(150ms) for reveals; `$duration-moderate-02` (240ms) for celebratory. Easing:
`motion(standard, productive)` for UI, `motion(entrance/exit, expressive)` for juice.
**Respect `prefers-reduced-motion`** — we already gate animation; keep it.

### Components to adopt

- **Tile** (`cds-tile`, clickable/selectable variants) → hub game cards, Odd Sense words,
  Compound Split halves.
- **Button** primary/secondary/ghost → actions.
- **Tag** → per-game accent/status chips, "Solved" badges on hub.
- **Notification / Toast** (inline + toast) → feedback ("Not in word list", "Solved!").
- **Modal** → how-to-play, stats dashboard, settings.
- **Text input** → guess fields.

---

## 2. Fun / game feel (highest-ROI, cheap to build)

Research declined a ranking; these are established casual-game practices, ordered by
ROI-for-effort for our stack:

1. **Tile-flip / reveal animation** on result rows (Wordle-style sequential flip) —
   `$duration-fast-02`, staggered ~30ms/cell. Huge perceived-quality lift, ~20 lines CSS.
2. **Win celebration** — brief confetti or row bounce on solve (`expressive` easing),
   reduced-motion → static "Solved!" banner.
3. **Input feedback** — button press-state, invalid-shake on rejected guess (reduced-motion
   → color+label only).
4. **Near-miss signalling** — e.g. "1 away", "warmer", tier bars — we already do; make it
   visually prominent.
5. **Haptics** (Capacitor `Haptics.impact`) on submit/win for native builds — light, cheap.
6. **Sound** (optional, off by default) — short ticks on lock/win; must be muteable.

## 3. Addiction / retention (ethical)

Research declined game-specific ranking; established daily-puzzle levers, ordered:

1. **Streaks** — current + max, per game AND hub-wide "days played". We store per-game
   stats already; surface them prominently. Loss-averse but honest (no manipulative
   re-engagement).
2. **Stats dashboard** — games played, win %, guess distribution, streak. A modal per game.
3. **Daily cadence + "come back tomorrow"** — countdown to next puzzle after completion.
4. **Completion/collection** — hub "N of 22 solved today" board (already built) → add a
   monthly calendar heatmap of solves.
5. **Shareable result** (see §4) — the single biggest organic-growth lever.
6. **Notifications** — opt-in only, one gentle daily reminder max.

## 4. Marketability / virality

- **Spoiler-safe share artifact** (research-backed): abstract emoji grid + attempt count +
  no words/letters. We already do this per game — unify the format and add the hub name +
  day number + a link.
- **Share latency risk** (research-backed): make share instant; pre-build the string, use
  native share sheet with clipboard fallback (already implemented).
- **Growth**: low-drama primitives (personal bests, private groups) over leaderboards.
- **Monetization** (candidates, not evidence-ranked): free daily + one-time "supporter"
  unlock for archives/themes; light, non-intrusive; no dark patterns.

---

## 5. Reusable per-game improvement checklist

Applied to each game in its own doc. Tiers from the research's Definition-of-Done framing.

### P0 — foundations (must)
- [ ] WCAG 2.1 AA across the play loop; keyboard-operable; focus visible (`$focus`).
- [ ] State conveyed by text/icon, not color alone. (all games already comply)
- [ ] No flashing 2–55Hz; `prefers-reduced-motion` respected.
- [ ] Layout on Carbon spacing scale; consistent gutters/padding.

### P1 — game feel (polish)
- [ ] Reveal/flip animation on result state.
- [ ] Win celebration + reduced-motion fallback.
- [ ] Invalid-input feedback (shake/toast).
- [ ] Clear near-miss / progress signal.

### P2 — retention
- [ ] Streak + stats modal.
- [ ] Next-puzzle countdown on completion.
- [ ] Prominent, unified share button.

### P3 — Carbon UI migration
- [ ] Replace ad-hoc hex with Carbon color tokens (g100).
- [ ] Replace ad-hoc px with Carbon spacing tokens.
- [ ] Adopt Carbon Tile/Button/Tag/Toast/Modal where they fit.
- [ ] Per-game accent from Carbon palette (keep the game's identity color but map to a
      Carbon step, e.g. Blue 60 / Teal 50 / Purple 60).

### Per-game mechanic-specific (see individual docs)
- Unique fun/marketing ideas tied to that game's core loop.

---

## Honesty note
bob-researcher's foundational job was largely an evidence-gap document; concrete Carbon
tokens here come from Carbon's own published docs, and game-feel/retention specifics from
standard casual-game practice. Treat monetization + exact ROI rankings as unverified
hypotheses to A/B test, not proven facts.
