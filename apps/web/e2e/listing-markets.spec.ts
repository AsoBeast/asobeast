import { expect, test } from "./session.mts";

const SWITCHER = "Listing market";
const HOME = "US · United States (home)";
const POLAND = "PL · Poland";

test("shows no switcher for an app with one market", async ({ page }) => {
  await page.goto("/apps/app-2/metadata");

  await expect(
    page.getByRole("heading", { level: 2, name: "Keyword coverage" }),
  ).toBeVisible();
  await expect(page.getByRole("combobox", { name: SWITCHER })).toHaveCount(0);
});

test("lists the markets that have a listing", async ({ page }) => {
  await page.goto("/apps/app-1/metadata");

  const switcher = page.getByRole("combobox", { name: SWITCHER });
  await expect(switcher).toHaveText(HOME);
  await switcher.click();
  await expect(page.getByRole("option")).toHaveText([HOME, POLAND]);
});

test("renders the switcher in the server response", async ({ page }) => {
  const response = await page.request.get("/apps/app-1/metadata");
  const market = await page.request.get("/apps/app-1/metadata?market=pl");

  expect(await response.text()).toContain(SWITCHER);
  expect(await market.text()).toContain(POLAND);
});

test("switching the market shows that listing and keeps it in the url", async ({
  page,
}) => {
  await page.goto("/apps/app-1/metadata");
  const switcher = page.getByRole("combobox", { name: SWITCHER });
  const title = page
    .getByRole("textbox", { name: "Title", exact: true })
    .first();

  await switcher.click();
  await page.getByRole("option", { name: POLAND }).click();

  await expect(page).toHaveURL(/market=pl/);
  await expect(title).toHaveValue("Minutnik Skupienia");
  await expect(page.getByRole("table")).toContainText("minutnik");

  await switcher.click();
  await page.getByRole("option", { name: HOME }).click();

  await expect(page).not.toHaveURL(/market=/);
  await expect(title).toHaveValue("Focus Timer");
});

test("the home view keeps the keywords tracked in other markets", async ({
  page,
}) => {
  await page.goto("/apps/app-1/metadata");

  await expect(
    page.getByRole("table", { name: /Keyword coverage across/ }),
  ).toContainText("productivity app");
});

test("falls back to the home listing for a market without one", async ({
  page,
}) => {
  await page.goto("/apps/app-1/metadata?market=zz");

  await expect(
    page.getByRole("textbox", { name: "Title", exact: true }).first(),
  ).toHaveValue("Focus Timer");
  await expect(page.getByRole("combobox", { name: SWITCHER })).toHaveText(HOME);
  await expect(page.getByText("This app could not be loaded")).toHaveCount(0);
  await expect(
    page.getByText("Metadata audit is not available for this app yet."),
  ).toHaveCount(0);
});

test("the overview facts follow the market", async ({ page }) => {
  await page.goto("/apps/app-1");
  await expect(page.getByText("★ 4.8 (24,000)")).toBeVisible();

  await page.goto("/apps/app-1?market=pl");
  await expect(page.getByText("★ 4.6 (3,100)")).toBeVisible();
});

test("the change timeline follows the market", async ({ page }) => {
  await page.goto("/apps/app-1/changes?market=pl");

  await expect(page.getByText("Minutnik Skupienia")).toBeVisible();
  await expect(page.getByText("Changes · Poland")).toBeVisible();

  await page.goto("/apps/app-1/changes");

  await expect(page.getByText("Focus Timer Pro").first()).toBeVisible();
  await expect(page.getByText("Minutnik Skupienia")).toHaveCount(0);
});

test("refreshes the market being looked at", async ({ page }) => {
  const refreshed: string[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (request.method() === "POST" && url.pathname.endsWith("/refresh")) {
      refreshed.push(url.pathname + url.search);
    }
  });

  await page.goto("/apps/app-1/metadata?market=pl");
  await page
    .getByRole("banner")
    .getByRole("button", { name: "Refresh Poland listing" })
    .click();

  const dialog = page.getByRole("dialog", {
    name: "Snapshot refreshed in Poland",
  });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("cell", { name: "Title" })).toBeVisible();
  expect(refreshed).toEqual(["/api/backend/apps/app-1/refresh?country=pl"]);
  await dialog.getByRole("button", { name: "Close" }).click();

  await page.goto("/apps/app-1/metadata");
  await page
    .getByRole("banner")
    .getByRole("button", { name: "Refresh", exact: true })
    .click();

  await expect(
    page.getByRole("dialog", { name: "Snapshot refreshed" }),
  ).toBeVisible();
  expect(refreshed).toEqual([
    "/api/backend/apps/app-1/refresh?country=pl",
    "/api/backend/apps/app-1/refresh",
  ]);
});

test("explains why a market without keywords cannot be refreshed", async ({
  page,
  context,
}) => {
  const refreshed: string[] = [];
  page.on("request", (request) => {
    if (request.method() === "POST" && request.url().endsWith("/refresh")) {
      refreshed.push(request.url());
    }
  });
  await context.addCookies([
    { name: "e2e_stale_market", value: "pl", domain: "localhost", path: "/" },
  ]);

  await page.goto("/apps/app-1/metadata?market=pl");
  const refresh = page
    .getByRole("banner")
    .getByRole("button", { name: "Refresh Poland listing" });

  await expect(refresh).toHaveAttribute("aria-disabled", "true");
  await expect(refresh).toHaveAccessibleDescription(
    "No keywords are tracked in Poland any more, so its listing is no longer refreshed.",
  );
  await refresh.click({ force: true });
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("textbox", { name: "Title", exact: true }).first(),
  ).toHaveValue("Minutnik Skupienia");
  expect(refreshed).toEqual([]);
});

test("the budget card says how many app requests are market listings", async ({
  page,
  context,
}) => {
  const note =
    "3 of the app requests refresh the listing of a market you track keywords in.";

  await page.goto("/settings");
  await expect(page.getByText("Daily request budget")).toBeVisible();
  await expect(page.getByText(note)).toHaveCount(0);

  await context.addCookies([
    {
      name: "e2e_budget_quota",
      value: "markets",
      domain: "localhost",
      path: "/",
    },
  ]);
  await page.goto("/settings");

  await expect(page.getByText(note)).toBeVisible();
});

test("the screenshot captions follow the market", async ({ page }) => {
  const requested: string[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.pathname.endsWith("/screenshots")) {
      requested.push(url.pathname + url.search);
    }
  });
  const strip = page.getByRole("list", { name: "Screenshots in store order" });

  await page.goto("/apps/app-1/metadata?market=pl");

  await expect(strip.getByRole("listitem")).toHaveCount(2);
  await expect(strip.getByRole("listitem").first()).toContainText(
    "Minutnik do głębokiej pracy",
  );
  await expect(
    page
      .getByRole("table", { name: /Keyword coverage across/ })
      .getByRole("row", { name: /minutnik/ })
      .getByText("in screenshot text"),
  ).toBeAttached();

  const switcher = page.getByRole("combobox", { name: SWITCHER });
  await switcher.click();
  await page.getByRole("option", { name: HOME }).click();

  await expect(strip.getByRole("listitem")).toHaveCount(4);
  await expect(strip.getByRole("listitem").first()).toContainText(
    "Focus timer for deep work",
  );
  expect(requested).toContain("/api/backend/apps/app-1/screenshots");
  expect(requested).not.toContain(
    "/api/backend/apps/app-1/screenshots?country=us",
  );
});

test("the change timeline shows the screenshot changes of a market", async ({
  page,
}) => {
  const imageRows = page.locator('[data-change-field="screenshotImages"]');

  await page.goto("/apps/app-1/changes?market=pl");

  await expect(imageRows).toHaveCount(1);
  await expect(imageRows).toContainText("Focus Timer");
  await expect(imageRows).toContainText("Screenshot 2 replaced");
  await expect(
    imageRows.getByRole("img", { name: "After, screenshot 2" }),
  ).toBeVisible();

  await page.goto("/apps/app-1/changes");

  await expect(imageRows).toHaveCount(1);
  await expect(imageRows).toContainText("Rival Focus");
});
