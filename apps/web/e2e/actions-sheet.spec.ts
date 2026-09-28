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

  const steps = page.getByRole("dialog").getByRole("listitem");
  expect(await steps.count()).toBeGreaterThanOrEqual(3);
  await expect(steps.last()).toHaveText(/^asobeast confirms the fix/);
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
  expect(dialog?.width).toBe(375);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
