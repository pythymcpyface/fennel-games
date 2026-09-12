import { test, expect } from "@playwright/test";

// Hub E2E: selection screen, navigation into each game, back, and shared dashboard.

test.describe("Fennel Games hub", () => {
  test("shows the selection grid with all games", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Fennel Games" })).toBeVisible();
    // Count is data-driven from the registry; assert a healthy floor + a consistent board total.
    const cardCount = await page.locator(".hub-card").count();
    expect(cardCount).toBeGreaterThanOrEqual(51);
    await expect(page.locator(".hub-board")).toContainText(new RegExp(`of ${cardCount} solved today`));
  });

  test("opens each game and returns to the hub", async ({ page }) => {
    const titles = ["Ladderless", "Overlap", "Sever", "Odd Sense", "Rhyme Chain", "Hidden Middle", "Tradeoff"];
    await page.goto("/");
    const total = await page.locator(".hub-card").count();
    for (let i = 0; i < titles.length; i++) {
      await page.goto("/");
      await page.locator(".hub-card").nth(i).click();
      await expect(page.locator(".game-title")).toHaveText(titles[i]);
      await page.locator(".back-btn").click();
      await expect(page.locator(".hub-card")).toHaveCount(total);
    }
  });

  test("Rhyme Chain plays inside the hub: correct answer extends the chain", async ({ page }) => {
    await page.goto("/#/game/rhyme-chain");
    await expect(page.locator(".game-title")).toHaveText("Rhyme Chain");
    // Read today's first answer from the bundled pack via the seed.
    const answer = await page.evaluate(async () => {
      const r = await fetch("./rhyme-chain.json");
      const pack = await r.json();
      // find which puzzle is today's by matching the shown seed
      const seed = document.querySelector(".chain .seed")?.textContent;
      const puz = pack.puzzles.find((p: { seedWord: string }) => p.seedWord === seed);
      return puz.slots[0].answer as string;
    });
    await page.fill("#guess-input", answer);
    await page.getByRole("button", { name: "Enter" }).click();
    await expect(page.locator(".chain strong")).toHaveCount(1);
  });

  test("deep-links to a game via hash route", async ({ page }) => {
    await page.goto("/#/game/sever");
    await expect(page.locator(".game-title")).toHaveText("Sever");
    await expect(page.locator(".strip")).toBeVisible();
  });

  test("Ladderless plays inside the hub and updates the shared board", async ({ page }) => {
    await page.goto("/#/game/ladderless");
    await expect(page.locator(".start strong")).toHaveText(/\w+/);
    const words = await page.evaluate(async () => {
      const r = await fetch("./ladderless.json");
      const p = await r.json();
      return p.vocabulary as string[];
    });
    await page.fill("#guess-input", words[0]);
    await page.getByRole("button", { name: "Guess" }).click();
    await expect(page.locator(".guesses li")).toHaveCount(1);
    // returning to the hub reflects "in progress"
    await page.locator(".back-btn").click();
    await expect(page.locator(".hub-card").first().locator(".hub-status")).toContainText(/progress|solved/i);
  });

  test("Odd Sense plays inside the hub (shared plumbing)", async ({ page }) => {
    await page.goto("/#/game/odd-sense");
    await expect(page.locator(".word")).toHaveCount(5);
    await page.locator(".word").first().click();
    await expect(page.locator(".word.selected")).toHaveCount(1);
  });

  test("Hidden Middle plays inside the hub: correct substring solves", async ({ page }) => {
    await page.goto("/#/game/hidden-middle");
    await expect(page.locator(".game-title")).toHaveText("Hidden Middle");
    const answer = await page.evaluate(async () => {
      const r = await fetch("./hidden-middle.json");
      const pack = await r.json();
      const carrier = document.querySelector(".carrier")?.textContent;
      const puz = pack.puzzles.find((p: { carrierWord: string }) => p.carrierWord === carrier);
      return puz.answerWord as string;
    });
    await page.fill("#guess-input", answer);
    await page.getByRole("button", { name: "Guess" }).click();
    await expect(page.locator(".win")).toHaveCount(1);
  });

  test("Tradeoff plays inside the hub: a valid swap updates the path", async ({ page }) => {
    await page.goto("/#/game/tradeoff");
    await expect(page.locator(".game-title")).toHaveText("Tradeoff");
    // Find a valid neighbor of the current word from the bundled pack.
    const next = await page.evaluate(async () => {
      const r = await fetch("./tradeoff.json");
      const pack = await r.json();
      const cur = document.querySelector(".score-line .cur")?.textContent;
      const puz = pack.puzzles.find((p: { startWord: string }) => p.startWord === cur);
      return (puz.neighbors[cur] as string[])[0];
    });
    await page.fill("#guess-input", next);
    await page.getByRole("button", { name: "Swap" }).click();
    await expect(page.locator(".path .cur")).toHaveText(next);
  });

  test("Degrees plays inside the hub: shows five orderable items and a hint locks one", async ({ page }) => {
    await page.goto("/#/game/degrees");
    await expect(page.locator(".game-title")).toHaveText("Degrees");
    await expect(page.locator(".deg-item")).toHaveCount(5);
    await page.getByRole("button", { name: "Hint" }).click();
    await expect(page.locator(".deg-item.locked")).toHaveCount(1);
  });

  test("Vowel Ghost plays inside the hub: solving a skeleton fills the word", async ({ page }) => {
    await page.goto("/#/game/vowel-ghost");
    await expect(page.locator(".game-title")).toHaveText("Vowel Ghost");
    await expect(page.locator(".vg-skel")).toHaveCount(5);
    const answer = await page.evaluate(async () => {
      const r = await fetch("./vowel-ghost.json");
      const pack = await r.json();
      const firstSkel = document.querySelector(".vg-skel")?.textContent;
      const puz = pack.puzzles.find((p: { skeletons: string[] }) => p.skeletons[0] === firstSkel);
      return puz.words[0] as string;
    });
    await page.locator(".vg-skel").first().click();
    await page.fill("#guess-input", answer);
    await page.getByRole("button", { name: "Enter" }).click();
    await expect(page.locator(".vg-skel.solved")).toHaveCount(1);
  });

  test("Numeronym plays inside the hub: expanding a clue solves it", async ({ page }) => {
    await page.goto("/#/game/numeronym");
    await expect(page.locator(".game-title")).toHaveText("Numeronym");
    await expect(page.locator(".num-clue")).toHaveCount(5);
    const answer = await page.evaluate(async () => {
      const r = await fetch("./numeronym.json");
      const pack = await r.json();
      const firstClue = document.querySelector(".num-clue")?.textContent;
      const puz = pack.puzzles.find((p: { clues: string[] }) => p.clues[0] === firstClue);
      return puz.answers[0] as string;
    });
    await page.locator(".num-clue").first().click();
    await page.fill("#guess-input", answer);
    await page.getByRole("button", { name: "Enter" }).click();
    await expect(page.locator(".num-clue.solved")).toHaveCount(1);
  });

  test("Kerning plays inside the hub: re-spacing to reading B wins", async ({ page }) => {
    await page.goto("/#/game/kerning");
    await expect(page.locator(".game-title")).toHaveText("Kerning");
    // Read today's target mask and toggle gaps to match it.
    const target = await page.evaluate(async () => {
      const r = await fetch("./kerning.json");
      const pack = await r.json();
      const run = document.querySelectorAll(".letter");
      const letterRun = Array.from(run).map((n) => n.textContent).join("");
      const puz = pack.puzzles.find((p: { letterRun: string }) => p.letterRun === letterRun);
      return puz.targetMask as boolean[];
    });
    // Set each gap to the target: click gaps whose current state differs.
    const gaps = page.locator(".gap");
    for (let i = 0; i < target.length; i++) {
      const on = (await gaps.nth(i).textContent()) === "|";
      if (on !== target[i]) await gaps.nth(i).click();
    }
    await page.getByRole("button", { name: "Submit" }).click();
    await expect(page.locator(".win")).toHaveCount(1);
  });

  test("Acronym Attack plays inside the hub: a valid expansion wins", async ({ page }) => {
    await page.goto("/#/game/acronym-attack");
    await expect(page.locator(".game-title")).toHaveText("Acronym Attack");
    const { acronym, dict } = await page.evaluate(async () => {
      const r = await fetch("./acronym-attack.json");
      const pack = await r.json();
      const letters = Array.from(document.querySelectorAll(".aa-letter")).map((n) => n.textContent);
      const ac = letters.join("");
      const byInitial: Record<string, string> = {};
      for (const w of pack.dictionary as string[]) { const c = w[0]; if (w.length >= 2 && !byInitial[c]) byInitial[c] = w; }
      return { acronym: ac, dict: byInitial };
    });
    const inputs = page.locator(".aa-row .text-input");
    for (let i = 0; i < acronym.length; i++) await inputs.nth(i).fill(dict[acronym[i]]);
    await page.getByRole("button", { name: "Submit" }).click();
    await expect(page.locator(".win")).toHaveCount(1);
  });

  test("Borrowed plays inside the hub: matching all languages wins", async ({ page }) => {
    await page.goto("/#/game/borrowed");
    await expect(page.locator(".game-title")).toHaveText("Borrowed");
    await expect(page.locator(".match-row")).toHaveCount(5);
    const answers = await page.evaluate(async () => {
      const r = await fetch("./borrowed.json");
      const pack = await r.json();
      const words = Array.from(document.querySelectorAll(".match-word")).map((n) => n.textContent);
      const puz = pack.puzzles.find((p: { words: string[] }) => p.words.join() === words.join());
      return puz.answers as string[];
    });
    const selects = page.locator(".match-select");
    for (let i = 0; i < answers.length; i++) await selects.nth(i).selectOption(answers[i]);
    await page.getByRole("button", { name: "Check" }).click();
    await expect(page.locator(".win")).toHaveCount(1);
  });

  test("Loan Ledger plays inside the hub: matching all meanings wins", async ({ page }) => {
    await page.goto("/#/game/loan-ledger");
    await expect(page.locator(".game-title")).toHaveText("Loan Ledger");
    await expect(page.locator(".ledger-row")).toHaveCount(5);
    const answers = await page.evaluate(async () => {
      const r = await fetch("./loan-ledger.json");
      const pack = await r.json();
      const words = Array.from(document.querySelectorAll(".ledger-row .match-word")).map((n) => n.textContent);
      const puz = pack.puzzles.find((p: { items: { word: string }[] }) => p.items.map((it) => it.word).join() === words.join());
      return puz.items.map((it: { answer: string }) => it.answer) as string[];
    });
    const selects = page.locator(".match-select");
    for (let i = 0; i < answers.length; i++) await selects.nth(i).selectOption(answers[i]);
    await page.getByRole("button", { name: "Check" }).click();
    await expect(page.locator(".win")).toHaveCount(1);
  });

  test("Stress Test plays inside the hub: marking all stresses wins", async ({ page }) => {
    await page.goto("/#/game/stress-test");
    await expect(page.locator(".game-title")).toHaveText("Stress Test");
    await expect(page.locator(".stress-row")).toHaveCount(5);
    const stresses = await page.evaluate(async () => {
      const r = await fetch("./stress-test.json");
      const pack = await r.json();
      const words = Array.from(document.querySelectorAll(".stress-row .syllables")).map((row) =>
        Array.from(row.querySelectorAll(".syl")).map((b) => b.textContent).join(""),
      );
      const puz = pack.puzzles.find((p: { items: { word: string }[] }) => p.items.map((it) => it.word).join() === words.join());
      return puz.items.map((it: { stressedIndex: number }) => it.stressedIndex) as number[];
    });
    const rows = page.locator(".stress-row");
    for (let i = 0; i < stresses.length; i++) {
      await rows.nth(i).locator(".syl").nth(stresses[i]).click();
    }
    await page.getByRole("button", { name: "Check" }).click();
    await expect(page.locator(".win")).toHaveCount(1);
  });

  test("Palindial plays inside the hub: morphing to the reverse twin wins", async ({ page }) => {
    await page.goto("/#/game/palindial");
    await expect(page.locator(".game-title")).toHaveText("Palindial");
    // Compute a shortest path from start to target using the bundled subgraph, then play it.
    const pathAfterStart = await page.evaluate(async () => {
      const r = await fetch("./palindial.json");
      const pack = await r.json();
      const cur = document.querySelector(".score-line .cur")?.textContent;
      const puz = pack.puzzles.find((p: { startWord: string }) => p.startWord === cur);
      const { startWord, targetWord, neighbors } = puz as { startWord: string; targetWord: string; neighbors: Record<string, string[]> };
      // BFS
      const prev = new Map<string, string>();
      const seen = new Set([startWord]);
      let frontier = [startWord];
      while (frontier.length) {
        const next: string[] = [];
        for (const w of frontier) for (const n of neighbors[w] ?? []) if (!seen.has(n)) { seen.add(n); prev.set(n, w); next.push(n); }
        frontier = next;
      }
      const path: string[] = [];
      let node: string | undefined = targetWord;
      while (node && node !== startWord) { path.unshift(node); node = prev.get(node); }
      return path; // moves to play, excluding start
    });
    for (const word of pathAfterStart) {
      await page.fill("#guess-input", word);
      await page.getByRole("button", { name: "Change" }).click();
    }
    await expect(page.locator(".win")).toHaveCount(1);
  });

  test("Antonym Bridge plays inside the hub: chaining antonyms to the target wins", async ({ page }) => {
    await page.goto("/#/game/antonym-bridge");
    await expect(page.locator(".game-title")).toHaveText("Antonym Bridge");
    const pathAfterStart = await page.evaluate(async () => {
      const r = await fetch("./antonym-bridge.json");
      const pack = await r.json();
      const cur = document.querySelector(".score-line .cur")?.textContent;
      const puz = pack.puzzles.find((p: { startWord: string }) => p.startWord === cur);
      const { startWord, targetWord, antonyms } = puz as { startWord: string; targetWord: string; antonyms: Record<string, string[]> };
      // undirected BFS
      const adj: Record<string, Set<string>> = {};
      const add = (a: string, b: string) => { (adj[a] ??= new Set()).add(b); };
      for (const [w, ns] of Object.entries(antonyms)) for (const n of ns) { add(w, n); add(n, w); }
      const prev = new Map<string, string>();
      const seen = new Set([startWord]);
      let frontier = [startWord];
      while (frontier.length) {
        const next: string[] = [];
        for (const w of frontier) for (const n of adj[w] ?? []) if (!seen.has(n)) { seen.add(n); prev.set(n, w); next.push(n); }
        frontier = next;
      }
      const path: string[] = [];
      let node: string | undefined = targetWord;
      while (node && node !== startWord) { path.unshift(node); node = prev.get(node); }
      return path;
    });
    for (const word of pathAfterStart) {
      await page.fill("#guess-input", word);
      await page.getByRole("button", { name: "Flip" }).click();
    }
    await expect(page.locator(".win")).toHaveCount(1);
  });

  test("Affix Loom plays inside the hub: building today's target wins", async ({ page }) => {
    await page.goto("/#/game/affix-loom");
    await expect(page.locator(".game-title")).toHaveText("Affix Loom");
    // Read today's target decomposition from the bundled pack via the shown clue.
    const spec = await page.evaluate(async () => {
      const r = await fetch("./affix-loom.json");
      const pack = await r.json();
      const clue = document.querySelector(".clue")?.textContent?.replace(/^Clue:\s*/, "");
      const puz = pack.puzzles.find((p: { clue: string }) => p.clue === clue) ?? pack.puzzles[0];
      return puz.target_specs[0] as { base_id: string; prefix_ids: string[]; suffix_ids: string[] };
    });
    // Select the base, then each prefix/suffix tile by its data path (aria-pressed toggles).
    const clickTile = async (group: string, token: string, suffix: boolean) => {
      const label = suffix ? `-${token}` : group === "prefix" ? `${token}-` : token;
      await page.locator(".tile", { hasText: new RegExp(`^${label.replace(/[-]/g, "\\-")}$`) }).first().click();
    };
    // Resolve tokens from the pack inventory.
    const tokens = await page.evaluate(async (s) => {
      const r = await fetch("./affix-loom.json");
      const pack = await r.json();
      const puz = pack.puzzles.find((p: { target_specs: { base_id: string }[] }) => p.target_specs[0].base_id === s.base_id) ?? pack.puzzles[0];
      const base = puz.bases.find((b: { id: string }) => b.id === s.base_id)?.token;
      const prefixes = s.prefix_ids.map((id: string) => puz.prefixes.find((p: { id: string }) => p.id === id)?.token);
      const suffixes = s.suffix_ids.map((id: string) => puz.suffixes.find((p: { id: string }) => p.id === id)?.token);
      return { base, prefixes, suffixes };
    }, spec);
    await clickTile("base", tokens.base as string, false);
    for (const p of tokens.prefixes) await clickTile("prefix", p as string, false);
    for (const sfx of tokens.suffixes) await clickTile("suffix", sfx as string, true);
    await page.getByRole("button", { name: "Submit" }).click();
    await expect(page.locator(".win")).toHaveCount(1);
  });

  test("Word Morph plays inside the hub: an optimal move is accepted", async ({ page }) => {
    await page.goto("/#/game/word-morph");
    await expect(page.locator(".game-title")).toHaveText("Word Morph");
    await expect(page.locator(".ladder .rung")).not.toHaveCount(0);
    // Ask for a hint to get a guaranteed-valid next word, then play it.
    const next = await page.evaluate(async () => {
      const r = await fetch("./word-morph.json");
      const pack = await r.json();
      return pack.defaultWordLength as number;
    });
    expect(next).toBeGreaterThanOrEqual(3);
    await page.getByRole("button", { name: "Hint" }).click();
    const hint = await page.locator(".sr-live").textContent();
    const word = hint?.match(/Try:\s*([A-Z]+)/)?.[1]?.toLowerCase();
    expect(word).toBeTruthy();
    await page.fill(".morph-input", word as string);
    await page.getByRole("button", { name: "Enter" }).click();
    // The move is appended to the ladder (more than just the start rung + target).
    await expect(page.locator(".ladder .rung")).not.toHaveCount(0);
    await expect(page.locator(".preview")).toContainText(/moves 1/);
  });

  test("Compound Split plays inside the hub: hints form all four compounds and win", async ({ page }) => {
    await page.goto("/#/game/compound-split");
    await expect(page.locator(".game-title")).toHaveText("Compound Split");
    await expect(page.locator(".cs-half")).toHaveCount(8);
    for (let i = 0; i < 4; i++) {
      if (await page.locator(".win").count()) break;
      if (await page.getByRole("button", { name: "Hint" }).isDisabled()) break;
      await page.getByRole("button", { name: "Hint" }).click();
    }
    await expect(page.locator(".win")).toHaveCount(1);
  });

  test("Homophone Heist plays inside the hub: decoding all slots wins", async ({ page }) => {
    await page.goto("/#/game/homophone-heist");
    await expect(page.locator(".game-title")).toHaveText("Homophone Heist");
    const answers = await page.evaluate(async () => {
      const r = await fetch("./homophone-heist.json");
      const pack = await r.json();
      const shown = Array.from(document.querySelectorAll(".hh-token")).map((n) => n.textContent);
      const puz = pack.puzzles.find((p: { shownTokens: string[] }) => p.shownTokens.join() === shown.join());
      return puz.answers as string[];
    });
    for (let i = 0; i < answers.length; i++) {
      await page.locator(".hh-token").nth(i).click();
      await page.fill("#guess-input", answers[i]);
      await page.getByRole("button", { name: "Enter" }).click();
    }
    await expect(page.locator(".win")).toHaveCount(1);
  });

  test("Emoji Etymon plays inside the hub: correct word wins", async ({ page }) => {
    await page.goto("/#/game/emoji-etymon");
    await expect(page.locator(".game-title")).toHaveText("Emoji Etymon");
    await expect(page.locator(".emoji-rebus")).toBeVisible();
    const answer = await page.evaluate(async () => {
      const r = await fetch("./emoji-etymon.json");
      const pack = await r.json();
      const rebus = document.querySelector(".emoji-rebus")?.textContent;
      const puz = pack.puzzles.find((p: { emoji: string }) => p.emoji === rebus);
      return puz.answer as string;
    });
    await page.fill("#guess-input", answer);
    await page.getByRole("button", { name: "Guess" }).click();
    await expect(page.locator(".win")).toHaveCount(1);
  });

  test("progress persists per game across reload (namespaced storage)", async ({ page }) => {
    await page.goto("/#/game/sever");
    await page.locator(".gap").nth(2).click();
    await expect(page.locator(".gap.on")).toHaveCount(1);
    await page.reload();
    await expect(page.locator(".gap.on")).toHaveCount(1);
  });

  test("Web Hub plays inside the hub: solving increments the shared board", async ({ page }) => {
    await page.goto("/#/game/web-hub");
    await expect(page.locator(".wh-word").first()).toBeVisible();
    const hub = await page.evaluate(async () => {
      const pack = await (await fetch("./web-hub.json")).json();
      const board = Array.from(document.querySelectorAll(".wh-word")).map((b) => b.textContent).sort();
      const puz = pack.puzzles.find((p: any) => [...p.board].sort().join() === board.join());
      return puz.hub as string;
    });
    await page.locator(".wh-word", { hasText: new RegExp(`^${hub}`) }).click();
    await expect(page.locator(".win")).toHaveCount(1);
    // Back to the hub: the shared board should now count today's solve.
    await page.locator(".back-btn").click();
    await expect(page.locator(".hub-board")).toContainText(/[1-9]\d* of \d+ solved today/);
  });

  test("plays offline with network blocked after first load", async ({ page, context }) => {
    // Load the game so its pack is fetched, then block network and keep playing.
    await page.goto("/#/game/overlap");
    await expect(page.locator(".anchors strong")).toHaveCount(2);
    const len = await page.evaluate(() => {
      const m = document.querySelector(".sub")?.textContent?.match(/(\d+) letters/);
      return m ? Number(m[1]) : 5;
    });
    await context.route("**/*", (route) => route.abort());
    await page.fill("#guess-input", "a".repeat(len));
    await page.getByRole("button", { name: "Guess" }).click();
    await expect(page.locator(".grid-row")).toHaveCount(1);
  });
});

test.describe("Dev mode (puzzle override)", () => {
  test("dev panel is hidden by default and forces a specific puzzle index", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(".hub-dev")).toHaveCount(0);

    await page.goto("/?dev=1");
    await expect(page.locator(".hub-dev")).toHaveCount(1);
    await expect(page.locator("#dev-web-hub")).toBeVisible();

    await page.fill("#dev-web-hub", "3");
    await page.locator("#dev-web-hub").blur();
    await page.goto("/#/game/web-hub");
    await expect(page.locator(".wh-word").first()).toBeVisible();
    const matches = await page.evaluate(async () => {
      const pack = await (await fetch("./web-hub.json")).json();
      const board = Array.from(document.querySelectorAll(".wh-word")).map((b) => b.textContent).sort();
      return [...pack.puzzles[3].board].sort().join() === board.join();
    });
    expect(matches).toBe(true);
  });

  test("dev override accepts a start word and loads the matching puzzle", async ({ page }) => {
    await page.goto("/?dev=1");
    const word = await page.evaluate(async () => {
      const pack = await (await fetch("./web-hub.json")).json();
      return pack.puzzles[0].board[0] as string;
    });
    await page.fill("#dev-web-hub", word);
    await page.locator("#dev-web-hub").blur();
    await page.goto("/#/game/web-hub");
    await expect(page.locator(".wh-word").first()).toBeVisible();
    const contains = await page.evaluate((w: string) => {
      return Array.from(document.querySelectorAll(".wh-word")).some((b) => b.textContent === w);
    }, word);
    expect(contains).toBe(true);
  });
});

test.describe("Retention UI (Carbon + game-feel)", () => {
  test("Stats button opens an accessible stats modal and Escape closes it", async ({ page }) => {
    await page.goto("/#/game/hidden-middle");
    await expect(page.locator(".game-title")).toHaveText("Hidden Middle");
    await page.getByRole("button", { name: /statistics/i }).click();
    await expect(page.locator(".modal[role=dialog]")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator(".modal-overlay")).toHaveCount(0);
  });

  test("next-puzzle countdown appears on completion", async ({ page }) => {
    await page.goto("/#/game/hidden-middle");
    const answer = await page.evaluate(async () => {
      const r = await fetch("./hidden-middle.json");
      const pack = await r.json();
      const carrier = document.querySelector(".carrier")?.textContent;
      const puz = pack.puzzles.find((p: { carrierWord: string }) => p.carrierWord === carrier);
      return puz.answerWord as string;
    });
    await page.fill("#guess-input", answer);
    await page.getByRole("button", { name: "Guess" }).click();
    await expect(page.locator(".win")).toHaveCount(1);
    await expect(page.locator(".next-countdown")).toContainText(/Next puzzle in \d+:\d\d:\d\d/);
  });
});
