import { expect, test } from "./session.mts";

test.describe.configure({ mode: "serial" });

const card = (id: string) => `[id='action-${id}']`;
const rendered = { timeout: 20_000 };
const ACT_UNCOVERED_TITLE = "Add a high-opportunity keyword to your metadata";
const MOCK_API_URL = `http://localhost:${process.env.MOCK_API_PORT ?? 4100}`;

test.beforeEach(async ({ request }) => {
  await request.post(`${MOCK_API_URL}/__reset/actions`, {
    failOnStatusCode: true,
  });
});

test("lists actions sorted by estimated impact", async ({ page }) => {
  await page.goto("/actions");

  await expect(page.getByRole("heading", { level: 2 }).first()).toHaveText(
    ACT_UNCOVERED_TITLE,
  );
  await expect(page.getByText("88", { exact: false }).first()).toBeVisible();
});

test("the summary counts agree with the listed actions", async ({
  request,
}) => {
  const summary = await request.get(`${MOCK_API_URL}/actions/summary`);
  const list = await request.get(
    `${MOCK_API_URL}/actions?status=OPEN&limit=200`,
  );

  expect(((await summary.json()) as { open: number }).open).toBe(
    ((await list.json()) as { total: number }).total,
  );
});

test("filtering by priority updates the url and survives a reload", async ({
  page,
}) => {
  await page.goto("/actions");
  await page.getByRole("button", { name: "Critical", exact: true }).click();

  await expect(page).toHaveURL(/priority=critical/);
  await expect(page.getByRole("heading", { level: 2 })).toHaveCount(1);

  await page.reload();
  await expect(page.getByRole("heading", { level: 2 })).toHaveCount(1);
});

test("evidence is reachable by keyboard and shows the stored numbers", async ({
  page,
}) => {
  await page.goto("/actions");
  const summary = page.locator(card("act-uncovered")).locator("summary");

  await expect(summary).toBeVisible();
  await summary.focus();
  await summary.press("Enter");

  await expect(
    page.locator(card("act-uncovered")).getByText("Opportunity", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.locator(card("act-uncovered")).getByText("66.5", { exact: true }),
  ).toBeVisible();
});

test("a deep link scrolls to, expands and focuses the action", async ({
  page,
}) => {
  await page.goto("/actions?action=act-market");

  const target = page.locator(card("act-market"));
  await expect(target).toBeFocused();
  await expect(target.getByText("Home market")).toBeVisible();
});

test("a degraded row explains itself without breaking the list", async ({
  page,
}) => {
  await page.goto("/actions");

  await expect(
    page.getByText(/Evidence unavailable for this stored action/),
  ).toBeVisible();
  await expect(page.getByRole("heading", { level: 2 }).first()).toBeVisible();
});

test("the header states how fresh the queue is", async ({ page }) => {
  await page.goto("/actions");

  const status = page.locator('[data-slot="action-status"]');
  await expect(status).toHaveText(
    /^11 open · 1 critical · 4 high · generated /,
  );
  await expect(status).toContainText("withheld by the per app cap");
});

test("offers Generate now exactly once, with a queue and without one", async ({
  page,
}) => {
  await page.goto("/actions");
  await expect(page.getByRole("button", { name: "Generate now" })).toHaveCount(
    1,
  );

  await page.context().addCookies([
    {
      name: "e2e_actions_ungenerated",
      value: "1",
      url: "http://localhost:3000",
    },
  ]);
  await page.goto("/actions");
  await expect(page.getByText("No actions generated yet")).toBeVisible();
  await expect(page.getByRole("button", { name: "Generate now" })).toHaveCount(
    1,
  );
});

test("the app actions page heads its section under the app name", async ({
  page,
}) => {
  await page.goto("/apps/app-1/actions");

  const headings = page.getByRole("heading");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Focus Timer",
  );
  await expect(headings.nth(1)).toHaveText("Actions");
  await expect(
    page.getByRole("heading", { level: 2, name: "Actions" }),
  ).toBeVisible();
});

test.describe("generating the queue on demand", () => {
  const cookie = (name: string, value: string) => ({
    name,
    value,
    url: "http://localhost:3000",
  });

  test("generating an empty queue follows the run until it has finished", async ({
    page,
  }) => {
    await page.context().addCookies([cookie("e2e_actions_ungenerated", "1")]);
    await page.goto("/actions");

    await expect(page.getByText("No actions generated yet")).toBeVisible();
    await page.getByRole("button", { name: "Generate now" }).click();

    await expect(page.getByText("Nothing to do right now")).toBeVisible();
    await expect(page.getByText(/^Last generated /)).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Generate now" }),
    ).toBeEnabled();
  });

  test("a queue that was generated empty can be generated again", async ({
    page,
  }) => {
    await page
      .context()
      .addCookies([
        cookie("e2e_actions_ungenerated", "1"),
        cookie("actions_generated_at", "2026-07-30T03:00:00.000Z"),
      ]);
    await page.goto("/actions");

    await expect(page.getByText("Nothing to do right now")).toBeVisible();
    const lastGenerated = page.getByText(/^Last generated /);
    const before = await lastGenerated.textContent();
    await page.getByRole("button", { name: "Generate now" }).click();

    await expect(
      page.getByRole("button", { name: "Generating…" }),
    ).toBeDisabled();
    await expect(lastGenerated).not.toHaveText(before ?? "");
    await expect(
      page.getByRole("button", { name: "Generate now" }),
    ).toBeEnabled();
  });
});

test("an empty filter combination offers to clear the filters", async ({
  page,
}) => {
  await page.goto("/actions?status=RESOLVED");

  await expect(page.getByText("No actions match these filters")).toBeVisible();
  await page.getByRole("button", { name: "Clear filters" }).click();
  await expect(page.getByRole("heading", { level: 2 }).first()).toBeVisible();
});

test("a two status filter with no matches offers to clear the filters", async ({
  page,
}) => {
  await page.goto("/apps/app-2/actions?status=DONE,RESOLVED");

  await expect(page.getByText("No actions match these filters")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Clear filters" }),
  ).toBeVisible();
});

test("undoing done brings the action back without a reopen badge", async ({
  page,
}) => {
  await page.goto("/actions");
  const row = page.locator(card("act-audit"));
  await row.getByRole("button", { name: "Done" }).click();
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(row).toBeVisible();
  await expect(row.getByText(/Reopened/)).toHaveCount(0);
});

test("the app overview counts only that app's actions", async ({ page }) => {
  await page.goto("/apps/app-1");
  const card = page
    .getByText("Top actions", { exact: true })
    .locator("xpath=ancestor::*[@data-slot='card'][1]");
  await expect(card.getByText("3 High", { exact: true })).toBeVisible();
  await expect(card.getByText("5 High", { exact: true })).toHaveCount(0);
});

test("the app overview leaves snoozed actions out of its open counts", async ({
  page,
}) => {
  await page.goto("/apps/app-1");
  const card = page
    .getByText("Top actions", { exact: true })
    .locator("xpath=ancestor::*[@data-slot='card'][1]");
  await expect(card.getByText("3 High", { exact: true })).toBeVisible();
  await expect(card.getByText("4 High", { exact: true })).toHaveCount(0);
});

test("a failing update rolls the optimistic change back", async ({ page }) => {
  await page.goto("/actions");
  const failing = page.locator(card("act-degraded"));

  await failing.getByRole("button", { name: "Done" }).click();

  await expect(failing).toBeVisible();
});

test("snoozing sets a wake date on the card", async ({ page }) => {
  await page.goto("/actions");
  const target = page.locator(card("act-audit"));

  await expect(target).toBeVisible(rendered);
  await target.getByRole("button", { name: "Snooze" }).click();
  await page.getByRole("menuitem", { name: "7 days" }).click();

  await expect(
    page.locator(card("act-audit")).getByRole("button", { name: /Wakes/ }),
  ).toBeVisible();
});

test("dismissing removes the card and it stays gone after a reload", async ({
  page,
}) => {
  await page.goto("/actions");
  const heading = page.getByRole("heading", {
    name: "Investigate a new negative review theme",
  });
  await expect(heading).toBeVisible();

  await page
    .locator(card("act-reviews"))
    .getByRole("button", { name: "Dismiss" })
    .click();
  await expect(heading).toHaveCount(0);

  await page.reload();
  await expect(heading).toHaveCount(0);
});

test("a dismissed action can be reopened from the dismissed filter", async ({
  page,
}) => {
  await page.goto("/actions?status=DISMISSED");

  const target = page.locator(card("act-dismissed"));
  await expect(target).toBeVisible();
  await target.getByRole("button", { name: "Reopen" }).click();

  await expect(page.getByText("Action reopened")).toBeVisible();
});

test("renders without horizontal overflow on a narrow dark viewport", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/actions");

  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 1,
  );
  expect(overflow).toBe(false);
});

test("the portfolio dashboard links into the action center", async ({
  page,
}) => {
  await page.goto("/");

  await expect(page.getByText("Top actions")).toBeVisible();
  await page.getByRole("link", { name: "Open the Action Center" }).click();

  await expect(page).toHaveURL(/\/actions$/);
});

test("the header indicator reaches the action center and hides at zero", async ({
  page,
}) => {
  await page.goto("/");

  const indicator = page.getByRole("link", { name: /open actions?$/ });
  await expect(indicator).toBeVisible();
  await indicator.click();

  await expect(page).toHaveURL(/\/actions$/);
});

test("the command palette reaches the action center", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Open command palette" }).click();
  await page.getByRole("option", { name: "Action Center" }).click();

  await expect(page).toHaveURL(/\/actions$/);
});

test("the app detail nav exposes an actions section", async ({ page }) => {
  await page.goto("/apps/app-1");

  await expect(page.getByText("Top actions")).toBeVisible();
  await page.getByRole("link", { name: "Actions", exact: true }).click();

  await expect(page).toHaveURL(/\/apps\/app-1\/actions/);
  await expect(
    page
      .locator(card("act-uncovered"))
      .getByRole("heading", { level: 2, name: ACT_UNCOVERED_TITLE }),
  ).toBeVisible(rendered);
});

test("hides the AI explain control when no key is configured", async ({
  page,
}) => {
  await page.goto("/actions");

  await expect(page.getByRole("heading", { level: 2 }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Explain" })).toHaveCount(0);
});
