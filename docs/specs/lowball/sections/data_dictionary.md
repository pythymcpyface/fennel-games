## Data Dictionary

| ID | Name | Type | Format | Range | Units | Default | Nullable | PII | Source | Validation |
|---|---|---|---|---|---|---|---|---|---|---|
| FIELD-001 | dayId | string | `YYYY-MM-DD` (UTC) | valid calendar date | day | — | No | No | System clock (UTC) | Must be a valid ISO date; used only for category selection, never for scoring math |
| FIELD-002 | contentPackVersion | string | semver `X.Y.Z` | — | — | — | No | No | Build tool output | Must match a version present in installed Content Pack |
| FIELD-003 | datasetId | string | slug | — | — | `"lowball"` | No | No | Build-time constant | Must be non-empty, stable across builds |
| FIELD-004 | categoryId | string | slug | — | — | — | No | No | Content Pack (TERM-003) | Must exist in Content Pack's category index |
| FIELD-005 | categoryLabel | string | free text | ≤60 chars | — | — | No | No | Content Pack | Must be human-readable, non-empty |
| FIELD-006 | affixType | enum | `"prefix"` \| `"suffix"` | 2 values | — | — | No | No | Content Pack | Must be one of enum |
| FIELD-007 | affixValue | string | lowercase letters | length 2–4 (suffix) or 3–4 (prefix) | — | — | No | No | Content Pack | Must match affixType length rule |
| FIELD-008 | answerWord | string | lowercase en-GB word | 1–45 chars | — | — | No | No | User input / Content Pack Answer List (TERM-009) | Must exist in the round's Answer List to be valid |
| FIELD-009 | panelScore | integer | — | 0–100 | score points | — | No | No | Build-time formula (TERM-006) | Must be integer in [0,100] |
| FIELD-010 | isFindable | boolean | — | `true`/`false` | — | `false` | No | No | Build tool (SCOWL tier check) | `true` only if SCOWL tier ≤ 50 |
| FIELD-011 | scowlTier | integer | enum | {10,20,35,40,50,55,60,70} | — | — | No | No | Vendored SCOWL corpus | Must be one of enum set |
| FIELD-012 | gloveRank | integer | — | 1–400000 | line number | null | Yes | No | Vendored GloVe 6B 50d file | Null if out-of-vocabulary |
| FIELD-013 | parValue | integer | — | 0–200 (practical) | score points | — | No | No | Build tool (median calc) | Must equal median of plausibly-retrievable answers' scores, precomputed |
| FIELD-014 | sweepIndex | integer | — | 0–1 | — | 0 | No | No | Pure engine state (TERM-018) | Must be 0 or 1; increments only via valid submission transition |
| FIELD-015 | activePlayerIndex | integer | — | 0–3 | — | 0 | No | No | Pure engine state (TERM-017) | Must be < players.length |
| FIELD-016 | players | array<PlayerSlot> | — | length 1–4 | — | length 1 | No | No | Pure engine state (TERM-016) | v1: length must equal 1 |
| FIELD-017 | totalScore | integer | — | 0–200 (practical, uncapped) | score points | — | No | No | Pure engine (sum of 2 panelScores, or 100 per invalid sweep) | Must equal sum of player's two sweep scores |
| FIELD-018 | verdict | enum | `"win"` \| `"loss"` \| `"pending"` | 3 values | — | `"pending"` | No | No | Pure engine (TERM-020) | `"win"` iff totalScore < parValue and both sweeps complete |
| FIELD-019 | tickCounter | integer | — | 0–100 | ticks | 100 | No | No | Pure engine state (TERM-015) | Must be integer in [0,100]; monotonically non-increasing per drain sequence |
| FIELD-020 | reducedMotion | boolean | — | `true`/`false` | — | `false` | No | No | Host environment `prefers-reduced-motion` | Read-only input to engine/view; engine must not mutate |
| FIELD-021 | storageKeyDaily | string | constant | — | — | `"lowball.daily.v1"` | No | No | App constant | Must never equal storageKeyPractice |
| FIELD-022 | storageKeyPractice | string | constant | — | — | `"lowball.practice.v1"` | No | No | App constant | Must never equal storageKeyDaily |
| FIELD-023 | schemaVersion | integer | — | ≥1 | — | 1 | No | No | Save State (TERM-023) | On mismatch, migrate or discard, never throw |
| FIELD-024 | isDuplicateOfEarlierAnswer | boolean | — | `true`/`false` | — | `false` | No | No | Pure engine (comparison of sweep answers) | `true` forces panelScore=100 for that sweep |
| FIELD-025 | shareText | string | plain text | ≤280 chars | — | — | No | No | Spoiler-Safe Share module (TERM-021) | Must not contain any FIELD-008 value substring |

