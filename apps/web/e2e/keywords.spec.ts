import { readFileSync } from "node:fs";
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

  await page.getByRole("button", { name: "Traffic", exact: true }).click();

  await expect(page).toHaveURL(/sort=traffic/);
  await expect(firstKeyword).toContainText("pomodoro");
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
    "scoredAt,scoringSource,formulaVersion,confidence,capturedAt",
  );
  expect(content).toContain("APPLE_SUGGEST_SEARCH,app-store-v1,HIGH");
  expect(content).toContain(
    "Apple App Store and Google Play traffic and volume scores use different public signals and are not directly comparable",
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
    .getByRole("button", { name: /Traffic 5000.*High confidence/ });
  await appleScore.focus();
  await expect(page.getByRole("tooltip")).toContainText(
    "Apple suggest and search",
  );
  await expect(page.getByRole("tooltip")).toContainText("Formula app-store-v1");
  await expect(page.getByRole("tooltip")).toContainText("High confidence");
  await expect(page.getByRole("tooltip")).toContainText(
    "input completeness, not ranking accuracy",
  );
  await appleScore.press("Escape");
  await expect(page.getByRole("tooltip")).toHaveCount(0);

  const playScore = page
    .getByRole("row", { name: /pomodoro/ })
    .getByRole("button", { name: /Traffic 9000.*Medium confidence/ });
  await playScore.focus();
  await expect(page.getByRole("tooltip")).toContainText(
    "Google Play prefix suggest and search",
  );
  await playScore.press("Escape");

  const invalidTimeScore = page
    .getByRole("row", { name: /study timer/ })
    .getByRole("button", { name: /Traffic 3000.*Low confidence/ });
  await invalidTimeScore.focus();
  await expect(
    page.getByRole("tooltip").filter({ hasText: "Capture time unavailable" }),
  ).toBeVisible();
  await invalidTimeScore.press("Escape");

  const opportunityScore = page
    .getByRole("row", { name: /focus timer/ })
    .getByRole("button", { name: /Opportunity \d+\. Derived score/ });
  await opportunityScore.focus();
  const opportunityTooltip = page
    .getByRole("tooltip")
    .filter({ hasText: "Calculated from traffic" });
  await expect(opportunityTooltip).toBeVisible();
  await expect(opportunityTooltip).not.toContainText("Formula app-store-v1");
  await expect(opportunityTooltip).not.toContainText("confidence");
  await opportunityScore.press("Escape");

  const legacyScore = page
    .getByRole("row", { name: /productivity app/ })
    .getByRole("button", { name: /Traffic 8000.*Legacy score/ });
  await legacyScore.focus();
  await expect(
    page
      .getByRole("tooltip")
      .filter({ hasText: "Legacy score — provenance unavailable" }),
  ).toBeVisible();

  const unscoredRow = page.getByRole("row", { name: /time blocking/ });
  await expect(unscoredRow.getByLabel("Traffic: not scored yet")).toBeVisible();
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
