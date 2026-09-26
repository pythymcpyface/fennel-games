# BUG-SPECIFICATION — lowball-mp-reveal-pause

> Generated locally: bob-sdlc orchestrator (spec_workflow_aas) returned AuthenticationError
> (worker 'product-requirements-lead'). Gate recorded as waived with reason.

## Defect summary
Applies to Lowball and Lowball: Countries multiplayer (relay + client).
1. Reveal drain (100 → score over ~5s) with paused turn countdown does not play on mobile.
2. No review pause at end of a sweep — sweep 2 auto-starts after 5s.
3. Score 100 / score 0 have no visible X / celebration (overlays wiped by immediate re-render).

## Root cause
- `startMpTicking` only marks "busy" via `mpTickTimer`; the reduced-motion path (default on many
  phones via Reduce Motion / Remove animations) and the score-100 path set no interval, so
  the following `sweep-start` re-renders immediately and restarts the countdown.
- Deferred `onMpTickComplete` fires the instant the drain ends, `renderLiveRound()` clears
  `root.innerHTML`, so the ✓ overlay is removed on the same tick it is added.
- `startMpTicking` → `stopMpTicking` clears any queued deferred render.
- `leaderboard`/`tiebreak-start` kill the in-flight drain.
- Relay: `advanceTurn` schedules a `BETWEEN_SWEEPS_MS = 5000` alarm that auto-runs
  `beginNextSweep`; the per-turn deadline also starts counting while clients animate.

## Fix requirements
- REQ-FIX-001: WHEN a reveal arrives, the client SHALL drain the column from 100 to the score
  (50 ms/step) regardless of prefers-reduced-motion, pause the countdown, then hold the result
  for MP_RESULT_HOLD_MS before applying any queued view change.
- REQ-FIX-002: IF any server event (sweep-start, between-sweeps, tiebreak-start, leaderboard)
  arrives while a reveal is in progress, THEN the client SHALL defer the re-render until the
  reveal (drain + hold) completes; a later reveal SHALL NOT discard the queued re-render.
- REQ-FIX-003: WHEN all players finish sweep 1, the relay SHALL NOT auto-advance; sweep 2 SHALL
  start only when the host sends `next`. Any pending turn alarm SHALL be cleared.
- REQ-FIX-004: WHEN a turn begins after a reveal, the relay SHALL extend the deadline by
  MP_REVEAL_GRACE_MS so the player gets the full 30s after the animation; the client SHALL cap
  the displayed countdown at 30s.
- REQ-FIX-005: IF a revealed score is 100, THEN a big red X SHALL be shown; IF 0, THEN a
  celebratory animation (tick + "Pointless!" + confetti) SHALL be shown — MP and single-player,
  both variants. Under reduced motion the static symbol remains, motion is suppressed by CSS.
