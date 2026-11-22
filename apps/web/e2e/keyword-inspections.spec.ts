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
import {
  SEEDED_ID,
  SEEDED_KEYWORD,
  SEEDED_PLAY_ID,
} from "./keyword-inspection-fixtures.mts";

test.describe.configure({ mode: "serial" });

const MOCK_API = `http://localhost:${process.env.MOCK_API_PORT ?? 4100}`;

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

const seededPage = (id: string) =>
  `/inspect?id=${id}&keyword=${encodeURIComponent(SEEDED_KEYWORD)}&store=APP_STORE&country=us`;

test("reads an inspection at a glance: grades, verdict and evidence", async ({
  page,
  request,
}) => {
  await request.get(`${MOCK_API}/__seed-keyword-inspections`);
  await page.goto(seededPage(SEEDED_ID));

  const scores = page.getByRole("definition").filter({ hasText: "was 42" });
  await expect(scores).toContainText("fair");
  await expect(
    page.getByRole("article").getByText("Worth fighting for", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(
      "Autocomplete suggests it in position 1 after 5 typed characters",
    ),
  ).toBeVisible();
  await expect(
    page.getByText("Each inspection reads the store once."),
  ).toBeVisible();

  const competition = page.getByRole("region", {
    name: "Competition in the top 10",
  });
  await expect(competition).toContainText("Newcomers");
  await expect(competition).toContainText("2 of 10");

  const change = page.getByRole("region", {
    name: "Since the previous inspection",
  });
  await expect(change).toContainText("Routine Builder entered the top 10");
  await expect(change).toContainText("Habit Journal Plus left the top 10");
  await expect(change).toContainText("+4");

  const results = page.getByRole("table");
  await expect(results.getByRole("row")).toHaveCount(11);
  await expect(results).toContainText("updated 3 days ago");
  await page.getByRole("button", { name: "Show all 12 results" }).click();
  await expect(results.getByRole("row")).toHaveCount(13);
});

test("opens the inspection of a point pressed on the map", async ({
  page,
  request,
}) => {
  await request.get(`${MOCK_API}/__seed-keyword-inspections`);
  await page.goto("/inspect?store=APP_STORE&country=us");

  const map = page.getByRole("region", { name: "Keyword map" });
  const dot = map.getByRole("button", { name: /^mood journal, popularity/ });
  await dot.click();

  await expect(page).toHaveURL(/[?&]id=seeded-mood-journal/);
  await expect(dot).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByLabel("Keyword", { exact: true })).toHaveValue(
    "mood journal",
  );
});

test("lists every inspection with its state and storefront", async ({
  page,
  request,
}) => {
  await request.get(`${MOCK_API}/__seed-keyword-inspections`);
  await page.goto(seededPage(SEEDED_ID));

  const log = page.getByRole("region", { name: "All inspections" });
  await expect(log).toContainText("15 · latest 50");
  await expect(
    log.getByRole("listitem").filter({ hasText: "store timeout" }),
  ).toContainText("Failed");
  await expect(
    log.getByRole("listitem").filter({ hasText: "sleep sounds" }),
  ).toContainText("Running");
  await expect(
    log
      .getByRole("button", { name: /habit tracker/ })
      .and(page.locator('[aria-current="true"]')),
  ).toContainText("App Store · US");
});

test("opens the same keyword in another storefront", async ({
  page,
  request,
}) => {
  await request.get(`${MOCK_API}/__seed-keyword-inspections`);
  await page.goto(seededPage(SEEDED_ID));

  await page
    .getByRole("button", { name: "Google Play · US", exact: true })
    .focus();
  await page.keyboard.press("Enter");

  await expect(page).toHaveURL(new RegExp(`[?&]id=${SEEDED_PLAY_ID}`));
  await expect(
    page.getByRole("heading", { name: `“${SEEDED_KEYWORD}”`, level: 2 }),
  ).toBeFocused();
  await expect(page.getByText("Google Play · US").first()).toBeVisible();
});

test("keeps focus in the panel when another storefront's inspection is gone", async ({
  page,
  request,
}) => {
  await request.get(`${MOCK_API}/__seed-keyword-inspections`);
  await page.route(
    new RegExp(`/api/backend/keyword-inspections/${SEEDED_PLAY_ID}$`),
    (route) => route.fulfill({ status: 404, json: { statusCode: 404 } }),
  );
  await page.goto(seededPage(SEEDED_ID));
  await page
    .getByRole("button", { name: "Google Play · US", exact: true })
    .focus();
  await page.keyboard.press("Enter");

  await expect(
    page.getByText("This inspection no longer exists"),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Inspection", level: 2, exact: true }),
  ).toBeFocused();
});

test("compares a repeat with the seeded inspection and reuses a seeded run", async ({
  page,
  request,
}) => {
  await request.get(`${MOCK_API}/__seed-keyword-inspections`);
  await page.goto("/inspect");
  await page.getByLabel("Keyword", { exact: true }).fill(SEEDED_KEYWORD);
  await page.getByRole("button", { name: "Inspect", exact: true }).click();
  await expect(page).toHaveURL(/[?&]id=inspection-1/);
  await nextPoll(page);

  const scores = page.getByRole("definition");
  await expect(scores.filter({ hasText: "was 46" })).toHaveCount(1);
  await expect(scores.filter({ hasText: "was 38" })).toHaveCount(1);

  await page.getByLabel("Keyword", { exact: true }).fill("sleep sounds");
  await page.getByRole("button", { name: "Inspect", exact: true }).click();
  await expect(page).toHaveURL(/[?&]id=seeded-sleep-sounds/);
});
