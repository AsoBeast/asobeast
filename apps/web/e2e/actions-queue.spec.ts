import { expect, test } from "./session.mts";

test.describe.configure({ mode: "serial" });

const MOCK_API_URL = `http://localhost:${process.env.MOCK_API_PORT ?? 4100}`;
const card = (id: string) => `[id='action-${id}']`;
const ROWS = "#queue li[id^='action-']";

test.beforeEach(async ({ request }) => {
  await request.post(`${MOCK_API_URL}/__reset/actions`, {
    failOnStatusCode: true,
  });
});

test("the queue groups by priority from critical to low", async ({ page }) => {
  await page.goto("/actions");

  await expect(page.locator("#queue h3")).toHaveText([
    "Critical · 1",
    "High · 5",
    "Medium · 4",
    "Low · 2",
  ]);
  const high = page.locator('[data-slot="action-group"]').nth(1);
  await expect(
    page.locator(card("act-snoozed")).getByText(/^Snoozed until/),
  ).toBeVisible();
  await expect(high.locator(card("act-snoozed"))).toHaveCount(1);
});

test("the queue groups by app on the workspace page only", async ({ page }) => {
  await page.goto("/actions?group=app");
  await expect(page.locator("#queue h3")).toHaveText([
    "Focus Timer · US · 11",
    "Tomato Clock · DE · 1",
  ]);

  await page.goto("/apps/app-1/actions");
  await page.getByRole("combobox", { name: "Group by" }).click();
  await expect(page.getByRole("option", { name: "App" })).toHaveCount(0);
});

test("sorting by newest orders each group by first sighting", async ({
  page,
}) => {
  await page.goto("/actions?sort=newest&group=category");

  const metadata = page
    .locator('[data-slot="action-group"]')
    .filter({ has: page.getByRole("heading", { name: /^Metadata/ }) });
  await expect(metadata.locator("li").first()).toHaveAttribute(
    "id",
    "action-act-uncovered",
  );
});

test("marking done removes the row and moves focus to the next one", async ({
  page,
}) => {
  await page.goto("/actions");
  const row = page.locator(card("act-audit"));
  const next = page.locator(ROWS).nth(
    await page
      .locator(ROWS)
      .evaluateAll((rows) =>
        rows.findIndex((entry) => entry.id === "action-act-audit"),
      )
      .then((index) => index + 1),
  );
  const nextId = await next.getAttribute("id");

  await row.getByRole("button", { name: "Done" }).click();

  await expect(row).toHaveCount(0);
  await expect(page.locator(`[id='${nextId}']`)).toBeFocused();
});

test("row buttons are large enough to tap on a phone", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/actions");

  const row = page.locator(ROWS).first();
  for (const button of await row.getByRole("button").all()) {
    if (!(await button.isVisible())) continue;
    expect((await button.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(
      44,
    );
  }
  const link = row.getByRole("link");
  const lineHeight = await link.evaluate((element) =>
    Number.parseFloat(getComputedStyle(element).lineHeight),
  );
  expect((await link.boundingBox())?.height ?? 0).toBeLessThanOrEqual(
    lineHeight * 2 + 1,
  );
});

test("the queue sits under a queue heading with group headings below it", async ({
  page,
}) => {
  await page.goto("/actions");

  const levels = await page.evaluate(() =>
    Array.from(document.querySelectorAll("main h1, main h2, main h3")).map(
      (heading) => `${heading.tagName}:${heading.textContent}`,
    ),
  );
  expect(levels.slice(0, 3)).toEqual([
    "H1:Action Center",
    "H2:Queue",
    "H3:Critical · 1",
  ]);
});
