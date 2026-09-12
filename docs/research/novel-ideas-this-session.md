# Novel Word-Game Ideas — THIS SESSION (vetted catalogue)

> **Source constraint:** derived only from this session's reports in
> `docs/research/` (genre taxonomy, format catalog, NYT factsheets). Prior-session
> idea files and the existing hub games were NOT used as idea sources.
>
> **Novelty bar:** best-effort + documented (per session decision). Verdicts use the
> rubric surfaced by the bob-researcher prior-art sweeps: sameness is judged on
> **(1) player action space, (2) feedback structure, (3) objective function,
> (4) determinism/adversary** — not shared genre labels.
>
> **Prior-art sweeps:** bob-researcher jobs `d520acff` (deduction+semantic),
> `67af4e2a` (grouping/chain/tile/ladder), `41de414e` (search/anagram/crossword/
> narrative/typing — cancelled after looping; those verdicts reasoned from the
> shared rubric + our format-catalog). All sweeps returned thin external evidence,
> so residual prior-art risk is documented per idea and treated as a hypothesis to
> re-check, never as a guarantee.

## Verdict legend
- **NOVEL** — no close match found; defining operator/objective is uncommon.
- **RECOMBINATION** — recognizable blend of ≤2 established patterns; kept when the
  differentiator materially changes strategy.
- **REJECT** — too close to an existing game; dropped or replaced.

## Scoring (1–5): Market, Feasibility, Novelty, Addictiveness, Shareability, Simplicity

---

## Selected: 2 per genre (20 games)

### Genre 1 — Crossword / grid-fill
| Game | Mechanic (one line) | Verdict | Residual risk |
|------|---------------------|---------|---------------|
| **Fault Lines** | Audit a *filled* grid; find the one intersection where a swapped across/down pair reads wrong. | RECOMBINATION | "spot-the-error crossword" may exist in print; check. |
| **Clueback** | Grid is solved; clues are missing — pick the real clue (of 3) per entry. | NOVEL-leaning | reverse-clue quizzes exist but not as a daily grid format. |

### Genre 2 — Word search / hidden-word
| Game | Mechanic | Verdict | Residual risk |
|------|----------|---------|---------------|
| **Undertow** | Themed word search where every answer runs *backwards*; forward runs are decoys. | RECOMBINATION | directionality is a known search axis; "backwards-only + decoys" daily not seen. |
| **Fogline** | Grid tiles start fogged; each found word de-fogs its neighbours, opening the board. | RECOMBINATION | progressive reveal common in casual; novel as a daily word search. |

### Genre 3 — Anagram / word-formation
| Game | Mechanic | Verdict | Residual risk |
|------|----------|---------|---------------|
| **Ration** | Letters have stock counts; spend the inventory to cover a target word-length histogram. | NOVEL-leaning | letter-inventory budgeting uncommon vs Spelling Bee/anagram. |
| **Overdraft** | Build one long word; you may "borrow" ≤2 out-of-set letters, each costing points. | NOVEL-leaning | penalty-for-foreign-letters scoring not seen in mainstream. |

### Genre 4 — Wordle-like deduction
| Game | Mechanic | Verdict | Residual risk |
|------|----------|---------|---------------|
| **Mirrorle** | TWO secret words; each guess returns only the *summed* green count across both. | NOVEL | multi-Wordles (Quordle) keep per-target feedback; aggregated-sum is the differentiator. |
| **Driftword** | Secret word shifts one letter/turn by a rule you must infer (deterministic, not adversarial). | NOVEL | distinct from Absurdle (adversarial) per sweep. |

### Genre 5 — Connection / grouping
| Game | Mechanic | Verdict | Residual risk |
|------|----------|---------|---------------|
| **Seam** | Arrange 12 words into ONE linear chain; each adjacent pair shares a hidden link. | NOVEL | no ordered hidden-link chain prior art found. |
| **Ghost Group** | Connections-style, but only 3 groups given — deduce & *name* the hidden 4th. | RECOMBINATION | close to Connections; differentiator = name+justify the ghost category. |

### Genre 6 — Tile-placement / board
| Game | Mechanic | Verdict | Residual risk |
|------|----------|---------|---------------|
| **Isthmus** | Lay a single unbroken word-path of tiles connecting two opposite shores. | NOVEL | connectivity objective (not coverage/score) not matched in sweep. |
| **Tare** | Place tiles to make words while keeping total tile "weight" balanced left vs right. | RECOMBINATION | Scrabble placement + balance constraint; balance twist is fresh. |

### Genre 7 — Word ladder / transformation
| Game | Mechanic | Verdict | Residual risk |
|------|----------|---------|---------------|
| **Tollgate** | Word ladder where some letters are "tolled"; minimise total *cost*, not steps. | NOVEL (tentative) | weighted word-ladder not found as a named daily. |
| **Fork** | One start, TWO targets; optimise the shared trunk before branching (disjoint branches). | RECOMBINATION | branching/Steiner ladder; disjoint-branch rule differentiates. |

### Genre 8 — Typing / speed
| Game | Mechanic | Verdict | Residual risk |
|------|----------|---------|---------------|
| **Decay** | On-screen themed words lose a letter each second; type them before they vanish. | RECOMBINATION | degrading targets exist in arcade typing; novel as a deterministic daily word set. |
| **Cascade Type** | Words fall; typing one shifts adjacencies that spawn bonus words. | RECOMBINATION | falling-word typers exist; bonus-adjacency twist is the differentiator. |

> Note: original "Metronome" (rhythm-timed typing) **REJECTED** — too close to
> existing rhythm-typing games (Typing of the Dead / Epistory family). Replaced by
> Decay + Cascade Type, which keep a deterministic daily word focus.

### Genre 9 — Narrative / adventure
| Game | Mechanic | Verdict | Residual risk |
|------|----------|---------|---------------|
| **Marginalia** | Fill blanks in a daily micro-story; your word choices branch which ending unlocks. | RECOMBINATION | cloze + branching fiction; word-choice-as-branch is the fresh combination. |
| **Cipher Diary** | Decode one diary entry/day; the running cipher key is built from prior days' answers. | RECOMBINATION | cryptograms exist; cross-day key carry is the differentiator. |

### Genre 10 — Semantic-similarity
| Game | Mechanic | Verdict | Residual risk |
|------|----------|---------|---------------|
| **Parallax** | Find a word roughly equidistant in meaning from two given anchors (embedding midpoint). | NOVEL | no two-anchor midpoint game found; distinct from Semantle/Contexto single-target. |
| **Isobar** | Place 5 words onto concentric meaning-rings by quantised distance from a hidden centre. | NOVEL | distance-banding placement not matched (Isobar hits were medical, unrelated). |

---

## Determinism / content model (shared)
Every selected game is a **deterministic daily**, validated at build time against
bundled data (dictionary, compounds, embeddings, cipher keys), producing a
**spoiler-safe share artifact** and a **sub-3-minute session**, matching the hub's
existing offline-first, client-side plugin model.

## Residual novelty caveat
bob-researcher could not reach every app store or print-puzzle archive. Verdicts are
best-effort. Before each game's spec, its `spec-workflow` risks section must carry a
"prior-art residual risk" entry and, where feasible, a targeted re-check.
