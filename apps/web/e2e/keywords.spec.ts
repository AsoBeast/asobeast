import { readFileSync } from "node:fs";
import type { Page } from "@playwright/test";
import { expect, test } from "./session.mts";
import { hoverForTooltip } from "./hover.mts";

test("table renders fixture keywords and distinguishes a paused row", async ({
  page,
}) => {
  await page.goto("/apps/app-1/keywords");

  await expect(page.getByText("Tracking 5 keywords · 4 active")).toBeVisible();
  for (const text of [
    "focus timer",
    "pomodoro",
    "study timer",
    "productivity app",
  ]) {
    await expect(
      page.getByRole("cell", { name: text, exact: true }),
    ).toBeVisible();
  }

  const pausedRow = page.getByRole("row", { name: /time blocking/ });
  await expect(pausedRow).toBeVisible();
  await expect(pausedRow.getByText("Paused")).toBeVisible();
});

test("market filter switches to an empty market with an add prompt", async ({
  page,
}) => {
  await page.goto("/apps/app-1/keywords");

  const usTab = page.getByRole("button", { name: /^US/ });
  await expect(usTab).toHaveAttribute("aria-pressed", "true");

  await page.getByRole("button", { name: /^PL/ }).click();
  await expect(page).toHaveURL(/country=pl/);

  await expect(
    page.getByText(/No keywords tracked in Poland yet/),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Add keywords" }).first(),
  ).toBeVisible();
});

test("clicking a sort header updates the url and reorders rows", async ({
  page,
}) => {
  await page.goto("/apps/app-1/keywords");

  const firstKeyword = page
    .getByRole("table", { name: /Tracked keywords/ })
    .getByRole("row")
    .nth(1);

  await expect(firstKeyword).toContainText("focus timer");

  await page.getByRole("button", { name: "Popularity", exact: true }).click();

  await expect(page).toHaveURL(/sort=traffic/);
  await expect(firstKeyword).toContainText("pomodoro");
});

const firstDataRow = (page: Page) =>
  page
    .getByRole("table", { name: /Tracked keywords/ })
    .getByRole("row")
    .nth(1);

test("a second click on a sort header flips the direction", async ({
  page,
}) => {
  await page.goto("/apps/app-1/keywords");

  const popularity = page.getByRole("button", {
    name: "Popularity",
    exact: true,
  });
  await popularity.click();
  await expect(page).toHaveURL(/sort=traffic/);
  await expect(firstDataRow(page)).toContainText("pomodoro");

  const requests: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname === "/api/backend/apps/app-1/keywords")
      requests.push(request.url());
  });

  await popularity.click();

  await expect(page).toHaveURL(/dir=asc/);
  await expect(firstDataRow(page)).toContainText("study timer");
  await expect(
    page
      .getByRole("table", { name: /Tracked keywords/ })
      .getByRole("row")
      .last(),
  ).toContainText("time blocking");
  expect(requests).toEqual([]);
});

test("a pasted link with a direction loads in that order and announces it", async ({
  page,
}) => {
  await page.goto("/apps/app-1/keywords?sort=difficulty&dir=asc");

  await expect(firstDataRow(page)).toContainText("focus timer");
  await expect(
    page.getByRole("columnheader", { name: "Difficulty" }),
  ).toHaveAttribute("aria-sort", "ascending");
  await expect(
    page.getByRole("columnheader", { name: "Popularity" }),
  ).not.toHaveAttribute("aria-sort", /.+/);
});

test("the keyword, source and weekly change headers sort too", async ({
  page,
}) => {
  await page.goto("/apps/app-1/keywords");
  const rows = page
    .getByRole("table", { name: /Tracked keywords/ })
    .getByRole("row");

  await page.getByRole("button", { name: "Keyword", exact: true }).click();
  await expect(page).toHaveURL(/sort=keyword/);
  await expect(rows.nth(1)).toContainText("focus timer");
  await expect(rows.nth(2)).toContainText("pomodoro");
  await expect(rows.last()).toContainText("time blocking");

  await page.getByRole("button", { name: "Source", exact: true }).click();
  await expect(page).toHaveURL(/sort=source/);
  await expect(rows.nth(1)).toContainText("time blocking");
  await expect(rows.last()).toContainText("focus timer");

  await page.getByRole("button", { name: "Δ7d", exact: true }).click();
  await expect(page).toHaveURL(/sort=delta7d/);
  await expect(rows.nth(1)).toContainText("focus timer");
  await expect(rows.nth(2)).toContainText("study timer");
  await expect(rows.last()).toContainText("productivity app");
});

test("position deltas render arrows, a bare position and the captured-depth marker", async ({
  page,
}) => {
  await page.goto("/apps/app-1/keywords");

  await expect(page.getByLabel("up 2 since yesterday")).toBeVisible();
  await expect(page.getByLabel("down 3 since yesterday")).toBeVisible();

  const unchangedRow = page.getByRole("row", { name: /study timer/ });
  await expect(unchangedRow).toContainText("7");
  await expect(unchangedRow.getByLabel(/since yesterday/)).toHaveCount(0);

  const unrankedRow = page.getByRole("row", { name: /productivity app/ });
  await expect(unrankedRow).toContainText(">200");
});

test("the seven day delta announces its direction, not only its colour", async ({
  page,
}) => {
  await page.goto("/apps/app-1/keywords");

  await expect(
    page
      .getByRole("row", { name: /focus timer/ })
      .getByLabel("up 7 over 7 days"),
  ).toBeVisible();
  await expect(
    page
      .getByRole("row", { name: /pomodoro/ })
      .getByLabel("down 6 over 7 days"),
  ).toBeVisible();
});

test("volatility column labels low, high and unavailable rows", async ({
  page,
}) => {
  await page.goto("/apps/app-1/keywords");

  const lowRow = page.getByRole("row", { name: /focus timer/ });
  await expect(lowRow.getByLabel("Low volatility, 8 out of 100")).toBeVisible();

  const highRow = page.getByRole("row", { name: /pomodoro/ });
  await expect(
    highRow.getByLabel("High volatility, 72 out of 100"),
  ).toBeVisible();

  const nullRow = page.getByRole("row", { name: /productivity app/ });
  await expect(nullRow.getByLabel(/volatility, \d+ out of 100/)).toHaveCount(0);
});

test("the volatility header sorts and still opens its tooltip", async ({
  page,
}) => {
  await page.goto("/apps/app-1/keywords");

  const header = page.getByRole("button", { name: "Volatility" });

  await hoverForTooltip(
    page,
    header,
    page.getByText(/How much the top 10 changed day to day/),
  );

  await header.click();
  await expect(page).toHaveURL(/sort=volatility/);
});

test("exporting keywords downloads a bom-prefixed csv", async ({ page }) => {
  await page.goto("/apps/app-1/keywords");

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Export keywords to CSV" }).click(),
  ]);

  expect(download.suggestedFilename()).toMatch(
    /^keywords-app-1-\d{4}-\d{2}-\d{2}\.csv$/,
  );
  const content = readFileSync(await download.path(), "utf8");
  expect(content.startsWith("﻿keyword,source,active,position")).toBe(true);
  expect(content.split("\r\n")[0]).toContain(
    "volatility,popularity,difficulty,opportunity",
  );
  expect(content.split("\r\n")[0]).toContain(
    "scoredAt,scoringSource,formulaVersion,confidence,capturedAt",
  );
  expect(content).toContain("APPLE_SEARCH_SIGNALS,app-store-v2,HIGH");
  expect(content.split("\r\n")[0]).toContain(
    "suggestReach,serpFlags,officialPopularity,scoreOutdated",
  );
  expect(content).toContain(
    "Apple App Store and Google Play popularity and volume scores use different public signals and are not directly comparable",
  );
});

test("score details are persistent, keyboard accessible and store specific", async ({
  page,
}) => {
  await page.goto("/apps/app-1/keywords");

  await expect(
    page.getByRole("note").filter({ hasText: "not directly comparable" }),
  ).toBeVisible();

  const appleScore = page
    .getByRole("row", { name: /focus timer/ })
    .getByRole("button", { name: /Popularity 5000.*High confidence/ });
  await appleScore.focus();
  await expect(page.getByRole("tooltip")).toContainText(
    "App Store search signals",
  );
  await expect(page.getByRole("tooltip")).toContainText("Formula app-store-v2");
  await expect(page.getByRole("tooltip")).toContainText("High confidence");
  await expect(page.getByRole("tooltip")).toContainText(
    "input completeness, not ranking accuracy",
  );
  await expect(page.getByRole("tooltip")).toContainText(
    "Estimated from the first 25 App Store results",
  );
  await expect(page.getByRole("tooltip")).not.toContainText(
    "The store suggests",
  );
  await appleScore.press("Escape");
  await expect(page.getByRole("tooltip")).toHaveCount(0);

  const playScore = page
    .getByRole("row", { name: /pomodoro/ })
    .getByRole("button", { name: /Popularity 9000.*Medium confidence/ });
  await playScore.focus();
  await expect(page.getByRole("tooltip")).toContainText(
    "Google Play suggest reach",
  );
  await playScore.press("Escape");

  const brandDifficulty = page
    .getByRole("row", { name: /pomodoro/ })
    .getByRole("button", { name: /Difficulty 70.*Medium confidence/ });
  await brandDifficulty.focus();
  await expect(
    page.getByRole("tooltip").filter({
      hasText: "A brand search: one app dominates this page.",
    }),
  ).toBeVisible();
  await brandDifficulty.press("Escape");

  const invalidTimeScore = page
    .getByRole("row", { name: /study timer/ })
    .getByRole("button", { name: /Popularity 3000.*Older formula/ });
  await invalidTimeScore.focus();
  const invalidTimeTooltip = page
    .getByRole("tooltip")
    .filter({ hasText: "Capture time unavailable" });
  await expect(invalidTimeTooltip).toBeVisible();
  await expect(invalidTimeTooltip).not.toContainText("The store suggests");
  await expect(invalidTimeTooltip).toContainText(
    "Scored by an older formula. It is rescored automatically; the new number replaces this one within a day.",
  );
  await invalidTimeScore.press("Escape");

  const opportunityScore = page
    .getByRole("row", { name: /focus timer/ })
    .getByRole("button", { name: /Opportunity \d+, strong\. Derived score/ });
  await opportunityScore.focus();
  const opportunityTooltip = page
    .getByRole("tooltip")
    .filter({ hasText: "Calculated from popularity" });
  await expect(opportunityTooltip).toBeVisible();
  await expect(opportunityTooltip).not.toContainText("Formula app-store-v2");
  await expect(opportunityTooltip).not.toContainText("confidence");
  await opportunityScore.press("Escape");

  const legacyScore = page
    .getByRole("row", { name: /productivity app/ })
    .getByRole("button", { name: /Popularity 8000.*Older formula/ });
  await legacyScore.focus();
  await expect(
    page
      .getByRole("tooltip")
      .filter({ hasText: "Legacy score — provenance unavailable" }),
  ).toBeVisible();

  const unscoredRow = page.getByRole("row", { name: /time blocking/ });
  await expect(
    unscoredRow.getByLabel("Popularity: not scored yet"),
  ).toBeVisible();
});

test("scores and positions carry their grade in colour and in words", async ({
  page,
}) => {
  await page.goto("/apps/app-1/keywords");
  const row = page.getByRole("row", { name: /pomodoro/ });

  const popularity = row.getByRole("button", { name: /^Popularity/ });
  await expect(popularity).toHaveAttribute("data-grade", "strong");
  await expect(popularity).toHaveAccessibleName(
    /Popularity \d+, (strong|fair|weak|poor)\./,
  );
  await expect(popularity).toHaveAccessibleName(
    /Popularity 9000.*Medium confidence/,
  );
  await expect(
    row.getByRole("button", { name: /^Difficulty/ }),
  ).toHaveAttribute("data-grade", "weak");
  await expect(
    row.getByRole("button", { name: /^Difficulty/ }),
  ).toHaveAccessibleName(/Difficulty 70, weak\..*Medium confidence/);
  await expect(
    row.getByRole("button", { name: /^Opportunity/ }),
  ).toHaveAttribute("data-grade", "strong");
  await expect(row.getByLabel("Position 12, weak")).toHaveAttribute(
    "data-grade",
    "weak",
  );
});

test("an unscored keyword grades nothing but its position", async ({
  page,
}) => {
  await page.goto("/apps/app-1/keywords");
  const row = page.getByRole("row", { name: /time blocking/ });

  await expect(row.getByLabel("Popularity: not scored yet")).toBeVisible();
  await expect(
    row.getByLabel("Popularity: not scored yet"),
  ).not.toHaveAttribute("data-grade", /.+/);
  await expect(row.locator("[data-grade]")).toHaveCount(1);
  await expect(row.getByLabel("Position 45, poor")).toHaveAttribute(
    "data-grade",
    "poor",
  );
});

test("searching narrows the rows, counts them and lives in the url", async ({
  page,
}) => {
  await page.goto("/apps/app-1/keywords");
  const rows = page
    .getByRole("table", { name: /Tracked keywords/ })
    .getByRole("row");
  const search = page.getByRole("textbox", { name: "Search keywords" });

  await expect(page.getByText("5 of 5 keywords")).toBeVisible();
  await search.fill("pomo");

  await expect(rows).toHaveCount(2);
  await expect(rows.nth(1)).toContainText("pomodoro");
  await expect(page.getByText("1 of 5 keywords")).toBeVisible();
  await expect(page).toHaveURL(/q=pomo/);

  await search.fill("");

  await expect(rows).toHaveCount(6);
  await expect(page).not.toHaveURL(/q=/);
});

test("a search that matches nothing offers to clear the filters", async ({
  page,
}) => {
  await page.goto("/apps/app-1/keywords?q=zzzz");

  await expect(page.getByText("No keywords match these filters")).toBeVisible();
  await expect(
    page.getByRole("columnheader", { name: "Popularity" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Clear filters" }).click();

  await expect(page).not.toHaveURL(/q=/);
  await expect(page.getByText("5 of 5 keywords")).toBeVisible();
});

test("the export follows the search", async ({ page }) => {
  await page.goto("/apps/app-1/keywords?q=pomo");

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Export keywords to CSV" }).click(),
  ]);

  const lines = readFileSync(await download.path(), "utf8")
    .split("\r\n")
    .filter((line) => line.length > 0);
  expect(lines).toHaveLength(2);
  expect(lines[1].startsWith("pomodoro,")).toBe(true);
});

test("a source facet narrows the rows and shows a removable chip", async ({
  page,
}) => {
  await page.goto("/apps/app-1/keywords");
  const rows = page
    .getByRole("table", { name: /Tracked keywords/ })
    .getByRole("row");

  await page.getByRole("button", { name: "Filter by source" }).click();
  await page.getByRole("option", { name: /Manual/ }).click();
  await page.keyboard.press("Escape");

  await expect(page).toHaveURL(/source=MANUAL/);
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(1)).toContainText("productivity app");
  await expect(page.getByText("Source: Manual")).toBeVisible();

  await page.getByRole("button", { name: "Remove Source: Manual" }).click();

  await expect(page).not.toHaveURL(/source=/);
  await expect(rows).toHaveCount(6);
});

test("the status filter keeps paused rows and clear all empties the url", async ({
  page,
}) => {
  await page.goto("/apps/app-1/keywords?q=tim");
  const rows = page
    .getByRole("table", { name: /Tracked keywords/ })
    .getByRole("row");

  await page.getByRole("combobox", { name: "Filter by status" }).click();
  await page.getByRole("option", { name: "Paused" }).click();

  await expect(page).toHaveURL(/status=paused/);
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(1)).toContainText("time blocking");
  await expect(page.getByText("Status: Paused")).toBeVisible();

  await page.getByRole("button", { name: "Clear all" }).click();

  await expect(page).not.toHaveURL(/status=|q=/);
  await expect(rows).toHaveCount(6);
});

test("a queued job says queued, not done", async ({ page }) => {
  await page.goto("/apps/app-1/keywords");

  await page.getByRole("button", { name: "Keyword actions" }).first().click();
  await page.getByRole("menuitem", { name: "Score now" }).click();

  await expect(page.getByText(/^Queued · scoring$/)).toBeVisible();
});

test("row actions reveal on keyboard focus, not only on hover", async ({
  page,
}) => {
  await page.goto("/apps/app-1/keywords");

  const action = page.getByRole("button", { name: /^View top 10 for/ }).first();
  const opacity = () =>
    action.evaluate((node) => getComputedStyle(node.parentElement!).opacity);

  expect(Number(await opacity())).toBeLessThan(0.1);
  await action.focus();
  await expect.poll(async () => Number(await opacity())).toBe(1);
});

test("the pinned columns leave the source column visible and share the row tint", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1000, height: 800 });
  await page.goto("/apps/app-1/keywords");

  const header = page.getByRole("row").first();
  await expect(header).toBeVisible();

  const gaps = await header.evaluate((row) => {
    const cells = [...row.children].map((cell) => cell.getBoundingClientRect());
    return cells
      .slice(0, -1)
      .map((cell, index) => Math.round(cells[index + 1].left - cell.right));
  });

  expect(Math.min(...gaps)).toBeGreaterThanOrEqual(0);

  await page.getByRole("checkbox", { name: "Select focus timer" }).click();

  const backgrounds = await page
    .locator('tr[data-state="selected"]')
    .evaluate((row) => {
      const painted = [...row.children]
        .map((cell) => getComputedStyle(cell).backgroundColor)
        .filter((color) => !color.startsWith("rgba(0, 0, 0, 0"));
      return { row: getComputedStyle(row).backgroundColor, painted };
    });

  expect(backgrounds.painted.length).toBeGreaterThan(0);
  for (const color of backgrounds.painted) {
    expect(color).toBe(backgrounds.row);
  }
});

test.describe("a market typed into the add keywords dialog", () => {
  const typeMarket = async (page: Page, code: string) => {
    await page.goto("/apps/app-1/keywords");
    await page.getByRole("button", { name: "Add keywords" }).first().click();
    await page.getByRole("combobox", { name: "Keyword market" }).click();
    await page.getByRole("option", { name: "Other…" }).click();
    await page
      .getByRole("textbox", { name: "Storefront country code" })
      .fill(code);
    await page.getByRole("textbox", { name: /fitness tracker/ }).fill("focus");
  };

  test("refuses a code that is not an app store storefront before sending it", async ({
    page,
  }) => {
    const probes: string[] = [];
    page.on("request", (request) => {
      if (request.url().includes("/market-availability")) {
        probes.push(request.url());
      }
    });

    await typeMarket(page, "zz");

    const code = page.getByRole("textbox", { name: "Storefront country code" });
    await expect(
      page.getByText("zz is not an App Store storefront"),
    ).toBeVisible();
    await expect(code).toHaveAttribute("aria-invalid", "true");
    await expect(code).toHaveAccessibleDescription(
      "zz is not an App Store storefront",
    );
    await expect(
      page.getByRole("dialog").getByRole("button", { name: "Add keywords" }),
    ).toBeDisabled();
    expect(probes.filter((url) => url.includes("country=zz"))).toEqual([]);
  });

  test("accepts an app store storefront outside the offered list", async ({
    page,
  }) => {
    await typeMarket(page, "xk");

    await expect(page.getByText(/is not an App Store storefront/)).toHaveCount(
      0,
    );
    await expect(
      page.getByRole("textbox", { name: "Storefront country code" }),
    ).not.toHaveAttribute("aria-invalid", "true");
    await expect(
      page.getByRole("dialog").getByRole("button", { name: "Add keywords" }),
    ).toBeEnabled();
  });
});
