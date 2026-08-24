import { expect, test } from "./session.mts";

test.describe.configure({ mode: "serial" });

const card = (id: string) => `[id='action-${id}']`;
const rendered = { timeout: 20_000 };
const ACT_UNCOVERED_TITLE = "Add a high-opportunity keyword to your metadata";
const MOCK_API_URL = `http://localhost:${process.env.MOCK_API_PORT ?? 4100}`;

test.beforeEach(async ({ request }) => {
  await request.post(`${MOCK_API_URL}/__reset`);
});

test("lists actions sorted by estimated impact", async ({ page }) => {
  await page.goto("/actions");

  await expect(page.getByRole("heading", { level: 2 }).first()).toHaveText(
    ACT_UNCOVERED_TITLE,
  );
  await expect(page.getByText("88", { exact: false }).first()).toBeVisible();
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

test("an empty filter combination offers to clear the filters", async ({
  page,
}) => {
  await page.goto("/actions?status=RESOLVED");

  await expect(page.getByText("No actions match these filters")).toBeVisible();
  await page.getByRole("button", { name: "Clear filters" }).click();
  await expect(page.getByRole("heading", { level: 2 }).first()).toBeVisible();
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
