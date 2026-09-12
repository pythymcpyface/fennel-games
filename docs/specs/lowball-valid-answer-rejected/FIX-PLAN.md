# Fix Plan — lowball-valid-answer-rejected

**Approved by user:** whole-word-plus-inflections blocklist; fix both causes plus the
CI agreement proof.

---

## Strategy

Move both rules into `src/games/lowball/content-build.ts` (already pure, already unit
tested, DOM-free) and have the generator call them. The generator keeps only its I/O:
reading the corpus, streaming GloVe ranks, writing the pack.

The point is not merely to correct the arithmetic. It is to make the two rules
**physically the same code**, so the divergence class cannot recur.

## Changes

| File | Change | REQ |
|---|---|---|
| `src/games/lowball/content-build.ts` | Add `isBlockedWord`, `isSafeAffix`, `groupWordsByAffix`. Grouping delegates to the runtime `matchesAffix`. | REQ-001..004 |
| `tools/build-lowball.ts` | Delete the local `BLOCKED` regex and the `+ 1` grouping loop; call the three new helpers. Bump `PACK_VERSION`. Add the agreement proof before writing. | REQ-004, REQ-009 |
| `tests/lowball-regression-valid-answer.test.ts` | Reproduction plus regression suite (already written, currently RED). | REQ-001..008 |
| `public/lowball.json` | Regenerated. | REQ-009 |

### Blocklist rule (REQ-001, REQ-002)

A word is blocked when, lowercased, it is:

1. exactly a listed term, or
2. a listed term plus one of `s, es, ed, ing, er, ers, y`, or
3. a member of an explicit compound denylist (`rapeseed`, `bullshit`, …).

Rule 3 exists because whole-word matching alone would newly **admit** offensive
compounds — a regression the user was warned about and which the spec calls out. The
denylist is a named constant so content-safety can review it without reading logic.

`isSafeAffix` tests whether the affix **is** a blocked term. It deliberately does *not*
test whether some blocked term contains the affix — that mistake was made once while
prototyping and would have excluded the `"ape"` category, reproducing the very bug
under repair. A test pins this.

### Grouping rule (REQ-004)

`groupWordsByAffix` calls `matchesAffix(word, type, value)` — the runtime predicate —
for every candidate. No length arithmetic exists on the build side at all.

### Agreement proof (REQ-006, REQ-007)

Runs inside the generator, before serialisation, so a bad pack cannot be written:

- **Soundness:** every shipped answer satisfies `matchesAffix`, and no shipped answer
  is a blocked word.
- **Completeness:** for each shipped category, every clean corpus word satisfying
  `matchesAffix` is present in its Answer List.

Both are also asserted in the test suite against the committed pack, so CI enforces
them on every run rather than only at generation time.

## Expected effect (measured by dry run before committing)

| | Before | After |
|---|---|---|
| Categories passing the gate | 988 | **1246** |
| `"ape"` category | 20 words, no `grape` | 33 words, `grape` present, admitted |
| `grape` blocked | yes | **no** |
| `rape` / `rapes` blocked | yes | **yes** |

`"ame"` grows to 47 words and legitimately exits the 10–36 band. That is the fairness
gate working, not a new defect.

## Pack version

`PACK_VERSION` goes `1.0.0` → `1.1.0`. The version feeds the FNV-1a daily selection
seed, so **which category each day maps to changes**. Accepted consequence, approved by
the user:

- Historical days will resolve differently than they did on the old pack. Unavoidable
  once answer content changes; the alternative is knowingly shipping wrong answers.
- A player mid-round when the app updates keeps their in-progress state, because saved
  state is keyed by `dayId` and `puzzleId`, and `startDaily` discards a save whose
  `puzzleId` no longer matches the selected category — starting a fresh, correct round
  rather than crashing or showing mismatched answers.

## Rollback

Single `git revert` of the fix commit restores both the generator and the previous
`public/lowball.json`, since the regenerated pack is committed alongside the code that
produced it. No data migration, no stored user state depends on pack contents beyond
the `puzzleId` check described above.

## Out of scope (deliberately not touched)

- The same substring-blocklist flaw exists in other games' build tools. Fixing those
  would regenerate other games' packs, which is outside this defect. Recorded as a
  follow-up.
- `matchesAffix` itself is correct and unchanged.
- No runtime engine change. No new dependency.
