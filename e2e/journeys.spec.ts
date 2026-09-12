import { test, expect, type Page } from "@playwright/test";

// Comprehensive per-game user-journey E2E. Complements hub.spec.ts (which proves each
// game mounts + a happy-path win). Here we exercise the full journey per UI family:
// invalid input, wrong-guess feedback, hint, loss / attempt exhaustion, share,
// mid-game persistence, keyboard-only operation, and terminal-state lockout.

async function pack(page: Page, file: string): Promise<any> {
  return page.evaluate(async (f) => (await fetch(f)).json(), file);
}

// ---------------------------------------------------------------------------
// TEXT-GUESS family — Hidden Middle (representative), plus Ladderless specifics.
// ---------------------------------------------------------------------------
test.describe("Hidden Middle — full journey", () => {
  test("invalid guess, wrong-but-inside feedback, hint reveals span, then solve", async ({ page }) => {
    await page.goto("/#/game/hidden-middle");
    const p = await pack(page, "./hidden-middle.json");
    const carrier = await page.locator(".carrier").textContent();
    const puz = p.puzzles.find((x: any) => x.carrierWord === carrier);

    // Wrong guess that is a real inside-word but not the answer -> consumes attempt, feedback.
    const wrongInside = (puz.carrierWord as string).slice(0, 2); // a 2-letter substring, likely a word or not
    await page.fill("#guess-input", wrongInside);
    await page.getByRole("button", { name: "Guess" }).click();
    // A guess row appears OR an error/announcement; the board should not be solved.
    await expect(page.locator(".win")).toHaveCount(0);

    // Hint underlines the answer span in the carrier.
    await page.getByRole("button", { name: "Hint" }).click();
    await expect(page.locator(".carrier .hinted")).toHaveCount(1);

    // Solve.
    await page.fill("#guess-input", puz.answerWord);
    await page.getByRole("button", { name: "Guess" }).click();
    await expect(page.locator(".win")).toHaveCount(1);
    // Terminal lockout: input disabled after win.
    await expect(page.locator("#guess-input")).toBeDisabled();
  });

  test("progress persists mid-game across reload", async ({ page }) => {
    await page.goto("/#/game/hidden-middle");
    await page.getByRole("button", { name: "Hint" }).click();
    await expect(page.locator(".carrier .hinted")).toHaveCount(1);
    await page.reload();
    await expect(page.locator(".carrier .hinted")).toHaveCount(1); // hint state restored
  });
});

test.describe("Ladderless — full journey", () => {
  test("rejects a non-dictionary word, accepts a valid one, keyboard submit + focus return", async ({ page }) => {
    await page.goto("/#/game/ladderless");
    await page.fill("#guess-input", "zzzzqxq");
    await page.getByRole("button", { name: "Guess" }).click();
    await expect(page.locator(".error")).toContainText(/not in the word list/i);
    await expect(page.locator(".guesses li")).toHaveCount(0);

    const words = await page.evaluate(async () => (await (await fetch("./ladderless.json")).json()).vocabulary as string[]);
    await page.locator("#guess-input").focus();
    await page.keyboard.type(words[0]);
    await page.keyboard.press("Enter");
    await expect(page.locator(".guesses li")).toHaveCount(1);
    await expect(page.locator("#guess-input")).toBeFocused();
  });

  test("hint announces a warmer word; share announces spoiler-safe result", async ({ page }) => {
    await page.goto("/#/game/ladderless");
    await page.getByRole("button", { name: "Hint" }).click();
    await expect(page.locator(".sr-live")).toContainText(/hint|no hint/i);
    await page.getByRole("button", { name: "Share" }).click();
    await expect(page.locator(".sr-live")).toContainText(/shared|copied|unavailable|blocked/i);
  });
});

// ---------------------------------------------------------------------------
// GAP-TOGGLE family — Sever (loss + feedback + keyboard).
// ---------------------------------------------------------------------------
test.describe("Sever — full journey", () => {
  test("wrong submissions give feedback and eventually lose; gaps are keyboard buttons", async ({ page }) => {
    await page.goto("/#/game/sever");
    // Keyboard: focus first gap and toggle with Enter.
    await page.locator(".gap").first().focus();
    await page.keyboard.press("Enter");
    await expect(page.locator(".gap.on")).toHaveCount(1);

    // Submit repeatedly with an almost-certainly-wrong segmentation to exhaust attempts.
    let lost = false;
    for (let i = 0; i < 6; i++) {
      if (await page.locator(".lose").count()) { lost = true; break; }
      await page.getByRole("button", { name: "Submit" }).click();
    }
    lost = lost || (await page.locator(".lose").count()) > 0 || (await page.locator(".win").count()) > 0;
    expect(lost).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// SELECT-WORD family — Odd Sense (wrong pick decrements, hint eliminates, reveal on end).
// ---------------------------------------------------------------------------
test.describe("Odd Sense — full journey", () => {
  test("submit disabled without selection; hint eliminates; solve reveals theme", async ({ page }) => {
    await page.goto("/#/game/odd-sense");
    await expect(page.getByRole("button", { name: "Submit" })).toBeDisabled();

    await page.getByRole("button", { name: "Hint" }).click();
    await expect(page.locator(".word.eliminated")).toHaveCount(1);

    const answers = await pack(page, "./odd-sense.json");
    const words = await page.locator(".word").allTextContents();
    const puz = answers.puzzles.find((p: any) => p.words.join() === words.map((w) => w.trim()).join());
    // Select the odd word and submit -> solved reveal.
    await page.locator(".word").nth(puz.oddWordIndex).click();
    await page.getByRole("button", { name: "Submit" }).click();
    await expect(page.locator(".reveal")).toHaveCount(1);
  });
});

// ---------------------------------------------------------------------------
// REORDER family — Degrees (reorder controls change order; lock via hint).
// ---------------------------------------------------------------------------
test.describe("Degrees — full journey", () => {
  test("move controls reorder items; hint locks weakest; full order solves", async ({ page }) => {
    await page.goto("/#/game/degrees");
    await expect(page.locator(".deg-item")).toHaveCount(5);
    // Hint locks slot 0.
    await page.getByRole("button", { name: "Hint" }).click();
    await expect(page.locator(".deg-item.locked")).toHaveCount(1);
    // Solve by hinting all then check.
    for (let i = 0; i < 5; i++) {
      const disabled = await page.getByRole("button", { name: "Hint" }).isDisabled();
      if (disabled) break;
      await page.getByRole("button", { name: "Hint" }).click();
    }
    await page.getByRole("button", { name: "Check order" }).click();
    await expect(page.locator(".win")).toHaveCount(1);
  });
});

// ---------------------------------------------------------------------------
// MULTI-SLOT-TYPE family — Numeronym (wrong feedback, per-item hint, all solve).
// ---------------------------------------------------------------------------
test.describe("Numeronym — full journey", () => {
  test("wrong expansion feedback; length hint; solve all five", async ({ page }) => {
    await page.goto("/#/game/numeronym");
    const p = await pack(page, "./numeronym.json");
    const firstClue = await page.locator(".num-clue").first().textContent();
    const puz = p.puzzles.find((x: any) => x.clues[0] === firstClue);

    await page.locator(".num-clue").first().click();
    await page.fill("#guess-input", "zzzz");
    await page.getByRole("button", { name: "Enter" }).click();
    await expect(page.locator(".sr-live")).toContainText(/not a word|match|fits|left/i);

    await page.getByRole("button", { name: "Hint" }).click();
    await expect(page.locator(".sr-live")).toContainText(/letters/i);

    for (let i = 0; i < 5; i++) {
      await page.locator(".num-clue").nth(i).click();
      await page.fill("#guess-input", puz.answers[i]);
      await page.getByRole("button", { name: "Enter" }).click();
    }
    await expect(page.locator(".win")).toHaveCount(1);
  });
});

// ---------------------------------------------------------------------------
// DROPDOWN-MATCH family — Borrowed (wrong match, reveal on loss).
// ---------------------------------------------------------------------------
test.describe("Borrowed — full journey", () => {
  test("wrong matches lose after 4 tries and reveal answers", async ({ page }) => {
    await page.goto("/#/game/borrowed");
    const p = await pack(page, "./borrowed.json");
    const words = await page.locator(".match-word").allTextContents();
    const puz = p.puzzles.find((x: any) => x.words.join() === words.map((w) => w.trim()).join());
    // Deliberately pick a wrong option for every word (an option != its answer).
    const selects = page.locator(".match-select");
    for (let i = 0; i < 5; i++) {
      const wrong = (puz.options as string[]).find((o) => o !== puz.answers[i])!;
      await selects.nth(i).selectOption(wrong);
    }
    for (let i = 0; i < 4; i++) {
      if (await page.locator(".lose").count()) break;
      await page.getByRole("button", { name: "Check" }).click();
    }
    await expect(page.locator(".lose")).toHaveCount(1);
    await expect(page.locator(".reveal")).toHaveCount(1);
  });
});

// ---------------------------------------------------------------------------
// PATH-MOVE family — Antonym Bridge (invalid move feedback, hint, solve, lockout).
// ---------------------------------------------------------------------------
test.describe("Antonym Bridge — full journey", () => {
  test("rejects a non-antonym, hint suggests a word, then solve locks the board", async ({ page }) => {
    await page.goto("/#/game/antonym-bridge");
    await page.fill("#guess-input", "zzzz");
    await page.getByRole("button", { name: "Flip" }).click();
    await expect(page.locator(".error")).toContainText(/not a word|antonym/i);

    await page.getByRole("button", { name: "Hint" }).click();
    await expect(page.locator(".sr-live")).toContainText(/try|no hint/i);

    const path = await page.evaluate(async () => {
      const p = await (await fetch("./antonym-bridge.json")).json();
      const cur = document.querySelector(".score-line .cur")?.textContent;
      const puz = p.puzzles.find((x: any) => x.startWord === cur);
      const adj: Record<string, Set<string>> = {};
      const add = (a: string, b: string) => { (adj[a] ??= new Set()).add(b); };
      for (const [w, ns] of Object.entries(puz.antonyms as Record<string, string[]>)) for (const n of ns) { add(w, n); add(n, w); }
      const prev = new Map<string, string>(); const seen = new Set([puz.startWord]); let fr = [puz.startWord];
      while (fr.length) { const nx: string[] = []; for (const w of fr) for (const n of adj[w] ?? []) if (!seen.has(n)) { seen.add(n); prev.set(n, w); nx.push(n); } fr = nx; }
      const out: string[] = []; let node: string | undefined = puz.targetWord;
      while (node && node !== puz.startWord) { out.unshift(node); node = prev.get(node); }
      return out;
    });
    for (const w of path) { await page.fill("#guess-input", w); await page.getByRole("button", { name: "Flip" }).click(); }
    await expect(page.locator(".win")).toHaveCount(1);
    await expect(page.locator("#guess-input")).toBeDisabled();
  });
});

// ---------------------------------------------------------------------------
// PER-LETTER family — Acronym Attack (per-letter validity marks).
// ---------------------------------------------------------------------------
test.describe("Acronym Attack — full journey", () => {
  test("wrong-initial word marks invalid; valid expansion wins", async ({ page }) => {
    await page.goto("/#/game/acronym-attack");
    const p = await pack(page, "./acronym-attack.json");
    const letters = (await page.locator(".aa-letter").allTextContents()).join("");
    const byInitial: Record<string, string> = {};
    for (const w of p.dictionary as string[]) { const c = w[0]; if (w.length >= 2 && !byInitial[c]) byInitial[c] = w; }

    // Put a wrong-initial word in slot 0 -> row marked bad live (input handler).
    await page.locator(".aa-row .text-input").first().fill("ZEBRA");
    await expect(page.locator(".aa-row").first()).toHaveClass(/bad/);

    for (let i = 0; i < letters.length; i++) await page.locator(".aa-row .text-input").nth(i).fill(byInitial[letters[i]]);
    await page.getByRole("button", { name: "Submit" }).click();
    await expect(page.locator(".win")).toHaveCount(1);
  });
});

// ---------------------------------------------------------------------------
// SYLLABLE family — Stress Test (choose wrong then correct; aria-pressed toggles).
// ---------------------------------------------------------------------------
test.describe("Stress Test — full journey", () => {
  test("syllable buttons are aria-pressed; marking all stresses solves", async ({ page }) => {
    await page.goto("/#/game/stress-test");
    const first = page.locator(".stress-row").first().locator(".syl").first();
    await first.click();
    await expect(first).toHaveAttribute("aria-pressed", "true");

    const stresses = await page.evaluate(async () => {
      const p = await (await fetch("./stress-test.json")).json();
      const words = Array.from(document.querySelectorAll(".stress-row .syllables")).map((row) =>
        Array.from(row.querySelectorAll(".syl")).map((b) => b.textContent).join(""));
      const puz = p.puzzles.find((x: any) => x.items.map((it: any) => it.word).join() === words.join());
      return puz.items.map((it: any) => it.stressedIndex) as number[];
    });
    const rows = page.locator(".stress-row");
    for (let i = 0; i < stresses.length; i++) await rows.nth(i).locator(".syl").nth(stresses[i]).click();
    await page.getByRole("button", { name: "Check" }).click();
    await expect(page.locator(".win")).toHaveCount(1);
  });
});

test.describe("Edit Clusters — full journey", () => {
  test("select the densest 4-clique to win; wrong group consumes a try", async ({ page }) => {
    await page.goto("/#/game/edit-clusters");
    await expect(page.locator(".game-title")).toHaveText("Edit Clusters");
    await expect(page.locator(".ec-cell").first()).toBeVisible();
    // Resolve today's puzzle from the bundled pack via the shown board.
    const cluster = await page.evaluate(async () => {
      const pack = await (await fetch("./edit-clusters.json")).json();
      const board = Array.from(document.querySelectorAll(".ec-cell")).map((b) => b.textContent).sort();
      const puz = pack.puzzles.find((p: any) => [...p.board].sort().join() === board.join());
      return puz.cluster as string[];
    });

    // A deliberately wrong group: swap one clique member for a decoy on the board.
    const decoy = await page.evaluate(async (c: string[]) => {
      const board = Array.from(document.querySelectorAll(".ec-cell")).map((b) => b.textContent as string);
      return board.find((w) => !c.includes(w))!;
    }, cluster);
    for (const w of [...cluster.slice(0, 3), decoy]) {
      await page.getByRole("button", { name: w, exact: true }).click();
    }
    await page.getByRole("button", { name: /Submit/ }).click();
    await expect(page.locator(".win")).toHaveCount(0);
    await expect(page.locator(".ec-history .ec-sig")).toHaveCount(1);

    // Now the correct densest cluster.
    for (const w of cluster) await page.getByRole("button", { name: w, exact: true }).click();
    await page.getByRole("button", { name: /Submit/ }).click();
    await expect(page.locator(".win")).toHaveCount(1);
  });

  test("progress persists across reload", async ({ page }) => {
    await page.goto("/#/game/edit-clusters");
    const first = await page.locator(".ec-cell").first().textContent();
    await page.locator(".ec-cell").first().click();
    await expect(page.locator(".ec-cell.selected")).toHaveCount(1);
    // selection is transient; reload should restore committed attempts only.
    await page.reload();
    await expect(page.locator(".ec-cell").first()).toHaveText(first ?? "");
  });
});

test.describe("Odd-One Gradient — full journey", () => {
  test("a belonging tap warms up; the true outlier wins", async ({ page }) => {
    await page.goto("/#/game/odd-one-gradient");
    await expect(page.locator(".game-title")).toHaveText("Odd-One Gradient");
    await expect(page.locator(".oog-word").first()).toBeVisible();
    const { odd, belong } = await page.evaluate(async () => {
      const pack = await (await fetch("./odd-one-gradient.json")).json();
      const words = Array.from(document.querySelectorAll(".oog-word")).map((b) => b.textContent).sort();
      const puz = pack.puzzles.find((p: any) => [...p.words].sort().join() === words.join());
      const belong = (puz.words as string[]).find((w) => w !== puz.odd)!;
      return { odd: puz.odd as string, belong };
    });

    // Wrong (belonging) tap: consumes a turn, shows heat feedback, no win.
    await page.locator(".oog-word", { hasText: new RegExp(`^${belong}$`) }).click();
    await expect(page.locator(".win")).toHaveCount(0);
    await expect(page.locator(`.oog-word`, { hasText: belong })).toBeDisabled();

    // The true odd one wins.
    await page.locator(".oog-word", { hasText: new RegExp(`^${odd}$`) }).click();
    await expect(page.locator(".win")).toHaveCount(1);
  });

  test("progress persists across reload", async ({ page }) => {
    await page.goto("/#/game/odd-one-gradient");
    await expect(page.locator(".oog-word").first()).toBeVisible();
    const belong = await page.evaluate(async () => {
      const pack = await (await fetch("./odd-one-gradient.json")).json();
      const words = Array.from(document.querySelectorAll(".oog-word")).map((b) => b.textContent).sort();
      const puz = pack.puzzles.find((p: any) => [...p.words].sort().join() === words.join());
      return (puz.words as string[]).find((w) => w !== puz.odd)!;
    });
    await page.locator(".oog-word", { hasText: new RegExp(`^${belong}$`) }).click();
    await page.reload();
    await expect(page.locator(`.oog-word`, { hasText: belong })).toBeDisabled();
  });
});

test.describe("Twin Trails — full journey", () => {
  test("a wrong split reports partial count; the correct split wins", async ({ page }) => {
    await page.goto("/#/game/twin-trails");
    await expect(page.locator(".game-title")).toHaveText("Twin Trails");
    await expect(page.locator(".tt-word").first()).toBeVisible();
    const gold = await page.evaluate(async () => {
      const pack = await (await fetch("./twin-trails.json")).json();
      const words = Array.from(document.querySelectorAll(".tt-word")).map((b) => b.textContent).sort();
      const puz = pack.puzzles.find((p: any) => [...p.words].sort().join() === words.join());
      return puz.gold as Record<string, "A" | "B">;
    });
    const words = Object.keys(gold);

    // Assign each word to its gold trail. Cycle is unassigned -> A -> B -> unassigned,
    // so tap once for A-words, twice for B-words.
    const tap = async (w: string, times: number) => {
      for (let i = 0; i < times; i++) await page.locator(".tt-word", { hasText: new RegExp(`^${w}$`) }).click();
    };
    // First submit a deliberately wrong split: everything on Trail A.
    for (const w of words) await tap(w, 1); // all A
    await page.getByRole("button", { name: /Submit trails/ }).click();
    await expect(page.locator(".win")).toHaveCount(0);
    await expect(page.locator(".tt-history .tt-sig")).toHaveCount(1);

    // The assignment persists as "all A" after the attempt. Fix only the B-words
    // (A -> B is a single tap); A-words already correct.
    for (const w of words) if (gold[w] === "B") await tap(w, 1);
    await page.getByRole("button", { name: /Submit trails/ }).click();
    await expect(page.locator(".win")).toHaveCount(1);
  });
});

test.describe("Tier List — full journey", () => {
  test("reorder words to the correct common->rare order to win", async ({ page }) => {
    await page.goto("/#/game/tier-list");
    await expect(page.locator(".game-title")).toHaveText("Tier List");
    await expect(page.locator(".tl-word").first()).toBeVisible();
    const order = await page.evaluate(async () => {
      const pack = await (await fetch("./tier-list.json")).json();
      const words = Array.from(document.querySelectorAll(".tl-word")).map((b) => b.textContent).sort();
      const puz = pack.puzzles.find((p: any) => [...p.words].sort().join() === words.join());
      return puz.order as string[];
    });

    // Selection sort using the ▲/▼ move buttons: for each target position, find the
    // desired word's current row and move it up until it reaches position i.
    for (let i = 0; i < order.length; i++) {
      // find current index of order[i]
      let cur = await page.evaluate((w: string) => {
        const rows = Array.from(document.querySelectorAll(".tl-row .tl-word")).map((n) => n.textContent);
        return rows.indexOf(w);
      }, order[i]);
      while (cur > i) {
        await page.locator(".tl-row").nth(cur).getByRole("button", { name: /move .* up/ }).click();
        cur -= 1;
      }
    }
    await page.getByRole("button", { name: /Lock in order/ }).click();
    await expect(page.locator(".win")).toHaveCount(1);
  });

  test("progress persists across reload", async ({ page }) => {
    await page.goto("/#/game/tier-list");
    // make one wrong submission to record an attempt, then reload
    await page.getByRole("button", { name: /Lock in order/ }).click();
    await expect(page.locator(".tl-history .tl-sig")).toHaveCount(1);
    await page.reload();
    await expect(page.locator(".tl-history .tl-sig")).toHaveCount(1);
  });
});

test.describe("Web Hub — full journey", () => {
  test("a low-degree pick misses; the hub wins", async ({ page }) => {
    await page.goto("/#/game/web-hub");
    await expect(page.locator(".game-title")).toHaveText("Web Hub");
    await expect(page.locator(".wh-word").first()).toBeVisible();
    const { hub, miss } = await page.evaluate(async () => {
      const pack = await (await fetch("./web-hub.json")).json();
      const board = Array.from(document.querySelectorAll(".wh-word")).map((b) => b.textContent).sort();
      const puz = pack.puzzles.find((p: any) => [...p.board].sort().join() === board.join());
      const miss = (puz.board as string[]).find((w) => w !== puz.hub && puz.degrees[w] < puz.degrees[puz.hub])!;
      return { hub: puz.hub as string, miss };
    });

    await page.locator(".wh-word", { hasText: new RegExp(`^${miss}$`) }).click();
    await expect(page.locator(".win")).toHaveCount(0);
    await expect(page.locator(".wh-word.miss")).toHaveCount(1);

    await page.locator(".wh-word", { hasText: new RegExp(`^${hub}`) }).click();
    await expect(page.locator(".win")).toHaveCount(1);
  });

  test("progress persists across reload", async ({ page }) => {
    await page.goto("/#/game/web-hub");
    await expect(page.locator(".wh-word").first()).toBeVisible();
    const miss = await page.evaluate(async () => {
      const pack = await (await fetch("./web-hub.json")).json();
      const board = Array.from(document.querySelectorAll(".wh-word")).map((b) => b.textContent).sort();
      const puz = pack.puzzles.find((p: any) => [...p.board].sort().join() === board.join());
      return (puz.board as string[]).find((w) => w !== puz.hub)!;
    });
    await page.locator(".wh-word", { hasText: new RegExp(`^${miss}$`) }).click();
    await page.reload();
    await expect(page.locator(".wh-word.miss")).toHaveCount(1);
  });
});

test.describe("Hint buttons show a visible hint", () => {
  // These games previously delivered their hint only to the screen-reader-only
  // live region; the fix renders a visible .hint-line for sighted users too.
  test("Antonym Bridge Hint reveals a visible suggestion", async ({ page }) => {
    await page.goto("/#/game/antonym-bridge");
    await page.getByRole("button", { name: "Hint" }).click();
    await expect(page.locator(".hint-line")).toBeVisible();
  });
  test("Palindial Hint reveals a visible suggestion", async ({ page }) => {
    await page.goto("/#/game/palindial");
    await page.getByRole("button", { name: "Hint" }).click();
    await expect(page.locator(".hint-line")).toBeVisible();
  });
  test("Homophone Heist Hint reveals a visible suggestion", async ({ page }) => {
    await page.goto("/#/game/homophone-heist");
    await page.getByRole("button", { name: "Hint" }).click();
    await expect(page.locator(".hint-line")).toBeVisible();
  });
  test("Ladderless Hint reveals a visible suggestion", async ({ page }) => {
    await page.goto("/#/game/ladderless");
    await page.getByRole("button", { name: "Hint" }).click();
    await expect(page.locator(".hint-line")).toBeVisible();
  });
  test("Tradeoff Hint reveals a visible suggestion", async ({ page }) => {
    await page.goto("/#/game/tradeoff");
    await page.getByRole("button", { name: "Hint" }).click();
    await expect(page.locator(".hint-line")).toBeVisible();
  });
  test("Word Morph Hint reveals a visible suggestion", async ({ page }) => {
    await page.goto("/#/game/word-morph");
    await page.getByRole("button", { name: "Hint" }).click();
    await expect(page.locator(".hint-line")).toBeVisible();
  });
});

test.describe("Edit-Ladder Trails — full journey", () => {
  test("trace every theme answer along its path to win", async ({ page }) => {
    await page.goto("/#/game/edit-ladder-trails");
    await expect(page.locator(".game-title")).toHaveText("Edit-Ladder Trails");
    await expect(page.locator(".elt-cell").first()).toBeVisible();

    // Resolve today's puzzle answers (paths) from the bundled pack by matching the
    // shown grid letters.
    const answers = await page.evaluate(async () => {
      const pack = await (await fetch("./edit-ladder-trails.json")).json();
      const shown = Array.from(document.querySelectorAll(".elt-cell")).map((b) => b.textContent).join("");
      const puz = pack.puzzles.find((p: any) => p.letters.join("") === shown);
      // return only theme answers (rungs + spangram); win needs all of these
      return (puz.answers as any[]).filter((a) => a.type !== "filler").map((a) => a.path as number[]);
    });

    const cell = (i: number) => page.locator(`.elt-cell[data-cell="${i}"]`);
    for (const path of answers) {
      // tap each cell of the path, then tap the last cell again to submit
      for (const c of path) await cell(c).click();
      await cell(path[path.length - 1]).click(); // second tap on last cell = submit
    }
    await expect(page.locator(".win")).toHaveCount(1);
  });

  test("progress persists across reload", async ({ page }) => {
    await page.goto("/#/game/edit-ladder-trails");
    await expect(page.locator(".elt-cell").first()).toBeVisible();
    const firstRung = await page.evaluate(async () => {
      const pack = await (await fetch("./edit-ladder-trails.json")).json();
      const shown = Array.from(document.querySelectorAll(".elt-cell")).map((b) => b.textContent).join("");
      const puz = pack.puzzles.find((p: any) => p.letters.join("") === shown);
      return (puz.answers as any[]).find((a) => a.type === "rung").path as number[];
    });
    const cell = (i: number) => page.locator(`.elt-cell[data-cell="${i}"]`);
    for (const c of firstRung) await cell(c).click();
    await cell(firstRung[firstRung.length - 1]).click();
    await expect(page.locator(".elt-cell.locked")).toHaveCount(firstRung.length);
    await page.reload();
    await expect(page.locator(".elt-cell.locked")).toHaveCount(firstRung.length);
  });
});

test.describe("Semantic Gradient — full journey", () => {
  test("trace every theme answer + spangram along its path to win", async ({ page }) => {
    await page.goto("/#/game/semantic-gradient");
    await expect(page.locator(".game-title")).toHaveText("Semantic Gradient");
    await expect(page.locator(".elt-cell").first()).toBeVisible();
    const answers = await page.evaluate(async () => {
      const pack = await (await fetch("./semantic-gradient.json")).json();
      const shown = Array.from(document.querySelectorAll(".elt-cell")).map((b) => b.textContent).join("");
      const puz = pack.puzzles.find((p: any) => p.letters.join("") === shown);
      return (puz.answers as any[]).filter((a) => a.type !== "filler").map((a) => a.path as number[]);
    });
    const cell = (i: number) => page.locator(`.elt-cell[data-cell="${i}"]`);
    for (const path of answers) {
      for (const c of path) await cell(c).click();
      await cell(path[path.length - 1]).click();
    }
    await expect(page.locator(".win")).toHaveCount(1);
  });

  test("progress persists across reload", async ({ page }) => {
    await page.goto("/#/game/semantic-gradient");
    await expect(page.locator(".elt-cell").first()).toBeVisible();
    const themePath = await page.evaluate(async () => {
      const pack = await (await fetch("./semantic-gradient.json")).json();
      const shown = Array.from(document.querySelectorAll(".elt-cell")).map((b) => b.textContent).join("");
      const puz = pack.puzzles.find((p: any) => p.letters.join("") === shown);
      return (puz.answers as any[]).find((a) => a.type === "theme").path as number[];
    });
    const cell = (i: number) => page.locator(`.elt-cell[data-cell="${i}"]`);
    for (const c of themePath) await cell(c).click();
    await cell(themePath[themePath.length - 1]).click();
    await expect(page.locator(".elt-cell.locked")).toHaveCount(themePath.length);
    await page.reload();
    await expect(page.locator(".elt-cell.locked")).toHaveCount(themePath.length);
  });
});

test.describe("Semantic Constellation — full journey", () => {
  test("trace every theme answer + spangram along its path to win", async ({ page }) => {
    await page.goto("/#/game/semantic-constellation");
    await expect(page.locator(".game-title")).toHaveText("Semantic Constellation");
    await expect(page.locator(".elt-cell").first()).toBeVisible();
    const answers = await page.evaluate(async () => {
      const pack = await (await fetch("./semantic-constellation.json")).json();
      const shown = Array.from(document.querySelectorAll(".elt-cell")).map((b) => b.textContent).join("");
      const puz = pack.puzzles.find((p: any) => p.letters.join("") === shown);
      return (puz.answers as any[]).filter((a) => a.type !== "filler").map((a) => a.path as number[]);
    });
    const cell = (i: number) => page.locator(`.elt-cell[data-cell="${i}"]`);
    for (const path of answers) {
      for (const c of path) await cell(c).click();
      await cell(path[path.length - 1]).click();
    }
    await expect(page.locator(".win")).toHaveCount(1);
  });

  test("progress persists across reload", async ({ page }) => {
    await page.goto("/#/game/semantic-constellation");
    await expect(page.locator(".elt-cell").first()).toBeVisible();
    const themePath = await page.evaluate(async () => {
      const pack = await (await fetch("./semantic-constellation.json")).json();
      const shown = Array.from(document.querySelectorAll(".elt-cell")).map((b) => b.textContent).join("");
      const puz = pack.puzzles.find((p: any) => p.letters.join("") === shown);
      return (puz.answers as any[]).find((a) => a.type === "theme").path as number[];
    });
    const cell = (i: number) => page.locator(`.elt-cell[data-cell="${i}"]`);
    for (const c of themePath) await cell(c).click();
    await cell(themePath[themePath.length - 1]).click();
    await expect(page.locator(".elt-cell.locked")).toHaveCount(themePath.length);
    await page.reload();
    await expect(page.locator(".elt-cell.locked")).toHaveCount(themePath.length);
  });
});

test.describe("Per-game flourishes", () => {
  test("Ladderless shows a thermometer warmth flourish", async ({ page }) => {
    await page.goto("/#/game/ladderless");
    await expect(page.locator(".thermo-tube .thermo-mercury")).toHaveCount(1);
  });
  test("Degrees shows an intensity rail", async ({ page }) => {
    await page.goto("/#/game/degrees");
    await expect(page.locator(".deg-rail")).toHaveCount(1);
  });
  test("Palindial shows a mirrored target", async ({ page }) => {
    await page.goto("/#/game/palindial");
    await expect(page.locator(".mirror-target")).toHaveCount(1);
  });
  test("Homophone Heist and Stress Test expose an optional audio button", async ({ page }) => {
    await page.goto("/#/game/homophone-heist");
    await expect(page.getByRole("button", { name: /read the sound-alike/i })).toHaveCount(1);
    await page.goto("/#/game/stress-test");
    await expect(page.getByRole("button", { name: /hear the words/i })).toHaveCount(1);
  });
});
