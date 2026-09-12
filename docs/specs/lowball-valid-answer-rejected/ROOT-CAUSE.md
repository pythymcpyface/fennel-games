# Root Cause — lowball-valid-answer-rejected

**Reported:** the category `Words ending in "ape"` rejected `grape` and applied the
100-point invalid-submission penalty.

**Verdict:** two independent defects, both in the build-time content generator
(`tools/build-lowball.ts`). The runtime engine is not at fault: it correctly rejects
words absent from the Answer List, and the Answer List was wrong.

---

## Why a wrong Answer List is fatal rather than cosmetic

Per accepted decision ADR-002, each puzzle's Answer List **is** the runtime
validator. It is derived at build time from the complete 111,676-word corpus, so a
submission absent from it is invalid *by definition*. No dictionary ships, which
keeps the pack at ~165 KiB instead of megabytes.

The consequence was recorded as accepted residual **RISK-002**: if the pipeline omits
a valid word, the game mis-rejects it permanently for that category, with no runtime
escape hatch. This bug is that risk materialising in production. The player has only
two sweeps per round, so a single wrong rejection can lose the day outright.

---

## Cause A — the blocklist matched as an unanchored substring

`tools/build-lowball.ts` filtered candidates through a regular expression of blocked
terms, applied with `.test()` against every corpus word. `.test()` is a substring
search unless anchored, and the expression was not anchored.

The blocklist contains `rape`. Therefore:

```
/rape/.test("grape")  ->  true   ->  grape deleted from the corpus entirely
```

Words destroyed by `rape`: **grape, drape, scrape, crape, serape, undrape, broomrape**.
Words destroyed by `cock`: **peacock, shuttlecock**.

This is the Scunthorpe problem. It is the direct cause of the reported failure.

Note the words were removed from the **corpus**, not just from one category — so they
were unavailable to every category, not merely `"ape"`.

## Cause B — the build-time length rule disagreed with the runtime rule

Two rules decided category membership, and they did not match.

| Rule | Location | Condition |
|---|---|---|
| Runtime | `src/games/lowball/types.ts` `matchesAffix` | `word.length > affixValue.length` |
| Build-time | `tools/build-lowball.ts` grouping loop | `word.length > affixValue.length + 1` |

The stray `+ 1` excluded every word exactly one letter longer than its affix:

| Affix | Silently dropped |
|---|---|
| `ape` (3) | cape, tape, gape, nape, jape, vape |
| `ame` (3) | came, dame, fame, game, lame, name, same, tame |
| `ough` (4) | bough, cough, dough, rough, tough |

The runtime would have accepted every one of these. The pack simply never contained
them.

### Why the divergence existed at all

The `+ 1` was almost certainly intended to stop a word being its own answer — a
category of `"ape"` should not accept the bare word `ape`. But `matchesAffix` already
handles that with `>` rather than `>=`. The `+ 1` was a second, stricter guard for a
problem already solved, and nothing tested that the two rules agreed.

This is the deeper root cause: **two independent implementations of one rule, with no
test asserting equivalence.** Cause B was inevitable given that structure. Fixing the
arithmetic without removing the duplication would leave the same trap for next time.

---

## Measured blast radius

Verified by running the runtime rule against the full corpus for all 120 shipped
categories:

| Metric | Value |
|---|---|
| Categories affected | **75 of 120** |
| Valid words wrongly rejected | **184** |
| Worst: `"ape"` | 14 missing |
| `"ame"` | 11 missing |
| `"ough"` | 8 missing |
| `"ikes"` | 7 missing |

Not an edge case: a systematic pipeline defect touching nearly two thirds of shipped
content.

---

## Similar-pattern search

| Location | Risk | Finding |
|---|---|---|
| Other build tools using a blocklist | Same substring flaw | `build-semantic-gradient.ts` and siblings use the same `BLOCKED.test(w)` shape. **Out of scope for this fix** but the same latent defect; recorded as a follow-up rather than silently fixed, since changing other games' packs is beyond this bug. |
| Other games with a build/runtime rule pair | Same divergence class | Lowball is the only game whose Answer List is the sole validator, so it is uniquely exposed. Others ship a separate accept-list. |
| `isBarLit`, `computePar`, `panelScore` | Duplicate-rule class | Already single-sourced. No divergence found. |

---

## Fix requirement

1. Anchor the profanity match to whole words plus enumerated inflections and
   compounds, so `rape` stays blocked while `grape` survives.
2. Delete the `+ 1` and have the generator call the **same** `matchesAffix` the runtime
   uses, so the rules cannot diverge again by construction.
3. Add a permanent CI proof of soundness and completeness between build-time and
   runtime acceptance, because item 2 alone prevents only today's divergence, not
   tomorrow's.
