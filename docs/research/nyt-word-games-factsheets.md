# Official Fact Sheets: NYT Spelling Bee, Strands, and Connections

Compiled from primary-source-cited references. Mechanic claims trace to NYT's
own pages (via Wikipedia articles that cite the official NYT rules/how-to
articles). NYT help pages block direct automated fetches (HTTP 403), so
sourcing is anchored to the primary-cited encyclopedic articles plus the
official NYT URLs they reference.

---

## 1. NYT Spelling Bee

| Field | Detail |
|---|---|
| Publisher | The New York Times Games |
| Creator / developer | Frank Longo (created it); digital editor Sam Ezersky |
| Launch year | Feb 22, 2015 (weekly print in NYT Magazine); May 9, 2018 (digital daily, with an altered scoring system) |
| Platforms | Web browser + NYT Games mobile app |
| Monetization | Part of the NYT Games subscription bundle (free teaser tier historically limited) |

**Core mechanic / defining constraint**
- Board is a **hexagonal "honeycomb" of 7 letters** (one center letter surrounded by six).
- Players form words of **4+ letters**; **every word must include the mandatory center letter**.
- **Letters may be reused** within a word.

**Scoring, pangrams, rank ladder**
- 1 point per **4-letter** word; for longer words, **1 point per letter**.
- Each puzzle is guaranteed to contain at least one **pangram** — a word using **all seven** letters — which awards **7 bonus points** (e.g., a 7-letter pangram = 14 points).
- Cumulative score unlocks praise-tier ranks (e.g., "Solid," "Amazing," … up to **"Genius"**). Finding **every** valid word earns **"Queen Bee."**
- Design note: editor's convention is to omit the letter **S** (avoids trivial plurals); rare exceptions on milestone puzzles.
- New puzzle goes live **3 A.M. Eastern** daily.

**Source(s)**
- Wikipedia (primary-cited): https://en.wikipedia.org/wiki/The_New_York_Times_Spelling_Bee
- Official site: https://www.nytimes.com/puzzles/spelling-bee
- Official glossary of terms: https://www.nytimes.com/2021/07/26/crosswords/spelling-bee-forum-introduction.html

---

## 2. NYT Strands

| Field | Detail |
|---|---|
| Publisher | The New York Times Games |
| Editor | Tracy Bennett (also edits Wordle); original pitch by Juliette Seive |
| Launch year | March 4, 2024 (beta) |
| Platforms | Web browser (via NYT Games); also surfaced in the NYT Games app |
| Monetization | Part of the NYT Games subscription bundle |

**Core mechanic / defining constraint**
- A **themed word search** on a **6×8 letter grid** (6 columns × 8 rows), one new puzzle daily.
- Unlike classic word search, **words can bend in any direction** (not just straight lines); selection is by tracing adjacent letters.
- **Every letter is used in exactly one word, and words do not overlap** — theme words + the spangram fill the entire grid.
- Players are told the **theme (a clue)** and the **total number of theme words** to find (each ≥ 4 letters).

**Spangram (the signature concept)**
- Each puzzle has one **"spangram"**: a word or short phrase that **describes the theme itself** and **spans two opposite edges** of the grid (it may begin/end anywhere along those edges).
- On solve, the **spangram highlights yellow**; ordinary **theme words turn blue**. (Non-spangram words may also happen to touch two opposite edges.)

**Hint economy**
- Finding **non-theme words of 4+ letters** builds toward hints: every **three** valid non-theme words earns **one hint**, which **highlights the letters of one theme word**.

**Win / failure**
- Completion = all theme words + spangram found. There is **no mistake/attempt budget** and no built-in timer in the base game (endless guessing of non-theme words simply banks hints).

**Source(s)**
- Wikipedia (primary-cited): https://en.wikipedia.org/wiki/The_New_York_Times_Strands
- Official NYT how-to (cited by the article): "Putting a New Twist on a Classic Puzzle," https://www.nytimes.com/2024/03/04/crosswords/strands-word-search-game.html
- Official site: https://www.nytimes.com/games/strands

---

## 3. NYT Connections

| Field | Detail |
|---|---|
| Publisher | The New York Times Games |
| Editor / writer | Wyna Liu |
| Launch year | June 12, 2023 (beta) |
| Platforms | Web browser, iOS, Android (NYT Games app) |
| Monetization | Part of the NYT Games subscription bundle; base game widely free |
| Note | Second-most-played NYT game after Wordle |

**Core mechanic / defining constraint**
- A **16-word grid**; sort the words into **four groups of four**, where each group of four shares a category/connection (e.g., "dog, cat, fish, parrot" → Household Pets).
- Categories may hinge on **wordplay** (palindromes, homophones) to raise difficulty.
- **Red herrings** are intentional: words that seem to group obviously (e.g., "north/south/east/west") are deliberately split across categories by subtler connections — ambiguity is the primary difficulty lever.

**Error budget & difficulty signaling**
- **Four mistakes allowed** — a fourth incorrect group ends the game.
- On solving a group, its category is revealed with a **color-coded difficulty band**: **yellow (easiest) → green → blue → purple (hardest)**. Each puzzle has exactly one category per difficulty level.

**Modes / editions**
- **Connections: Sports Edition** — launched via The Athletic (beta Sep 24, 2024; official Feb 9, 2025 for Super Bowl LIX). Same mechanic, sports-themed groupings, more trivia-driven, with an **optional timer** added at official launch.

**Source(s)**
- Wikipedia (primary-cited): https://en.wikipedia.org/wiki/The_New_York_Times_Connections
- Official NYT how-it's-made (cited by the article): Wyna Liu, "How Our New Game, Connections, Is Put Together," https://www.nytimes.com/2023/06/26/crosswords/new-game-connections.html
- Official site: https://www.nytimes.com/games/connections
- Sports Edition (The Athletic): https://www.nytimes.com/athletic/5791374/2024/09/25/connections-sports-edition-how-to-play/

---

## Sourcing note
- All three mechanic descriptions are traceable to **official NYT pages** (Spelling Bee official site + glossary; Strands "how to play"; Connections "how it's put together"), surfaced here via the primary-cited Wikipedia articles because nytimes.com returns HTTP 403 to automated fetches.
- The earlier bob-researcher follow-up (job 5059f4a4) failed QA (1/1 verified citation) because its crawler could not reach these official pages and returned off-topic NYT articles; this file supersedes that output.
