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
    "High · 6",
    "Medium · 10",
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
    "Focus Timer · US · 17",
    "Tomato Clock · DE · 2",
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
  await expect(page.locator("#queue h3").first()).toBeVisible();

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

test.describe("closing several actions at once", () => {
  const select = (page: import("@playwright/test").Page, id: string) =>
    page.locator(card(id)).getByRole("checkbox").click();
  const openTile = (page: import("@playwright/test").Page) =>
    page.locator('[data-slot="stat-tile"]').first();

  test("marks the selected rows done in one go", async ({ page }) => {
    await page.goto("/actions");
    await expect(openTile(page)).toContainText("18");
    await select(page, "act-prune");
    await select(page, "act-volatile");

    const bar = page.getByRole("toolbar", { name: "Bulk actions" });
    await expect(bar).toContainText("2 selected");
    await bar.getByRole("button", { name: "Done" }).click();

    await expect(page.locator(card("act-prune"))).toHaveCount(0);
    await expect(page.locator(card("act-volatile"))).toHaveCount(0);
    await expect(page.getByText("Marked 2 done")).toBeVisible();
    await expect(openTile(page)).toContainText("16");
  });

  test("Undo brings the closed rows back", async ({ page }) => {
    await page.goto("/actions");
    await select(page, "act-prune");
    await select(page, "act-volatile");
    await page
      .getByRole("toolbar", { name: "Bulk actions" })
      .getByRole("button", { name: "Done" })
      .click();
    await page.getByRole("button", { name: "Undo" }).click();

    await expect(page.locator(card("act-prune"))).toBeVisible();
    await expect(page.locator(card("act-volatile"))).toBeVisible();
    await expect(
      page.locator(card("act-prune")).getByText(/Reopened/),
    ).toHaveCount(0);
  });

  test("a partly selected group shows a dash, not a check", async ({
    page,
  }) => {
    await page.goto("/actions");
    await select(page, "act-prune");

    const group = page
      .locator('[data-slot="action-group"]')
      .filter({ has: page.locator(card("act-prune")) })
      .getByRole("checkbox", { name: /^Select all in / });
    await expect(group).toHaveAttribute("aria-checked", "mixed");
    await expect(group.locator("svg.lucide-minus")).toBeVisible();
    await expect(group.locator("svg.lucide-check")).toBeHidden();
  });

  test("a selection that a filter hides no longer counts", async ({ page }) => {
    await page.goto("/actions");
    await select(page, "act-prune");
    await expect(
      page.getByRole("toolbar", { name: "Bulk actions" }),
    ).toBeVisible();

    await page.getByRole("button", { name: /^Critical/ }).click();

    await expect(
      page.getByRole("toolbar", { name: "Bulk actions" }),
    ).toHaveCount(0);
  });

  test("a failing bulk request rolls the rows back", async ({ page }) => {
    await page.goto("/actions");
    await select(page, "act-prune");
    await select(page, "act-degraded");
    await page
      .getByRole("toolbar", { name: "Bulk actions" })
      .getByRole("button", { name: "Done" })
      .click();

    await expect(page.locator(card("act-prune"))).toBeVisible();
    await expect(page.locator(card("act-degraded"))).toBeVisible();
  });

  test("the bar stays on a phone screen with tappable buttons", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/actions");
    await select(page, "act-prune");

    const bar = page.getByRole("toolbar", { name: "Bulk actions" });
    const box = await bar.boundingBox();
    expect(
      (box?.x ?? -1) >= 0 && (box?.x ?? 0) + (box?.width ?? 0) <= 375,
    ).toBe(true);
    for (const button of await bar.getByRole("button").all()) {
      expect((await button.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(
        44,
      );
    }
  });
});

test.describe("working the queue from the keyboard", () => {
  test("j moves focus down the rows", async ({ page }) => {
    await page.goto("/actions");
    const rows = page.locator(ROWS);
    await rows.first().focus();

    await page.keyboard.press("j");
    await page.keyboard.press("j");

    await expect(rows.nth(2)).toBeFocused();
  });

  test("Enter opens the focused row and Escape returns to it", async ({
    page,
  }) => {
    await page.goto("/actions");
    const first = page.locator(ROWS).first();
    await first.focus();

    await page.keyboard.press("Enter");
    await expect(page.getByRole("dialog")).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(first).toBeFocused();
  });

  test("Escape before the url catches up stays on the action center", async ({
    page,
  }) => {
    await page.clock.install();
    await page.goto("/settings");
    await page.goto("/actions");
    const first = page.locator(ROWS).first();
    await first.focus();
    await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 1_000);

    await page.keyboard.press("Enter");
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    await page.clock.resume();

    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page).toHaveURL(/\/actions$/);
    await expect(first).toBeFocused();
  });

  test("d marks the focused row done and focuses the next one", async ({
    page,
  }) => {
    await page.goto("/actions");
    const rows = page.locator(ROWS);
    await rows.nth(1).focus();
    const secondId = await rows.nth(1).getAttribute("id");
    const thirdId = await rows.nth(2).getAttribute("id");

    await page.keyboard.press("d");

    await expect(page.locator(`[id='${secondId}']`)).toHaveCount(0);
    await expect(page.locator(`[id='${thirdId}']`)).toBeFocused();
  });

  test("typing in the search box never moves the focus", async ({ page }) => {
    await page.goto("/actions");
    const search = page.getByRole("textbox", { name: "Search actions" });
    await search.fill("");
    await search.press("j");

    await expect(search).toHaveValue("j");
    await expect(search).toBeFocused();
  });

  test("? shows the keyboard shortcuts", async ({ page }) => {
    await page.goto("/actions");
    await page.locator(ROWS).first().focus();

    await page.keyboard.press("Shift+?");

    await expect(
      page.getByRole("dialog", { name: "Keyboard shortcuts" }),
    ).toBeVisible();
  });
});
