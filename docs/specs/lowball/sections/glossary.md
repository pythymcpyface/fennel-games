# Glossary

## Terms

### TERM-001: Daily Round
**Definition:** The single, canonical Lowball puzzle instance for a given UTC calendar day, whose category is deterministically selected and whose result feeds the hub's shared stats/streak record.
**Synonyms:** Daily puzzle, Daily game, Today's round
**Anti-definition:** Not a Practice Round; not replayable with a different category on the same day; not something whose result can be discarded without affecting streak state.
**Source:** Feature request — "ROUND STRUCTURE", "PRACTICE MODE"

### TERM-002: Practice Round
**Definition:** An additional, on-demand Lowball round drawing a category other than today's Daily Round category from the same content pack, persisted under a separate storage key.
**Synonyms:** Practice session, Practice puzzle
**Anti-definition:** Not counted toward streak/stats; not the Daily Round; must not read or write TERM-011 (Stats Record).
**Source:** Feature request — "PRACTICE MODE"

### TERM-003: Affix Category
**Definition:** A build-time-admitted spelling pattern (a suffix of length 2–4 or a prefix of length 3–4) that defines which words are valid answers for a round, e.g. "Words ending in 'ugh'".
**Synonyms:** Category, Pattern
**Anti-definition:** Not a semantic/topical category; not selected at runtime; not user-defined.
**Source:** Feature request — "CONCEPT", "BUILD-TIME CONTENT GENERATION"

### TERM-004: Sweep
**Definition:** One of exactly two submission opportunities per player per round, each accepting exactly one answer.
**Synonyms:** Turn, Attempt
**Anti-definition:** Not a full round; not repeatable more than twice per player per round.
**Source:** Feature request — "ROUND STRUCTURE"

### TERM-005: Answer
**Definition:** A single word string submitted by a player during a Sweep, evaluated for corpus membership, affix fit, and non-duplication against that player's earlier answer in the same round.
**Synonyms:** Submission, Guess
**Anti-definition:** Not a partial word or phrase; not validated against a shipped dictionary (validated against the puzzle's own answer list, TERM-009).
**Source:** Feature request — "ROUND STRUCTURE", "RUNTIME VALIDATION"

### TERM-006: Panel Score
**Definition:** A build-time-computed integer 0–100 simulating how many of a notional 100 lay surveyed people would give a particular answer; lower scores represent rarer/more unusual answers and are better for the player.
**Synonyms:** Simulated panel score, Score
**Anti-definition:** Not a real survey result; not computed at runtime; not to be described anywhere in UI or docs as "ground truth" or as data from real people.
**Source:** Feature request — "CONCEPT", "SCORING DATA AND ITS HONESTY CONSTRAINT"

### TERM-007: Total Score
**Definition:** The sum of a player's two Panel Scores (one per Sweep) for a round.
**Synonyms:** Round total
**Anti-definition:** Not clamped to 100; may legitimately exceed 100.
**Source:** Feature request — "ROUND STRUCTURE"

### TERM-008: Par
**Definition:** A precomputed value shipped per puzzle representing the median score of the answers a lay player could plausibly retrieve; the Win Condition threshold.
**Synonyms:** Par value, Par score
**Anti-definition:** Not computed at runtime; not the minimum or maximum possible total; not user-facing as a "target you must hit exactly" (it is a strict-less-than threshold).
**Source:** Feature request — "ROUND STRUCTURE"

### TERM-009: Answer List
**Definition:** The exhaustive, precomputed list of every valid answer (word + Panel Score + findability flag) for a given Affix Category, shipped in the content pack; doubles as the runtime validator since no dictionary is shipped separately.
**Synonyms:** Valid-answer set, Category answer list
**Anti-definition:** Not a dictionary of all English words; not partial; not mutable at runtime.
**Source:** Feature request — "RUNTIME VALIDATION WITHOUT A SHIPPED DICTIONARY"

### TERM-010: Findability
**Definition:** A boolean property of a zero-scoring Answer indicating whether it lies at SCOWL tier 50 or better (i.e. a lay player could plausibly retrieve it), as distinct from raw obscurity.
**Synonyms:** Findable flag
**Anti-definition:** Not the same as "non-zero score"; not derived at runtime; a word can be rare (tier 50) yet still findable, or common-looking yet gated to score 0 by GloVe absence.
**Source:** Feature request — "FINDABILITY VERSUS OBSCURITY"

### TERM-011: Stats Record
**Definition:** The hub's existing shared streak/stats storage structure that the Daily Round's win/loss verdict updates; never touched by Practice Rounds.
**Synonyms:** Streak record, Stats/streak state
**Anti-definition:** Not per-game siloed data by design (it is shared across the hub's 50+ games); not writable by Practice Rounds.
**Source:** Feature request — "ROUND STRUCTURE", "PRACTICE MODE"

### TERM-012: Content Pack
**Definition:** The versioned, build-time-generated data bundle for Lowball containing all admitted Affix Categories, their Answer Lists, and Par values; precached for offline play.
**Synonyms:** Data pack, Puzzle pack
**Anti-definition:** Not generated at runtime; not to include the vendored GloVe file; target size ~150 KB.
**Source:** Feature request — "BUILD-TIME CONTENT GENERATION", "DETERMINISM AND OFFLINE CONSTRAINTS"

### TERM-013: Fairness Gate
**Definition:** The build-time admission rule set that a candidate Affix Category must satisfy (answer-count bounds, minimum top score, minimum findable-zero count, minimum findable-tier-50-or-better count, minimum score-ladder spread) to be included in the Content Pack.
**Synonyms:** Spread-and-findability gate, Admission gate
**Anti-definition:** Not a uniqueness gate (Lowball has no single correct answer); not applied at runtime.
**Source:** Feature request — "BUILD-TIME CONTENT GENERATION AND FAIRNESS GATE"

### TERM-014: Tension Counter
**Definition:** The signature UI element: a vertical column of 100 discrete bars that drains from 100 down to an answer's actual Panel Score, driven by a discrete logical Tick Counter held in game state rather than wall-clock animation.
**Synonyms:** 100-bar counter, Drain counter
**Anti-definition:** Not wall-clock/CSS-animation driven; not the sole channel conveying the score (must be accompanied by a textual/numeric and ARIA-announced equivalent); not shown mid-drain when reduced motion is preferred.
**Source:** Feature request — "THE 100-BAR TENSION COUNTER"

### TERM-015: Tick Counter
**Definition:** A discrete integer held in pure game state representing the current position of the Tension Counter's drain animation, advanced by explicit engine transitions rather than time.
**Synonyms:** Logical tick, Drain tick
**Anti-definition:** Not a timestamp; not derived from `Date.now()` or `requestAnimationFrame` inside the engine.
**Source:** Feature request — "THE 100-BAR TENSION COUNTER", "DETERMINISM AND OFFLINE CONSTRAINTS"

### TERM-016: Player Slot
**Definition:** One entry in the round's player list (max 4), holding that player's answers, scores and active/inactive status, structured to support future pass-and-play/remote multiplayer without engine rewrite.
**Synonyms:** Player state, Player entry
**Anti-definition:** Not a user account; v1 always has exactly one Player Slot rendered/playable.
**Source:** Feature request — "ROUND STRUCTURE"

### TERM-017: Active Player Index
**Definition:** An integer index into the Player Slot list identifying whose turn it currently is.
**Synonyms:** Turn pointer
**Anti-definition:** Not used for anything but turn sequencing; in v1 always 0.
**Source:** Feature request — "ROUND STRUCTURE"

### TERM-018: Sweep Index
**Definition:** An integer (0 or 1) identifying which of the two Sweeps is currently active for the active player.
**Synonyms:** Turn/sweep pointer
**Anti-definition:** Not greater than 1; not decremented once a round is complete.
**Source:** Feature request — "ROUND STRUCTURE"

### TERM-019: Dataset Seed
**Definition:** The canonical tuple (dayId, content pack version, dataset id) hashed with FNV-1a 32-bit to deterministically select the Daily Round's Affix Category.
**Synonyms:** Category selection seed
**Anti-definition:** Not random; not dependent on client clock beyond UTC day boundary computation; not re-hashed per player.
**Source:** Feature request — "DETERMINISM AND OFFLINE CONSTRAINTS"

### TERM-020: Verdict
**Definition:** The final Win/Loss determination for a round, produced by comparing Total Score strictly against Par.
**Synonyms:** Result, Outcome
**Anti-definition:** Not computed until both Sweeps for the active player are complete; not equal to a tie state (equality to par is a Loss).
**Source:** Feature request — "ROUND STRUCTURE"

### TERM-021: Spoiler-Safe Share
**Definition:** A share text generator that renders Total Score and Par as numbers/bars without ever including any Answer word.
**Synonyms:** Share text, Share module output
**Anti-definition:** Not permitted to contain any submitted or candidate word string.
**Source:** Feature request — "DETERMINISM AND OFFLINE CONSTRAINTS"

### TERM-022: Reduced Motion Mode
**Definition:** A hub-global user preference (`prefers-reduced-motion`) that, when active, forces the Tension Counter to display the final score immediately with no drain, while keeping the outcome fully perceivable through non-animated channels.
**Synonyms:** Reduced-motion kill switch
**Anti-definition:** Not a per-game setting; not optional to honor.
**Source:** Feature request — "THE 100-BAR TENSION COUNTER"

### TERM-023: Save State
**Definition:** The schema-versioned persisted representation of Daily Round and Practice Round progress, stored under separate keys, repaired or discarded (never crashing) if corrupt.
**Synonyms:** Persisted state, Storage record
**Anti-definition:** Not shared between Daily and Practice; not allowed to throw on corruption.
**Source:** Feature request — "PRACTICE MODE", "DETERMINISM AND OFFLINE CONSTRAINTS"

