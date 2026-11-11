import type { Page } from "@playwright/test";
import {
  FIRST_CHECK_POLL_LIMIT,
  FIRST_CHECK_POLL_MS,
} from "../src/lib/keyword-checks";
import { expect, test } from "./session.mts";
import {
  FAILING_KEYWORD,
  INSPECTED_APPS,
  INSPECTION_FAILURE,
  QUEUED_KEYWORD,
} from "./keyword-inspections-mock.mts";

test.describe.configure({ mode: "serial" });

const MOCK_API = "http://localhost:4100";

test.beforeEach(async ({ page, request }) => {
  await request.get(`${MOCK_API}/__reset-keyword-inspections`);
  await page.clock.install();
});

const nextPoll = (page: Page) => page.clock.runFor(FIRST_CHECK_POLL_MS);

test("inspects a keyword and shows its scores and results", async ({
  page,
}) => {
  await page.goto("/inspect");
  await expect(
    page.getByRole("heading", { name: "Keyword inspector", level: 1 }),
  ).toBeVisible();

  await page.getByLabel("Keyword", { exact: true }).fill("Habit Tracker");
  await page.getByRole("button", { name: "Inspect", exact: true }).click();

  await expect(page).toHaveURL(/[?&]id=inspection-1/);
  await nextPoll(page);
  const results = page.getByRole("table");
  await expect(results.getByText(INSPECTED_APPS[0])).toBeVisible();
  await expect(
    results.getByRole("cell", { name: "Exact phrase" }),
  ).toBeVisible();
  await expect(
    page.getByRole("listitem").filter({ hasText: "habit tracker app" }),
  ).toBeVisible();
  await expect(page.getByText("High confidence")).toBeVisible();
  await expect(
    page.getByRole("button", { name: /habit tracker/ }).first(),
  ).toBeVisible();
});

test("compares a second inspection of a keyword with the first", async ({
  page,
}) => {
  await page.goto("/inspect");
  await page.getByLabel("Keyword", { exact: true }).fill("habit tracker");
  await page.getByRole("button", { name: "Inspect", exact: true }).click();
  await expect(page).toHaveURL(/[?&]id=inspection-1/);
  await nextPoll(page);
  await expect(
    page.getByRole("table").getByText(INSPECTED_APPS[0]),
  ).toBeVisible();

  await page.getByRole("button", { name: "Inspect", exact: true }).click();

  await expect(page).toHaveURL(/[?&]id=inspection-2/);
  await nextPoll(page);
  const change = page.getByRole("region", {
    name: "Since the previous inspection",
  });
  await expect(change).toContainText("+4");
  await expect(change).toContainText("−6");
  await expect(change).toContainText("(better)");
});

test("shows why an inspection did not finish and offers another try", async ({
  page,
}) => {
  await page.goto("/inspect");
  await page.getByLabel("Keyword", { exact: true }).fill(FAILING_KEYWORD);
  await page.getByRole("button", { name: "Inspect", exact: true }).click();
  await expect(page).toHaveURL(/[?&]id=inspection-1/);
  await nextPoll(page);

  const failure = page.getByRole("alert").filter({
    hasText: "This inspection did not finish.",
  });
  await expect(failure).toContainText(INSPECTION_FAILURE);
  await expect(
    failure.getByRole("button", { name: "Try again" }),
  ).toBeVisible();
});

test("offers a manual check once a queued inspection stops polling", async ({
  page,
  request,
}) => {
  await page.goto("/inspect");
  await page.getByLabel("Keyword", { exact: true }).fill(QUEUED_KEYWORD);
  await page.getByRole("button", { name: "Inspect", exact: true }).click();
  await expect(page).toHaveURL(/[?&]id=inspection-1/);

  const checkAgain = page.getByRole("button", { name: "Check again" });
  for (let poll = 0; poll < FIRST_CHECK_POLL_LIMIT; poll += 1) {
    if (await checkAgain.isVisible()) break;
    const read = page
      .waitForResponse(
        (response) =>
          response.url().includes("/keyword-inspections/inspection-1"),
        { timeout: 5_000 },
      )
      .catch(() => null);
    await nextPoll(page);
    await read;
  }
  await expect(page.getByText(/Waiting for the store queue/)).toBeVisible();
  await expect(checkAgain).toBeVisible();
  await request.get(`${MOCK_API}/__release-keyword-inspections`);

  await checkAgain.click();

  await expect(
    page.getByRole("table").getByText(INSPECTED_APPS[0]),
  ).toBeVisible();
  await expect(checkAgain).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: `“${QUEUED_KEYWORD}”`, level: 2 }),
  ).toBeFocused();
});

test("deletes an inspection and returns focus to the keyword box", async ({
  page,
}) => {
  await page.goto("/inspect");
  await page.getByLabel("Keyword", { exact: true }).fill("water reminder");
  await page.getByRole("button", { name: "Inspect", exact: true }).click();
  await expect(page).toHaveURL(/[?&]id=inspection-1/);

  await page
    .getByRole("button", {
      name: /^Delete the inspection of water reminder in App Store /,
    })
    .click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Delete", exact: true })
    .click();

  await expect(
    page.getByRole("button", {
      name: /^Delete the inspection of water reminder in /,
    }),
  ).toHaveCount(0);
  await expect(page.getByText("No inspection selected")).toBeVisible();
  await expect(page.getByLabel("Keyword", { exact: true })).toBeFocused();
});
