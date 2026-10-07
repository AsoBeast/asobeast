import { expect, test } from "./session.mts";

test.describe.configure({ mode: "serial" });

const MOCK_API_URL = `http://localhost:${process.env.MOCK_API_PORT ?? 4100}`;
const card = (id: string) => `[id='action-${id}']`;
const UNCOVERED = 'Add "habit tracker" to your metadata';

test.beforeEach(async ({ request }) => {
  await request.post(`${MOCK_API_URL}/__reset/actions`, {
    failOnStatusCode: true,
  });
});

test("a headline opens the sheet in place and Back closes it", async ({
  page,
}) => {
  await page.goto("/actions");
  const documents: string[] = [];
  page.on("request", (request) => {
    if (request.resourceType() === "document") documents.push(request.url());
  });

  await page.getByRole("link", { name: UNCOVERED }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page).toHaveURL(/action=act-uncovered/);
  expect(documents).toEqual([]);

  await page.goBack();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page).not.toHaveURL(/action=/);
});

test("Escape closes the sheet, Back keeps it closed, focus returns to the card", async ({
  page,
}) => {
  await page.goto("/actions");
  await page.getByRole("link", { name: UNCOVERED }).click();
  await expect(page.getByRole("dialog")).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator(card("act-uncovered"))).toBeFocused();

  await page.goBack();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("the sheet links to the workspace that fixes the action", async ({
  page,
}) => {
  await page.goto("/actions?action=act-uncovered");

  await expect(
    page.getByRole("link", { name: "Fix it in Metadata" }),
  ).toHaveAttribute("href", "/apps/app-1/metadata?keyword=kw-1");
});

test("the sheet writes out the steps and ends with the confirmation", async ({
  page,
}) => {
  await page.goto("/actions?action=act-uncovered");

  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("heading", { name: "How to fix" }),
  ).toBeVisible();
  const steps = dialog
    .getByRole("heading", { name: "How to fix" })
    .locator("xpath=..")
    .locator("ol > li");
  expect(await steps.count()).toBeGreaterThanOrEqual(3);
  await expect(steps.last()).toHaveText(/^AsoBeast confirms the fix/);
});

test("a deep link to an action outside the list still opens it", async ({
  page,
}) => {
  await page.goto("/actions?action=act-done-confirmed");

  await expect(
    page.getByRole("dialog").getByRole("heading", { level: 2 }),
  ).toHaveText('Add "focus music" to your metadata');
});

test("a deep link to a missing action says so", async ({ page }) => {
  await page.goto("/actions?action=does-not-exist");

  await expect(
    page.getByText(
      "This action no longer exists. It may have been pruned after 180 days.",
    ),
  ).toBeVisible();
});

test("the sheet covers a phone screen without a sideways scroll", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/actions?action=act-uncovered");

  const dialog = await page.getByRole("dialog").boundingBox();
  expect(dialog?.width ?? 0).toBeCloseTo(375, 0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test("the sheet charts the metric behind the action", async ({ page }) => {
  await page.goto("/actions?action=act-uncovered");

  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: "Trend" })).toBeVisible();
  const chart = dialog.getByRole("region", { name: "Position over time" });
  await expect(chart.locator("svg").first()).toBeVisible();
  await expect(chart.getByText("Opened")).toBeVisible();
});

test("an action without readable evidence has no trend", async ({ page }) => {
  await page.goto("/actions?action=act-degraded");

  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("heading", { name: "How to fix" }),
  ).toBeVisible();
  await expect(dialog.getByRole("heading", { name: "Trend" })).toHaveCount(0);
});

test("the history names who dismissed an action and why", async ({ page }) => {
  await page.goto("/actions?status=DISMISSED&action=act-dismissed");

  const history = page
    .getByRole("dialog")
    .getByRole("heading", { name: "History" })
    .locator("xpath=..");
  await expect(
    history.getByText("Dismissed", { exact: false }).first(),
  ).toBeVisible();
  await expect(history.getByText(/Not relevant to this app/)).toBeVisible();
  await expect(history.getByText(/Anna/)).toBeVisible();
});

test("a confirmed fix shows its measured outcome", async ({ page }) => {
  await page.goto("/actions?action=act-done-confirmed");

  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: "Outcome" })).toBeVisible();
  await expect(dialog.getByText(/#16 → #7/)).toBeVisible();
  await expect(dialog.getByText("Improved", { exact: true })).toBeVisible();
  await expect(
    dialog.getByText(
      "Other changes in the same days can also move this number.",
    ),
  ).toBeVisible();
});

test("a fresh fix is still being measured", async ({ page }) => {
  await page.goto("/actions?action=act-done-verifying");

  await expect(
    page.getByRole("dialog").getByText("Measuring", { exact: true }),
  ).toBeVisible();
});

test("a note is saved and kept after a reload", async ({ page }) => {
  await page.goto("/actions?action=act-audit");
  const note = page.getByRole("textbox", { name: "Note for this action" });

  await note.fill("Waiting on the new screenshots");
  await page.getByRole("button", { name: "Save note" }).click();
  await expect(page.getByText("Note saved")).toBeVisible();

  await page.reload();
  await expect(
    page.getByRole("textbox", { name: "Note for this action" }),
  ).toHaveValue("Waiting on the new screenshots");
});

test("a note of 500 emoji counts as 500 and one more is refused", async ({
  page,
}) => {
  await page.goto("/actions?action=act-audit");
  const note = page.getByRole("textbox", { name: "Note for this action" });
  const save = page.getByRole("button", { name: "Save note" });

  await note.fill("😀".repeat(500));
  await expect(note).toHaveValue("😀".repeat(500));
  await expect(page.getByText("500 / 500", { exact: true })).toBeVisible();
  await expect(save).toBeEnabled();

  await note.fill("😀".repeat(501));
  await expect(
    page.getByText("501 / 500 · 1 over the limit", { exact: true }),
  ).toBeVisible();
  await expect(note).toHaveAttribute("aria-invalid", "true");
  await expect(save).toBeDisabled();
});

test("a row shows that its action has a note", async ({ page }) => {
  await page.goto("/actions?action=act-audit");
  await page
    .getByRole("textbox", { name: "Note for this action" })
    .fill("Check with design");
  await page.getByRole("button", { name: "Save note" }).click();
  await expect(page.getByText("Note saved")).toBeVisible();
  await page.keyboard.press("Escape");

  await expect(
    page.locator(card("act-audit")).getByText("Has a note"),
  ).toBeAttached();
});

test("a dismissal keeps its reason in the history", async ({ page }) => {
  await page.goto("/actions");
  await page
    .locator(card("act-prune"))
    .getByRole("button", { name: "Dismiss" })
    .click();
  await page.getByRole("menuitem", { name: "The data looks wrong" }).click();
  await expect(page.locator(card("act-prune"))).toHaveCount(0);

  await page.goto("/actions?status=DISMISSED&action=act-prune");
  const history = page
    .getByRole("dialog")
    .getByRole("heading", { name: "History" })
    .locator("xpath=..");
  await expect(history.getByText(/The data looks wrong/)).toBeVisible();
});
