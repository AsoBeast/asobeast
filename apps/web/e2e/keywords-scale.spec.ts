import { expect, test } from "./session.mts";
import { BULK_KEYWORD_COUNT } from "./fixtures.mts";

test("a five hundred keyword workspace reports its full size", async ({
  page,
}) => {
  await page.goto("/apps/app-bulk/keywords");
  await page.waitForLoadState("networkidle");

  await expect(
    page.getByText(String(BULK_KEYWORD_COUNT), { exact: true }).first(),
  ).toBeVisible();
  await expect(page.getByRole("row")).not.toHaveCount(0);
});

test("only a window of rows is rendered", async ({ page }) => {
  await page.goto("/apps/app-bulk/keywords");
  await page.waitForLoadState("networkidle");

  const rendered = await page.locator("tbody tr:not([aria-hidden])").count();
  expect(rendered).toBeGreaterThan(0);
  expect(rendered).toBeLessThan(BULK_KEYWORD_COUNT / 4);
});

test("a selection survives scrolling the row out of view", async ({ page }) => {
  await page.goto("/apps/app-bulk/keywords");
  await page.waitForLoadState("networkidle");

  const firstCheckbox = page
    .getByRole("checkbox", { name: /^Select bulk keyword/ })
    .first();
  const label = await firstCheckbox.getAttribute("aria-label");
  if (label === null) throw new Error("the row checkbox has no label");
  const checkbox = page.getByRole("checkbox", { name: label, exact: true });

  await checkbox.check();
  await expect(page.getByText("1 selected")).toBeVisible();

  const scroller = page.locator("[data-slot=table-container]");
  await scroller.evaluate((node) => {
    node.scrollTop = 6000;
  });
  await expect(checkbox).toHaveCount(0);
  await expect(page.getByText("1 selected")).toBeVisible();

  await scroller.evaluate((node) => {
    node.scrollTop = 0;
  });
  await expect(checkbox).toBeChecked();
});

test("the header stays visible while the rows scroll", async ({ page }) => {
  await page.goto("/apps/app-bulk/keywords");
  await page.waitForLoadState("networkidle");

  const scroller = page.locator("[data-slot=table-container]");
  await scroller.evaluate((node) => {
    node.scrollTop = 4000;
  });

  await expect(
    page.getByRole("columnheader", { name: "Keyword", exact: true }),
  ).toBeInViewport();
});

test("the last row is reachable by scrolling", async ({ page }) => {
  await page.goto("/apps/app-bulk/keywords");
  await page.waitForLoadState("networkidle");

  const scroller = page.locator("[data-slot=table-container]");
  await scroller.evaluate((node) => {
    node.scrollTop = node.scrollHeight;
  });

  await expect
    .poll(async () =>
      scroller.evaluate((node) => {
        const rows = node.querySelectorAll<HTMLElement>("tbody tr[data-index]");
        return Number(rows[rows.length - 1]?.dataset.index ?? -1);
      }),
    )
    .toBe(BULK_KEYWORD_COUNT - 1);
});

test("the table reports its full row count to assistive tech", async ({
  page,
}) => {
  await page.goto("/apps/app-bulk/keywords");
  await page.waitForLoadState("networkidle");

  await expect(page.locator("table")).toHaveAttribute(
    "aria-rowcount",
    String(BULK_KEYWORD_COUNT + 1),
  );
});
