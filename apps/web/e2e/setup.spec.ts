import type { APIRequestContext, Page } from "@playwright/test";
import { expect, test } from "./session.mts";
import { parseOnboardingState } from "../src/lib/onboarding";
import { OWNER_ONBOARDING_KEY } from "./onboarding.mts";

test.describe.configure({ mode: "serial" });

const storedStatus = async (page: Page): Promise<string> => {
  const stored = await page.evaluate(
    (key) => localStorage.getItem(key),
    OWNER_ONBOARDING_KEY,
  );
  return parseOnboardingState(stored).status;
};

const MOCK_API_URL = `http://localhost:${process.env.MOCK_API_PORT ?? 4100}`;

const resetSeed = (request: APIRequestContext, country: string) =>
  request.post(`${MOCK_API_URL}/__reset/market-seed/app-1/${country}`);

const resetCompetitors = (request: APIRequestContext, appId: string) =>
  request.post(`${MOCK_API_URL}/__reset/competitors/${appId}`);

const resetKeywords = (request: APIRequestContext, appId: string) =>
  request.post(`${MOCK_API_URL}/__reset/keywords/${appId}`);

const suggestionRow = (page: Page, text: string) =>
  stepCard(page, "Track keywords")
    .getByRole("listitem")
    .filter({ has: page.getByText(text, { exact: true }) });

const storedMarkets = async (page: Page): Promise<string[]> => {
  const stored = await page.evaluate(
    (key) => localStorage.getItem(key),
    OWNER_ONBOARDING_KEY,
  );
  return parseOnboardingState(stored).selectedMarkets;
};

const selectedMarkets = (page: Page) =>
  page.getByRole("list", { name: "Selected countries" });

const stepCard = (page: Page, title: string) =>
  page
    .locator('[data-slot="card"]')
    .filter({ has: page.getByRole("heading", { name: title, exact: true }) });

const storedSkipped = async (page: Page): Promise<string[]> => {
  const stored = await page.evaluate(
    (key) => localStorage.getItem(key),
    OWNER_ONBOARDING_KEY,
  );
  return parseOnboardingState(stored).skipped;
};

const startSetup = async (page: Page, id: string): Promise<void> => {
  await page.goto(`/apps/${id}/setup`);
  await page.getByRole("button", { name: "Start this setup" }).click();
};

test("unknown and unavailable apps render route boundaries", async ({
  page,
}) => {
  await page.goto("/apps/deleted-app/setup");
  await expect(
    page.getByRole("main").getByText("Page not found"),
  ).toBeVisible();

  await page.goto("/apps/err-app/setup");
  await expect(page.getByRole("main").getByRole("alert")).toBeVisible();
});

test("setup offers a retry when the account cannot be loaded", async ({
  page,
}) => {
  await page.route("**/api/backend/auth/me", (route) =>
    route.fulfill({ status: 503, json: { statusCode: 503 } }),
  );
  await page.goto("/apps/app-1/setup");

  const failure = page
    .getByRole("main")
    .getByRole("alert")
    .filter({ hasText: "Account could not be loaded" });
  await expect(failure).toBeVisible();

  await page.unroute("**/api/backend/auth/me");
  await failure.getByRole("button", { name: "Try again" }).click();

  await expect(
    page.getByText("Start setup for this app", { exact: true }),
  ).toBeVisible();
});

test("a direct visit never enrols without an explicit start", async ({
  page,
}) => {
  await page.goto("/apps/app-1/setup");

  await expect(
    page.getByText("Start setup for this app", { exact: true }),
  ).toBeVisible();
  expect(await storedStatus(page)).toBe("not_started");

  await page.goto("/");
  await expect(page.getByRole("link", { name: "Resume setup" })).toBeHidden();

  await startSetup(page, "app-1");
  expect(await storedStatus(page)).toBe("in_progress");
});

test("direct setup is resumable and completes after live checks", async ({
  page,
}) => {
  await startSetup(page, "app-1");

  await expect(
    page.getByRole("heading", {
      name: "Set up Focus Timer · 1 of 3 · next: track keywords",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("progressbar", { name: "Setup progress" }),
  ).toHaveAttribute("aria-valuetext", "1 of 3 steps");
  await expect(
    page.getByRole("navigation", { name: "Setup steps" }).getByRole("link"),
  ).toHaveText(["Pick competitors", "Track keywords", "Add countries"]);
  await expect(page.getByRole("heading", { level: 3 })).toHaveText([
    "Pick competitors",
    "Track keywords",
    "Add countries",
  ]);
  for (const label of ["Step 1 of 3", "Step 2 of 3", "Step 3 of 3"]) {
    await expect(page.getByText(label, { exact: true })).toBeVisible();
  }
  await expect(page.getByText("United States (US)")).toBeVisible();
  await expect(page.getByText("1 tracked: Rival Focus")).toBeVisible();
  await expect(
    stepCard(page, "Pick competitors").getByText("Done", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("4 of 10 tracked in United States"),
  ).toBeVisible();
  const complete = page.getByRole("button", { name: "Complete setup" });
  await expect(complete).toBeDisabled();

  const keywords = stepCard(page, "Track keywords");
  await keywords.getByRole("button", { name: "Skip this step" }).click();
  await expect(
    keywords.getByText("Only the phrases from your listing are tracked."),
  ).toBeVisible();
  await expect(keywords.getByText("Skipped", { exact: true })).toBeVisible();
  await expect(complete).toBeDisabled();
  await page.getByRole("button", { name: "Countries reviewed" }).click();
  await expect(
    stepCard(page, "Add countries").getByText("Done", { exact: true }),
  ).toBeVisible();
  await expect(complete).toBeEnabled();
  await expect(
    page.getByRole("heading", {
      name: "Set up Focus Timer · 3 of 3 · ready to complete",
    }),
  ).toBeVisible();

  await expect(
    page.getByText(
      "Your listing ships English, German, French, Japanese, and Polish.",
    ),
  ).toBeVisible();
  const german = page.getByRole("group", { name: "German" });
  for (const market of ["Germany (DE)", "Austria (AT)", "Switzerland (CH)"]) {
    await expect(german.getByText(market, { exact: true })).toBeVisible();
  }
  await expect(
    page.getByRole("group", { name: "Polish" }).getByText("Tracked"),
  ).toBeVisible();
  await expect(
    german
      .locator("div")
      .filter({ hasText: "Germany (DE)" })
      .getByText("2 listing reads a day, 1 per keyword"),
  ).toBeVisible();
  await page.getByLabel("Germany (DE)").check();
  await page.getByLabel("Seed with its listing for Germany").uncheck();
  await page
    .getByRole("button", { name: "Add 1 country", exact: true })
    .click();
  await expect(selectedMarkets(page).getByText("Germany (DE)")).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Review DE keywords" }),
  ).toHaveAttribute("href", "/apps/app-1/keywords?country=de");
  await expect(
    page
      .getByRole("listitem")
      .filter({ hasText: "Germany" })
      .filter({ hasText: "active" }),
  ).toBeVisible();
  await page.getByLabel("Germany (DE)").uncheck();
  await expect(selectedMarkets(page).getByText("Germany (DE)")).toHaveCount(0);

  const add = page.getByRole("button", { name: "Add", exact: true });
  await expect(page.getByText("Add another country")).toBeVisible();
  await page.getByRole("combobox", { name: "Country to add" }).click();
  await page.getByRole("option", { name: "Other…" }).click();
  await page.getByLabel("Storefront country code").fill("xx");
  await expect(
    page.getByText("xx is not an App Store storefront"),
  ).toBeVisible();
  await expect(add).toBeDisabled();
  await page.getByLabel("Storefront country code").fill("se");
  await expect(add).toBeEnabled();
  await page.getByRole("combobox", { name: "Country to add" }).click();
  await page.getByRole("option", { name: "PL · Poland" }).click();
  await add.click();
  await expect(selectedMarkets(page).getByText("Poland (PL)")).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Review PL keywords" }),
  ).toHaveAttribute("href", "/apps/app-1/keywords?country=pl");
  await expect(page.getByText("0 active")).toBeVisible();
  await expect(page.getByText("4 active")).toBeVisible();

  await expect(complete).toBeEnabled();
  await complete.click();
  await expect(page).toHaveURL("/apps/app-1");
  expect(await storedStatus(page)).toBe("completed");

  await page.goto("/apps/app-1/setup");
  await expect(page.getByText("Setup complete", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Open the overview" }),
  ).toHaveAttribute("href", "/apps/app-1");
  expect(await storedSkipped(page)).toEqual(["keywords"]);
});

test("a skipped step turns done once its target is reached", async ({
  page,
  request,
}) => {
  await resetCompetitors(request, "app-new");
  await startSetup(page, "app-new");

  const competitors = stepCard(page, "Pick competitors");
  await competitors.getByRole("button", { name: "Skip this step" }).click();
  await expect(competitors.getByText("Skipped", { exact: true })).toBeVisible();
  await competitors
    .getByLabel("Competitor App Store URL")
    .fill("https://apps.apple.com/us/app/rival/id555000998");
  await competitors.getByRole("button", { name: "Add competitor" }).click();

  await expect(competitors.getByText("Done", { exact: true })).toBeVisible();
  await expect(
    competitors.getByText(
      "Positions are compared against nobody until a competitor is added.",
    ),
  ).toHaveCount(0);
  await resetCompetitors(request, "app-new");
});

test("a skipped step names its reason and can be undone", async ({ page }) => {
  await startSetup(page, "app-2");

  const competitors = stepCard(page, "Pick competitors");
  await competitors.getByRole("button", { name: "Skip this step" }).click();
  await expect(
    competitors.getByText(
      "Positions are compared against nobody until a competitor is added.",
    ),
  ).toBeVisible();
  await competitors.getByRole("button", { name: "Undo skip" }).click();

  await expect(
    competitors.getByRole("button", { name: "Skip this step" }),
  ).toBeVisible();
  expect(await storedSkipped(page)).toEqual([]);
});

test("a version 1 record resumes as in progress with its markets", async ({
  page,
}) => {
  await page.addInitScript((key) => {
    localStorage.setItem(
      key,
      JSON.stringify({
        version: 1,
        status: "in_progress",
        appId: "app-2",
        selectedMarkets: ["de", "us"],
        acknowledgements: {
          noCompetitors: true,
          keywordsConfirmed: false,
          capacityReviewed: false,
          alertsSkipped: false,
        },
      }),
    );
  }, OWNER_ONBOARDING_KEY);
  await page.goto("/apps/app-2/setup");

  await expect(
    page.getByRole("heading", { name: /^Set up Habit Tracker · 1 of 3/ }),
  ).toBeVisible();
  await expect(selectedMarkets(page).getByText("Germany (DE)")).toBeVisible();
  await expect(
    stepCard(page, "Pick competitors").getByText("Skipped", { exact: true }),
  ).toBeVisible();
});

test("a failed live count blocks completion until a retry succeeds", async ({
  page,
}) => {
  await page.context().addCookies([
    {
      name: "e2e-fail-competitors",
      value: "1",
      domain: "localhost",
      path: "/",
    },
  ]);
  await startSetup(page, "app-1");

  await expect(
    page.getByText("Competitor count is temporarily unavailable."),
  ).toBeVisible({ timeout: 20_000 });
  await expect(
    page.getByText("Some live counts could not be loaded."),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Complete setup" }),
  ).toBeDisabled();

  await page.context().clearCookies({ name: "e2e-fail-competitors" });
  await page.getByRole("button", { name: "Retry" }).click();

  await expect(page.getByText("1 tracked: Rival Focus")).toBeVisible();
  await expect(
    page.getByText("Some live counts could not be loaded."),
  ).toBeHidden();
});

test.describe("picking competitors inside the step", () => {
  test.afterEach(async ({ request }) => {
    await resetCompetitors(request, "app-1");
    await resetCompetitors(request, "app-2");
  });

  test("a competitor added by url inside the step raises the count", async ({
    page,
    request,
  }) => {
    await resetCompetitors(request, "app-2");
    await startSetup(page, "app-2");

    const competitors = stepCard(page, "Pick competitors");
    await expect(competitors.getByText("No competitor yet")).toBeVisible();
    await competitors
      .getByLabel("Competitor App Store URL")
      .fill("https://apps.apple.com/us/app/rival/id555000999");
    await competitors.getByRole("button", { name: "Add competitor" }).click();

    await expect(page.getByText("Added 555000999")).toBeVisible();
    await expect(competitors.getByText("1 tracked: 555000999")).toBeVisible();
    await expect(competitors.getByText("Done", { exact: true })).toBeVisible();
    await expect(page).toHaveURL("/apps/app-2/setup");
  });

  test("a discovered app can be tracked from the step", async ({
    page,
    request,
  }) => {
    await resetCompetitors(request, "app-1");
    await startSetup(page, "app-1");

    const discovered = page.getByRole("list", {
      name: "Apps ranking for your keywords",
    });
    const row = discovered
      .getByRole("listitem")
      .filter({ hasText: "Deep Work Sessions" });
    await row.getByRole("button", { name: "Track" }).click();

    await expect(
      page.getByText("Now tracking Deep Work Sessions"),
    ).toBeVisible();
    await expect(
      page.getByText("2 tracked: Rival Focus and Deep Work Sessions"),
    ).toBeVisible();
    await expect(
      stepCard(page, "Pick competitors").getByText("Done", { exact: true }),
    ).toBeVisible();
  });
});

test.describe("picking keywords inside the step", () => {
  test.afterEach(async ({ request }) => {
    await resetKeywords(request, "app-1");
    await resetKeywords(request, "app-new");
  });

  test("keywords are tracked from the listing suggestions inside the step", async ({
    page,
    request,
  }) => {
    await resetKeywords(request, "app-1");
    await startSetup(page, "app-1");

    const keywords = stepCard(page, "Track keywords");
    await expect(
      keywords.getByText("4 of 10 tracked in United States"),
    ).toBeVisible();
    await expect(
      keywords.getByRole("tab", { name: "From your listing" }),
    ).toHaveAttribute("aria-selected", "true");
    await expect(
      suggestionRow(page, "focus timer").getByText("Tracked"),
    ).toBeVisible();
    await expect(
      suggestionRow(page, "focus timer").getByRole("checkbox"),
    ).toBeDisabled();

    await keywords.getByLabel("deep focus").check();
    await keywords.getByLabel("pomodoro timer").check();
    await keywords.getByRole("button", { name: "Track 2 selected" }).click();

    await expect(
      page.getByText("Tracking 2 keywords. Positions arrive within minutes."),
    ).toBeVisible();
    await expect(
      keywords.getByText("6 of 10 tracked in United States"),
    ).toBeVisible();
    await expect(keywords.getByText("4 more to reach 10")).toBeVisible();
    for (const text of ["deep focus", "pomodoro timer"]) {
      await expect(
        suggestionRow(page, text).getByText("Tracked"),
      ).toBeVisible();
    }
    await expect(
      keywords.getByRole("button", { name: "Track selected" }),
    ).toBeDisabled();
  });

  test("the autocomplete tab loads only when opened", async ({ page }) => {
    const strategies: string[] = [];
    page.on("request", (sent) => {
      const url = new URL(sent.url());
      if (url.pathname.endsWith("/keywords/suggestions")) {
        strategies.push(url.searchParams.get("strategy") ?? "");
      }
    });
    await startSetup(page, "app-1");
    const keywords = stepCard(page, "Track keywords");
    await expect(keywords.getByLabel("deep focus")).toBeVisible();
    expect(strategies.filter((strategy) => strategy === "search")).toEqual([]);

    await keywords.getByRole("tab", { name: "Store autocomplete" }).click();
    await expect(keywords.getByLabel("focus timer app")).toBeVisible();
    await keywords.getByRole("tab", { name: "From your listing" }).click();
    await keywords.getByRole("tab", { name: "Store autocomplete" }).click();
    await expect(keywords.getByLabel("focus music")).toBeVisible();

    expect(strategies.filter((strategy) => strategy === "search")).toEqual([
      "search",
    ]);
  });

  test("a failed suggestion load offers a retry", async ({ page }) => {
    await page.context().addCookies([
      {
        name: "e2e_suggestions_fail",
        value: "1",
        domain: "localhost",
        path: "/",
      },
    ]);
    await startSetup(page, "app-1");

    const keywords = stepCard(page, "Track keywords");
    await expect(keywords.getByRole("button", { name: "Retry" })).toBeVisible({
      timeout: 20_000,
    });

    await page.context().clearCookies({ name: "e2e_suggestions_fail" });
    await keywords.getByRole("button", { name: "Retry" }).click();

    await expect(keywords.getByLabel("deep focus")).toBeVisible();
  });

  test("reaching ten keywords marks the step done", async ({
    page,
    request,
  }) => {
    await resetKeywords(request, "app-new");
    await startSetup(page, "app-new");

    const keywords = stepCard(page, "Track keywords");
    await expect(
      keywords.getByText("8 of 10 tracked in United States"),
    ).toBeVisible();
    await expect(keywords.getByText("2 more to reach 10")).toBeVisible();
    await keywords.getByLabel("imported timer").check();
    await keywords.getByLabel("work sessions").check();
    await keywords.getByRole("button", { name: "Track 2 selected" }).click();

    await expect(
      keywords.getByText("10 of 10 tracked in United States"),
    ).toBeVisible();
    await expect(keywords.getByText("Done", { exact: true })).toBeVisible();
    await expect(keywords.getByText(/more to reach/)).toHaveCount(0);
  });
});

test("the discovered list says positions are still collected on a new app", async ({
  page,
}) => {
  await startSetup(page, "app-new");

  await expect(
    page.getByText(
      "Positions are still being collected. Apps that rank for your keywords appear here within minutes.",
    ),
  ).toBeVisible();
});

test("corrupt state resets and setup can be dismissed on a narrow dark layout", async ({
  page,
}) => {
  await page.addInitScript((key) => {
    if (localStorage.getItem(key) === null) {
      localStorage.setItem(key, "{broken");
    }
    localStorage.setItem("theme", "dark");
  }, OWNER_ONBOARDING_KEY);
  await page.setViewportSize({ width: 390, height: 844 });
  await startSetup(page, "app-2");

  await expect(page.locator("html")).toHaveClass(/dark/);
  await expect(page.getByText("United States (US)")).toBeVisible();
  await page.getByRole("button", { name: "Dismiss setup" }).click();
  await expect(
    page.getByText("Setup dismissed", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByText("Setup dismissed", { exact: true }),
  ).toBeVisible();
});

test("an app with no suggested markets keeps the country select", async ({
  page,
}) => {
  await startSetup(page, "app-2");

  await expect(page.getByText("Add a country", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("combobox", { name: "Country to add" }),
  ).toBeVisible();
  await expect(page.getByLabel("Storefront country code")).toHaveCount(0);
  await expect(page.getByText("Your listing ships")).toHaveCount(0);
  await expect(page.locator("legend")).toHaveCount(0);
});

test("suggested markets fit a narrow dark layout", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("theme", "dark"));
  await page.setViewportSize({ width: 390, height: 844 });
  await startSetup(page, "app-1");

  await expect(page.getByRole("group", { name: "German" })).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
});

test.describe("seeding suggested markets", () => {
  test("suggested markets are added and seeded from their listings", async ({
    page,
    request,
  }) => {
    await resetSeed(request, "at");
    await startSetup(page, "app-1");

    await page.getByLabel("Austria (AT)").check();
    await page.getByLabel("Japan (JP)").check();
    await expect(
      page.getByLabel("Seed with its listing for Austria"),
    ).toBeChecked();
    await expect(
      page.getByLabel("Seed with its listing for Japan"),
    ).toBeChecked();
    await page
      .getByRole("button", { name: "Add 2 countries and seed 2", exact: true })
      .click();

    await expect(
      page.getByText("Seeded 2 keywords from its listing"),
    ).toBeVisible();
    await expect(
      page.getByText("Not published on this storefront, so it was not added"),
    ).toBeVisible();
    await expect(selectedMarkets(page).getByText("Austria (AT)")).toBeVisible();
    await expect(selectedMarkets(page).getByText("Japan (JP)")).toHaveCount(0);
    await expect(
      page
        .getByRole("listitem")
        .filter({ hasText: "Austria" })
        .filter({ hasText: "2 active" }),
    ).toBeVisible();
    expect(await storedStatus(page)).toBe("in_progress");
    expect(await storedMarkets(page)).toEqual(["at", "us"]);
  });

  test("a market can be added without seeding", async ({ page }) => {
    const seeds: string[] = [];
    page.on("request", (sent) => {
      if (sent.url().includes("/market-seed")) seeds.push(sent.url());
    });
    await startSetup(page, "app-1");
    await expect(
      page.getByLabel("Seed with its listing for Canada"),
    ).toHaveCount(0);

    await page.getByLabel("Canada (CA)").check();
    await expect(
      page.getByLabel("Seed with its listing for Canada"),
    ).not.toBeChecked();
    await page
      .getByRole("button", { name: "Add 1 country", exact: true })
      .click();

    await expect(selectedMarkets(page).getByText("Canada (CA)")).toBeVisible();
    await expect(page.getByText(/^Seeded/)).toHaveCount(0);
    expect(seeds).toEqual([]);
  });

  test("a market added after an unavailable seed shows no stale outcome", async ({
    page,
  }) => {
    await startSetup(page, "app-1");

    await page.getByLabel("Japan (JP)").check();
    await page
      .getByRole("button", { name: "Add 1 country and seed 1", exact: true })
      .click();
    const unavailable = page.getByText(
      "Not published on this storefront, so it was not added",
    );
    await expect(unavailable).toBeVisible();

    await page.getByLabel("Japan (JP)").check();
    await page.getByLabel("Seed with its listing for Japan").uncheck();
    await page
      .getByRole("button", { name: "Add 1 country", exact: true })
      .click();

    await expect(selectedMarkets(page).getByText("Japan (JP)")).toBeVisible();
    await expect(unavailable).toHaveCount(0);
  });

  test("a refused seed still selects the market", async ({ page }) => {
    await page.context().addCookies([
      {
        name: "e2e_seed_refused",
        value: "1",
        domain: "localhost",
        path: "/",
      },
    ]);
    await startSetup(page, "app-1");

    await page.getByLabel("France (FR)").check();
    await page
      .getByRole("button", { name: "Add 1 country and seed 1", exact: true })
      .click();

    await expect(
      page.getByText(/^Refresh limit reached: the indie plan allows/),
    ).toBeVisible();
    await expect(selectedMarkets(page).getByText("France (FR)")).toBeVisible();
  });

  test("seeding respects the keyword room", async ({ page, request }) => {
    await resetSeed(request, "ch");
    await page
      .context()
      .addCookies([
        { name: "e2e_seed_room", value: "1", domain: "localhost", path: "/" },
      ]);
    await startSetup(page, "app-1");

    await page.getByLabel("Switzerland (CH)").check();
    await page
      .getByRole("button", { name: "Add 1 country and seed 1", exact: true })
      .click();

    await expect(
      page.getByText(
        "Seeded 1 keyword from its listing, 1 left out by the keyword limit",
      ),
    ).toBeVisible();
  });
});
