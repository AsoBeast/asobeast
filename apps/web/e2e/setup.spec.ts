import type { APIRequestContext, Page } from "@playwright/test";
import { expect, test } from "./session.mts";
import { parseOnboardingState } from "../src/lib/onboarding";
import { OWNER_ONBOARDING_KEY } from "./onboarding.mts";
import { seedViewer } from "./viewer.mts";

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

const storedMarkets = async (page: Page): Promise<string[]> => {
  const stored = await page.evaluate(
    (key) => localStorage.getItem(key),
    OWNER_ONBOARDING_KEY,
  );
  return parseOnboardingState(stored).selectedMarkets;
};

const selectedMarkets = (page: Page) =>
  page.getByRole("list", { name: "Selected markets" });

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

test("a direct visit never enrols without an explicit start", async ({
  page,
}) => {
  await page.goto("/apps/app-1/setup");

  await expect(
    page.getByText("Start setup for this app", { exact: true }),
  ).toBeVisible();
  expect(await storedStatus(page)).toBe("not_started");

  await page.goto("/");
  await expect(page.getByText("Finish setting up")).toBeHidden();

  await startSetup(page, "app-1");
  expect(await storedStatus(page)).toBe("in_progress");
});

test("direct setup is resumable and completes after live checks", async ({
  page,
}) => {
  await startSetup(page, "app-1");

  await expect(
    page.getByRole("heading", { name: "Set up Focus Timer" }),
  ).toBeVisible();
  for (const title of [
    "Choose markets",
    "Add competitors",
    "Confirm keywords",
    "Daily request budget",
    "Configure alerts",
  ]) {
    await expect(page.getByText(title, { exact: true })).toBeVisible();
  }
  await expect(page.getByText("United States (US)")).toBeVisible();
  await expect(page.getByText("1 competitor configured")).toBeVisible();
  await expect(page.getByText("4 active")).toBeVisible();

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
  await page.getByRole("button", { name: "Add 1 market", exact: true }).click();
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

  await page.getByLabel("Another storefront? Add a country code").fill("PL");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(selectedMarkets(page).getByText("Poland (PL)")).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Review PL keywords" }),
  ).toHaveAttribute("href", "/apps/app-1/keywords?country=pl");
  await expect(page.getByText("0 active")).toBeVisible();

  await page.getByLabel("I reviewed the keywords for these markets").click();
  await page.getByLabel("I reviewed daily request capacity").click();
  const complete = page.getByRole("button", { name: "Complete setup" });
  await expect(complete).toBeEnabled();
  await complete.click();
  await expect(page.getByText("Setup complete", { exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByText("Setup complete", { exact: true })).toBeVisible();
  expect(await storedStatus(page)).toBe("completed");
});

test("a customer completes setup without the capacity step", async ({
  page,
  context,
}) => {
  await seedViewer(context, "customer");
  await startSetup(page, "app-1");

  await expect(page.getByText("Step 4 of 4", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Configure alerts", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Daily request budget", { exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByLabel("I reviewed daily request capacity"),
  ).toHaveCount(0);

  await page.getByLabel("I reviewed the keywords for these markets").click();
  const complete = page.getByRole("button", { name: "Complete setup" });
  await expect(complete).toBeEnabled();
  await complete.click();
  await expect(
    page.getByText(
      "Markets, competitors, keywords and alerts have been reviewed.",
    ),
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

  await expect(page.getByText("1 competitor configured")).toBeVisible();
  await expect(
    page.getByText("Some live counts could not be loaded."),
  ).toBeHidden();
});

test("setup links reach the existing workspaces and anchored settings", async ({
  page,
}) => {
  await startSetup(page, "app-1");

  await page.getByRole("link", { name: "Open capacity settings" }).click();
  await expect(page).toHaveURL("/settings#daily-capacity");
  await expect(
    page.getByText("Daily request budget", { exact: true }),
  ).toBeVisible();

  await page.goBack();
  await page.getByRole("link", { name: "Configure webhooks" }).click();
  await expect(page).toHaveURL("/settings#webhooks");
  await expect(page.getByText("Webhooks", { exact: true })).toBeVisible();

  await page.goBack();
  await page.getByRole("link", { name: "Configure email alerts" }).click();
  await expect(page).toHaveURL("/settings#email-alerts");
  await expect(
    page.locator("#email-alerts").getByText("Email", { exact: true }),
  ).toBeVisible();
});

test("optional alerts can be skipped to complete setup", async ({ page }) => {
  await page.context().addCookies([
    {
      name: "e2e-empty-alerts",
      value: "1",
      domain: "localhost",
      path: "/",
    },
  ]);
  await startSetup(page, "app-2");

  await page.getByLabel("No competitors yet").click();
  await page.getByLabel("I reviewed the keywords for these markets").click();
  await page.getByLabel("I reviewed daily request capacity").click();
  await page.getByLabel("Skip alerts for now").click();
  await page.getByRole("button", { name: "Complete setup" }).click();

  await expect(page.getByText("Setup complete", { exact: true })).toBeVisible();
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

test("an app with no suggested markets keeps the plain country input", async ({
  page,
}) => {
  await startSetup(page, "app-2");

  await expect(
    page.getByLabel("Add a country code", { exact: true }),
  ).toBeVisible();
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
      .getByRole("button", { name: "Add 2 markets and seed 2", exact: true })
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
      .getByRole("button", { name: "Add 1 market", exact: true })
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
      .getByRole("button", { name: "Add 1 market and seed 1", exact: true })
      .click();
    const unavailable = page.getByText(
      "Not published on this storefront, so it was not added",
    );
    await expect(unavailable).toBeVisible();

    await page.getByLabel("Japan (JP)").check();
    await page.getByLabel("Seed with its listing for Japan").uncheck();
    await page
      .getByRole("button", { name: "Add 1 market", exact: true })
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
      .getByRole("button", { name: "Add 1 market and seed 1", exact: true })
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
      .getByRole("button", { name: "Add 1 market and seed 1", exact: true })
      .click();

    await expect(
      page.getByText(
        "Seeded 1 keyword from its listing, 1 left out by the keyword limit",
      ),
    ).toBeVisible();
  });
});
