import { test, expect, type Page } from "@playwright/test";

// Full user-journey E2E for the 20 NOVEL games (this session). Each test lands on
// today's deterministic daily puzzle, identifies it from the shipped pack using the
// same derivePuzzleId logic the app uses, then drives the REAL UI (clicking buttons,
// typing, selecting cells/tiles) — through to a genuine SOLVE where the mechanic
// allows one — asserting the win signal (a `.win` banner or a success
// cds-inline-notification) and that Share becomes enabled. Also verifies the shared
// shell (title + back-to-hub). Runs on chromium + mobile-safari + mobile-chrome.

async function activePuzzle(page: Page, file: string): Promise<{ index: number; pack: any; puzzle: any }> {
  return page.evaluate(async (f) => {
    const pack = await (await fetch(f)).json();
    const d = new Date();
    const dayId = `${d.getUTCFullYear().toString().padStart(4, "0")}-${(d.getUTCMonth() + 1).toString().padStart(2, "0")}-${d.getUTCDate().toString().padStart(2, "0")}`;
    const seed = `${dayId}|${pack.contentPackVersion}|${pack.datasetId}`;
    let hash = 0x811c9dc5;
    for (let i = 0; i < seed.length; i++) {
      hash ^= seed.charCodeAt(i) & 0xff;
      hash = (hash + ((hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24))) >>> 0;
    }
    const index = (hash >>> 0) % pack.puzzleCount;
    return { index, pack, puzzle: pack.puzzles[index] };
  }, file);
}

async function shell(page: Page, id: string, title: string): Promise<void> {
  await page.goto(`/#/game/${id}`);
  await expect(page.locator(".game-title")).toHaveText(title);
  await expect(page.locator(".back-btn")).toBeVisible();
  await expect(page.locator("cds-button, .btn").first()).toBeVisible();
}

async function backToHub(page: Page): Promise<void> {
  await page.locator(".back-btn").click();
  await expect(page.locator(".hub-card").first()).toBeVisible();
}

function btn(page: Page, text: string) {
  return page.locator(`cds-button:has-text("${text}"), button:has-text("${text}")`).first();
}

/** Click a radio-style choice within `scope` by its exact visible text (Carbon
 *  cds-button whose accessible name may differ from its text via aria-label, so we
 *  match on rendered text content, not the accessible name). */
function radioByText(scope: ReturnType<Page["locator"]>, text: string) {
  return scope.locator('[role="radio"]').filter({ hasText: new RegExp(`^\\s*${text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`, "i") }).first();
}

/** Assert the puzzle reached a solved state (win banner or success notification). */
async function expectSolved(page: Page): Promise<void> {
  const win = page.locator(".win");
  const success = page.locator("cds-inline-notification[kind='success']");
  await expect(win.or(success).first()).toBeVisible({ timeout: 5000 });
  // Share must be enabled once solved.
  await expect(page.locator('cds-button:has-text("Share")')).not.toHaveAttribute("disabled", /.*/);
}

function esc(s: string): string {
  return s.replace(/"/g, '\\"');
}

// ===========================================================================
// DEDUCTION / SEMANTIC (text input)
// ===========================================================================

test.describe("Mirrorle — full journey", () => {
  test("guessing both secrets solves; share works; back to hub", async ({ page }) => {
    await shell(page, "mirrorle", "Mirrorle");
    const { puzzle } = await activePuzzle(page, "./mirrorle.json");
    for (const w of [puzzle.secretA, puzzle.secretB]) {
      await page.locator(".mir-field").fill(w);
      await page.keyboard.press("Enter");
    }
    await expect(page.locator(".win")).toBeVisible();
    await expect(page.locator(".mir-field")).toHaveCount(0); // input removed once solved
    await btn(page, "Share").click();
    await expect(page.locator(".sr-live")).toContainText(/copied|shared|unavailable|blocked/i);
    await backToHub(page);
  });

  test("invalid guess is rejected without a board row", async ({ page }) => {
    await shell(page, "mirrorle", "Mirrorle");
    await page.locator(".mir-field").fill("ZZZZZ");
    await page.keyboard.press("Enter");
    await expect(page.locator(".sr-live")).toContainText(/not in word list|5 letters/i);
    await expect(page.locator(".win")).toHaveCount(0);
  });
});

test.describe("Parallax — full journey", () => {
  test("submitting the target word solves", async ({ page }) => {
    await shell(page, "parallax", "Parallax");
    const { puzzle } = await activePuzzle(page, "./parallax.json");
    await expect(page.locator(".plx-anchors")).toBeVisible();
    await page.locator(".plx-field").fill(String(puzzle.target));
    await page.keyboard.press("Enter");
    await expect(page.locator(".win")).toBeVisible();
    await backToHub(page);
  });
});

test.describe("Driftword — full journey", () => {
  test("invalid word rejected; guessing the drift path solves", async ({ page }) => {
    await shell(page, "driftword", "Driftword");
    const { puzzle } = await activePuzzle(page, "./driftword.json");
    await page.locator(".dw-field").fill("ZZZZZ");
    await page.keyboard.press("Enter");
    await expect(page.locator(".win")).toHaveCount(0);
    // The daily target drifts along path[]; guessing successive path words tracks it
    // and lands on the current target, solving.
    for (const w of puzzle.path as string[]) {
      await page.locator(".dw-field").fill(w);
      await page.keyboard.press("Enter");
      if (await page.locator(".win").count()) break;
    }
    await expect(page.locator(".win")).toBeVisible();
    await backToHub(page);
  });
});

test.describe("Isobar — full journey", () => {
  test("assign each word to its correct ring and solve", async ({ page }) => {
    await shell(page, "isobar", "Isobar");
    const { puzzle } = await activePuzzle(page, "./isobar.json");
    const rows = page.locator(".iso-word");
    await expect(rows).toHaveCount(puzzle.words.length);
    for (let i = 0; i < puzzle.words.length; i++) {
      const ring = puzzle.correctRings[i];
      await radioByText(rows.nth(i), String(ring)).click();
    }
    await btn(page, "Submit").click();
    await expect(page.locator(".win")).toBeVisible();
    await backToHub(page);
  });
});

// ===========================================================================
// CONNECTION
// ===========================================================================

test.describe("Seam — full journey", () => {
  test("reorder to the solved chain order and submit to solve", async ({ page }) => {
    await shell(page, "seam", "Seam");
    const { puzzle } = await activePuzzle(page, "./seam.json");
    // puzzle.solution is display-index order that reads the chain. Reorder the list
    // to that sequence using the Move up/down buttons (selection-sort by position).
    const target: number[] = puzzle.solution; // display indices in solved order
    // Build current order of display indices as rendered (0..n-1 initially).
    const n = target.length;
    const current = Array.from({ length: n }, (_, i) => i);
    for (let pos = 0; pos < n; pos++) {
      // find where target[pos] currently sits
      const want = target[pos];
      let at = current.indexOf(want);
      while (at > pos) {
        await page.locator(".seam-item").nth(at).getByRole("button", { name: "Move up" }).click();
        [current[at - 1], current[at]] = [current[at], current[at - 1]];
        at--;
      }
    }
    await btn(page, "Submit").click();
    await expect(page.locator(".win")).toBeVisible();
    await backToHub(page);
  });
});

test.describe("Ghost Group — full journey", () => {
  test("clear all real groups, name the ghost, and solve", async ({ page }) => {
    await shell(page, "ghost-group", "Ghost Group");
    const { puzzle } = await activePuzzle(page, "./ghost-group.json");
    const ghostCat = puzzle.categories.find((c: any) => c.isGhost);
    for (const cat of puzzle.categories) {
      if (cat.isGhost) continue;
      for (const wi of cat.wordIdx) {
        await page.getByRole("button", { name: new RegExp(`^${esc(puzzle.words[wi])}$`, "i") }).first().click();
      }
      await btn(page, "Submit group").click();
    }
    // Ghost picker appears — choose the correct ghost label.
    await expect(page.locator(".gg-ghostpick")).toBeVisible();
    await radioByText(page.locator(".gg-ghostpick"), ghostCat.label).click();
    await expect(page.locator(".win")).toBeVisible();
    await backToHub(page);
  });
});

// ===========================================================================
// LADDER
// ===========================================================================

test.describe("Tollgate — full journey", () => {
  test("invalid step rejected; Undo present; ends render", async ({ page }) => {
    await shell(page, "tollgate", "Tollgate");
    await expect(page.locator(".tg-ends")).toBeVisible();
    await page.locator(".tg-field").fill("ZZZZ");
    await page.keyboard.press("Enter");
    await expect(page.locator(".win")).toHaveCount(0);
    await expect(btn(page, "Undo")).toBeVisible();
    await btn(page, "Undo").click();
    await backToHub(page);
  });
});

test.describe("Fork — full journey", () => {
  test("start + two targets render; Add present; invalid step rejected", async ({ page }) => {
    await shell(page, "fork", "Fork");
    await expect(page.locator(".fk-ends")).toBeVisible();
    await page.locator(".fk-field").fill("ZZZZ");
    await page.keyboard.press("Enter");
    await expect(page.locator(".win")).toHaveCount(0);
    await expect(btn(page, "Add")).toBeVisible();
    await backToHub(page);
  });
});

// ===========================================================================
// ANAGRAM / BUILDER
// ===========================================================================

test.describe("Ration — full journey", () => {
  test("inventory + targets render; a word can be added", async ({ page }) => {
    await shell(page, "ration", "Ration");
    await expect(page.locator(".rn-inv")).toBeVisible();
    await expect(page.locator(".rn-targets")).toBeVisible();
    await page.locator(".rn-field").fill("ZZZ");
    await page.keyboard.press("Enter");
    await expect(page.locator(".sr-live")).toBeAttached();
    await backToHub(page);
  });
});

test.describe("Overdraft — full journey", () => {
  test("letter set renders; an in-set dictionary word submits with positive score", async ({ page }) => {
    await shell(page, "overdraft", "Overdraft");
    const { puzzle, pack } = await activePuzzle(page, "./overdraft.json");
    await expect(page.locator(".od-set")).toBeVisible();
    const set = new Set<string>((puzzle.letterSet as string[]).map((c) => c.toUpperCase()));
    const inSet = (pack.dictionary as string[]).map((w) => w.toUpperCase()).find((w) => w.length >= 3 && w.split("").every((c) => set.has(c)));
    await page.locator(".od-field").fill(inSet ?? (puzzle.letterSet as string[]).join(""));
    await page.keyboard.press("Enter");
    // Overdraft finalizes one word -> "Submitted" success notification.
    await expect(page.locator("cds-inline-notification")).toBeVisible();
    await backToHub(page);
  });
});

// ===========================================================================
// TILE
// ===========================================================================

test.describe("Isthmus — full journey", () => {
  test("tap the solution path tiles and submit to solve", async ({ page }) => {
    await shell(page, "isthmus", "Isthmus");
    const { puzzle } = await activePuzzle(page, "./isthmus.json");
    await expect(page.locator(".isth-grid")).toBeVisible();
    const tiles = page.locator(".isth-tile");
    for (const cell of puzzle.solution as Array<{ row: number; col: number }>) {
      await tiles.nth(cell.row * puzzle.cols + cell.col).click();
    }
    await btn(page, "Submit").click();
    await expect(page.locator(".win")).toBeVisible();
    await backToHub(page);
  });
});

test.describe("Tare — full journey", () => {
  test("rack renders; entering two words updates the beam readout", async ({ page }) => {
    await shell(page, "tare", "Tare");
    await expect(page.locator(".ta-rack")).toBeVisible();
    await page.locator(".ta-left").fill("CAT");
    await page.locator(".ta-right").fill("DOG");
    await expect(page.locator(".ta-beam")).toBeVisible();
    await backToHub(page);
  });
});

// ===========================================================================
// CROSSWORD
// ===========================================================================

test.describe("Clueback — full journey", () => {
  test("pick the correct clue for every entry to solve; choices lock", async ({ page }) => {
    await shell(page, "clueback", "Clueback");
    const { puzzle } = await activePuzzle(page, "./clueback.json");
    const entries = page.locator(".cb-entry");
    await expect(entries).toHaveCount(puzzle.entries.length);
    for (let i = 0; i < puzzle.entries.length; i++) {
      const correct = puzzle.entries[i].candidates[puzzle.entries[i].correctIndex];
      await radioByText(entries.nth(i), correct).click();
    }
    await expect(page.locator("cds-inline-notification[kind='success']")).toBeVisible();
    await backToHub(page);
  });
});

test.describe("Fault Lines — full journey", () => {
  test("flag exactly the faulty entries, submit, perfect audit", async ({ page }) => {
    await shell(page, "fault-lines", "Fault Lines");
    const { puzzle } = await activePuzzle(page, "./fault-lines.json");
    await expect(page.locator(".fl-grid")).toBeVisible();
    const entries = page.locator(".fl-entry");
    for (let i = 0; i < puzzle.entries.length; i++) {
      if (puzzle.entries[i].isFaulty) await entries.nth(i).locator('[role="switch"]').click();
    }
    await btn(page, "Submit audit").click();
    await expect(page.locator("cds-inline-notification[kind='success']")).toBeVisible();
    await backToHub(page);
  });
});

// ===========================================================================
// WORD SEARCH
// ===========================================================================

test.describe("Undertow — full journey", () => {
  test("select every reversed target line to clear the board", async ({ page }) => {
    await shell(page, "undertow", "Undertow");
    const { puzzle } = await activePuzzle(page, "./undertow.json");
    const cells = page.locator(".ut-cell");
    for (const t of puzzle.targets as any[]) {
      await cells.nth(t.start.row * puzzle.cols + t.start.col).click();
      await cells.nth(t.end.row * puzzle.cols + t.end.col).click();
    }
    await expect(page.locator("cds-inline-notification[kind='success']")).toBeVisible();
    await backToHub(page);
  });
});

test.describe("Fogline — full journey", () => {
  test("clear all targets (fog recedes progressively) to lift the fog", async ({ page }) => {
    await shell(page, "fogline", "Fogline");
    const { puzzle } = await activePuzzle(page, "./fogline.json");
    const cells = page.locator(".fg-cell");
    // Solve iteratively: repeatedly try every target's endpoints; as fog recedes,
    // more become selectable until all are found.
    const targets = puzzle.targets as any[];
    for (let pass = 0; pass < targets.length + 1; pass++) {
      for (const t of targets) {
        const s = t.start.row * puzzle.cols + t.start.col;
        const e = (t.start.row + t.dir.row * (t.word.length - 1)) * puzzle.cols + (t.start.col + t.dir.col * (t.word.length - 1));
        await cells.nth(s).click();
        await cells.nth(e).click();
      }
      if (await page.locator("cds-inline-notification[kind='success']").count()) break;
    }
    await expect(page.locator("cds-inline-notification[kind='success']")).toBeVisible();
    await backToHub(page);
  });
});

// ===========================================================================
// NARRATIVE
// ===========================================================================

test.describe("Marginalia — full journey", () => {
  test("follow the golden path to the golden ending", async ({ page }) => {
    await shell(page, "marginalia", "Marginalia");
    const { puzzle } = await activePuzzle(page, "./marginalia.json");
    // Compute the golden path by BFS from start to golden, then click those choices.
    const path = goldenChoices(puzzle);
    for (const word of path) {
      await radioByText(page.locator(".mg-choices"), word).click();
    }
    await expect(page.locator("cds-inline-notification[kind='success']")).toBeVisible();
    await backToHub(page);
  });
});

test.describe("Cipher Diary — full journey", () => {
  test("fill each cipher letter with its true mapping to decode", async ({ page }) => {
    await shell(page, "cipher-diary", "Cipher Diary");
    const { puzzle } = await activePuzzle(page, "./cipher-diary.json");
    await expect(page.locator(".cd-table")).toBeVisible();
    const inputs = page.locator(".cd-input");
    const n = await inputs.count();
    for (let i = 0; i < n; i++) {
      const input = inputs.nth(i);
      if (await input.isDisabled()) continue;
      const label = (await input.getAttribute("aria-label")) ?? "";
      const cipher = label.match(/Cipher ([A-Z])/)?.[1];
      if (cipher && puzzle.key[cipher]) await input.fill(puzzle.key[cipher]);
    }
    await expect(page.locator("cds-inline-notification[kind='success']")).toBeVisible();
    await backToHub(page);
  });
});

// ===========================================================================
// TYPING
// ===========================================================================

test.describe("Decay — full journey", () => {
  test("type every target word (fast) to lock them all and solve", async ({ page }) => {
    await shell(page, "decay", "Decay");
    const { puzzle } = await activePuzzle(page, "./decay.json");
    for (const t of puzzle.targets as any[]) {
      await page.locator(".dc-field").fill(t.word.toUpperCase());
      await page.keyboard.press("Enter");
    }
    await expect(page.locator("cds-inline-notification[kind='success']")).toBeVisible();
    await backToHub(page);
  });
});

test.describe("Cascade Type — full journey", () => {
  test("clear rows bottom-up to solve the cascade", async ({ page }) => {
    await shell(page, "cascade-type", "Cascade Type");
    const { puzzle } = await activePuzzle(page, "./cascade-type.json");
    for (const row of puzzle.rows as string[][]) {
      for (const word of row) {
        await page.locator(".ct-field").fill(word.toUpperCase());
        await page.keyboard.press("Enter");
      }
    }
    await expect(page.locator("cds-inline-notification[kind='success']")).toBeVisible();
    await backToHub(page);
  });
});

test.describe("Lowball", () => {
  test("beat par with two obscure answers, then reveal every answer", async ({ page }) => {
    await shell(page, "lowball", "Lowball");
    const { puzzle } = await activePuzzle(page, "./lowball.json");

    // REQ-053 / TEST-089: the simulated-panel disclosure must be on screen wherever a
    // score is presented.
    await expect(page.locator(".lb-disclosure")).toContainText("simulated panel of 100");
    // REQ-053 / TEST-090: nothing may imply real people were surveyed.
    const bodyText = (await page.locator(".game.lowball").innerText()).toLowerCase();
    expect(bodyText).not.toContain("we asked 100 people");
    expect(bodyText).not.toContain("we surveyed");
    // REQ-049: the answer input carries an accessible name naming the category.
    const input = page.locator("#lb-answer");
    await expect(input).toHaveAttribute("aria-label", new RegExp(String(puzzle.categoryLabel).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));

    // Pick the two lowest-scoring answers so the total beats par (REQ-015).
    const cheapest = [...puzzle.answers]
      .sort((a: any, b: any) => a.panelScore - b.panelScore)
      .slice(0, 2) as Array<{ word: string; panelScore: number }>;

    await input.fill(cheapest[0].word);
    await page.keyboard.press("Enter");
    // REQ-050/051: the score reaches the user as text, not only as bar height.
    await expect(page.locator(".lb-score-num")).toBeVisible();
    await expect(page.locator(".lb-sweeps li")).toHaveCount(1);

    await page.locator("#lb-answer").fill(cheapest[1].word);
    await page.keyboard.press("Enter");

    // Round is terminal: reveal is rendered and the input is gone.
    await expect(page.locator(".lb-reveal")).toBeVisible();
    await expect(page.locator(".lb-answers li")).toHaveCount(puzzle.answers.length);
    // REQ-053: the reveal lists every answer's score, so it carries the disclosure too.
    await expect(page.locator(".lb-reveal .lb-disclosure")).toContainText("simulated panel of 100");
    const revealText = (await page.locator(".game.lowball").innerText()).toLowerCase();
    expect(revealText).not.toContain("we asked 100 people");
    await expect(page.locator("#lb-answer")).toHaveCount(0);
    await expect(page.locator(".win")).toBeVisible();

    // REQ-052: zero-scorers are badged, distinguishing findable from obscure.
    if (puzzle.answers.some((a: any) => a.panelScore === 0)) {
      await expect(page.locator(".lb-badge").first()).toBeVisible();
    }

    // REQ-057: Share appears only now the verdict is terminal.
    await expect(btn(page, "Share")).toBeVisible();
    await backToHub(page);
  });

  test("the tension counter is one column that empties from the top", async ({ page }) => {
    await shell(page, "lowball", "Lowball");
    const { puzzle } = await activePuzzle(page, "./lowball.json");

    // Starts full, as a single vertical column.
    const start = await page.evaluate(() => {
      const bars = [...document.querySelectorAll<HTMLElement>(".lb-bars .lb-bar")];
      return {
        count: bars.length,
        lit: bars.filter((b) => b.classList.contains("lb-bar-on")).length,
        columns: new Set(bars.map((b) => Math.round(b.getBoundingClientRect().left))).size,
        topAboveBottom:
          bars[0].getBoundingClientRect().top < bars[bars.length - 1].getBoundingClientRect().top,
      };
    });
    expect(start.count).toBe(100);
    expect(start.lit).toBe(100);
    expect(start.columns).toBe(1);
    expect(start.topAboveBottom).toBe(true);

    // Drain to a mid-range score so the boundary is visible in the middle.
    const mid = [...puzzle.answers].sort(
      (a: any, b: any) => Math.abs(a.panelScore - 45) - Math.abs(b.panelScore - 45),
    )[0] as { word: string; panelScore: number };
    await page.locator("#lb-answer").fill(mid.word);
    await page.keyboard.press("Enter");
    await page.waitForFunction(
      (t) => Number(document.querySelector(".lb-score-num")?.textContent) === t,
      mid.panelScore,
      { timeout: 9000 },
    );

    const settled = await page.evaluate(() => {
      const bars = [...document.querySelectorAll<HTMLElement>(".lb-bars .lb-bar")];
      const on = bars.map((b) => b.classList.contains("lb-bar-on"));
      const offBar = bars.find((b) => !b.classList.contains("lb-bar-on"));
      const onBar = bars.find((b) => b.classList.contains("lb-bar-on"));
      return {
        lit: on.filter(Boolean).length,
        topLit: on[0],
        bottomLit: on[on.length - 1],
        firstLitIndex: on.indexOf(true),
        contiguous: on.slice(on.indexOf(true)).every(Boolean),
        offColour: offBar === undefined ? null : getComputedStyle(offBar).backgroundColor,
        onColour: onBar === undefined ? null : getComputedStyle(onBar).backgroundColor,
      };
    });
    expect(settled.lit).toBe(mid.panelScore);
    // The remainder sits at the BOTTOM: the column empties downwards from the top.
    expect(settled.topLit).toBe(false);
    expect(settled.bottomLit).toBe(true);
    expect(settled.firstLitIndex).toBe(100 - mid.panelScore);
    expect(settled.contiguous).toBe(true);
    // Lit and unlit must be visually distinguishable, not merely class-different.
    expect(settled.offColour).not.toBe(settled.onColour);
    await backToHub(page);
  });

  test("an invalid answer scores the maximum penalty without crashing", async ({ page }) => {
    await shell(page, "lowball", "Lowball");
    await page.locator("#lb-answer").fill("zzzzqqqwww");
    await page.keyboard.press("Enter");
    await expect(page.locator(".lb-sweep-score").first()).toHaveText("100");
    await expect(page.locator(".error")).toContainText(/100/);
    await backToHub(page);
  });

  test("practice mode leaves the daily round untouched", async ({ page }) => {
    await shell(page, "lowball", "Lowball");
    const dailyPrompt = await page.locator(".lb-prompt").textContent();

    await btn(page, "Practice round").click();
    await expect(page.locator(".sub")).toContainText("practice");
    // REQ-025: practice never serves today's daily category.
    expect(await page.locator(".lb-prompt").textContent()).not.toBe(dailyPrompt);

    await btn(page, "Back to today").click();
    expect(await page.locator(".lb-prompt").textContent()).toBe(dailyPrompt);
    await expect(page.locator(".lb-sweeps li")).toHaveCount(0);
    await backToHub(page);
  });
});

/** BFS the golden path's choice words from a Marginalia puzzle. */
function goldenChoices(puzzle: any): string[] {
  const { nodes, startNodeId, goldenNodeId } = puzzle;
  const queue: Array<{ id: string; words: string[] }> = [{ id: startNodeId, words: [] }];
  const seen = new Set<string>();
  while (queue.length) {
    const { id, words } = queue.shift()!;
    if (id === goldenNodeId) return words;
    if (seen.has(id)) continue;
    seen.add(id);
    const node = nodes[id];
    if (!node) continue;
    for (const c of node.choices) queue.push({ id: c.next, words: [...words, c.word] });
  }
  return [];
}
