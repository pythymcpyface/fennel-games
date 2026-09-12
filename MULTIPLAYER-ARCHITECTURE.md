# Lowball Multiplayer Architecture Investigation
**Complete Audit Report**

**Date:** 2026-09-11  
**Project:** Fennel Games - feature/lowball-multiplayer  
**Scope:** Comprehensive codebase analysis for multiplayer integration points  
**Investigator:** Architecture Scout

---

## EXECUTIVE SUMMARY

The Lowball game engine is **100% ready for multiplayer architecture** with zero modifications to core logic. The type system already supports multi-player state (`players[]` array with `activePlayerIndex` tracking). The only blockers are UI-layer (single-player rendering) and infrastructure (no network layer).

**Key findings:**
- ✅ Engine is pure, deterministic, Worker-compatible
- ✅ Type system pre-architected for multi-player
- ✅ TypeScript/Vite tooling fully supports Worker bundling
- ⚠️ UI layer must be extended (plugin-level only)
- ⚠️ WebSocket dependency must be added
- ✅ Backward compatibility guaranteed for v1 single-player saves

---

## 1. LOWBALL ENGINE (`src/games/lowball/engine.ts`)

### Complete Exported Functions Reference

| Fn | Signature | Lines | Notes |
|----|-----------|-------|-------|
| `normalize` | `(raw: string) => string` | 31-37 | NFC normalize, strip accents, lowercase, a-z only. Idempotent. |
| `lookupAnswer` | `(puzzle, word) => Answer \| null` | 40-42 | Linear search in puzzle.answers |
| `initAttempt` | `(puzzle, dayId, mode?) => AttemptState` | 45-57 | New round: single player slot, sweepIndex=0, verdict="pending" |
| `canSubmit` | `(state) => boolean` | 60-62 | `sweepIndex < SWEEPS_TOTAL` (2) |
| `totalFor` | `(player) => number` | 65-67 | Sum of all sweep panelScores; uncapped per REQ-014 |
| `computeVerdict` | `(total, parValue) => Verdict` | 73-75 | `total < par ? "win" : "loss"` |
| `submitAnswer` | `(state, puzzle, rawInput, opts?) => SubmitResult` | 85-146 | **Core engine; see breakdown below** |
| `isBarLit` | `(index, tickCounter) => boolean` | 160-162 | `index >= 100 - tickCounter` (tension counter rendering) |
| `advanceTick` | `(state) => AttemptState` | 169-173 | Drain one tick; idempotent when target reached |
| `selectDailyPuzzleId` | `(dayId, version, datasetId, count) => string \| null` | 182-190 | FNV-1a hash for daily selection |
| `selectPracticePuzzleId` | `(dayId, ordinal, count, daily?) => string \| null` | 198-209 | Seeded, avoids collision with daily |
| `repairState` | `(raw) => AttemptState \| null` | 233-272 | **Crucial: v1 compat layer** |

### submitAnswer() Algorithm (lines 85-146)

**Input:** State, Puzzle, Raw String, Optional Flags  
**Output:** SubmitResult = { state: AttemptState, error?: SubmitError, sweep: Sweep }

**Steps:**

1. **Pre-flight** (91-92)
   - If `!canSubmit(state)` return `{ state, error: "no_sweeps_remaining", sweep: null }`
   - Prevents submission after round is over

2. **Access player** (95)
   - `const player = state.players[state.activePlayerIndex]`
   - Direct array access by index

3. **Normalize input** (96)
   - `const word = normalize(rawInput)`
   - Transforms to canonical form for validation

4. **Duplicate check** (97)
   - `const alreadyGiven = player.sweeps.some(s => s.answerWord === word && word !== "")`
   - Empty submissions always allowed (they fail validation anyway)

5. **Initialize penalty** (99-100)
   - `panelScore = MAX_PANEL_SCORE (100)`
   - `invalidReason = null`

6. **Validation cascade** (102-115) — **First match wins**
   