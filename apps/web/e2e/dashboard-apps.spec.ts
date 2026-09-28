import type { Page } from "@playwright/test";
import { expect, test } from "./session.mts";

const appsRegion = (page: Page) => page.getByRole("region", { name: "Apps" });

const card = (page: Page, name: string) =>
  appsRegion(page)
    .locator('[data-slot="card"]')
    .filter({ has: page.getByText(name, { exact: true }) });

test("a captured app card shows its bands, audit and open actions", async ({
  page,
}) => {
  await page.goto("/");

  const tomato = card(page, "Tomato Clock");
  await expect(tomato.getByText("2 in top 10")).toBeVisible();
  await expect(
    tomato.getByRole("img", { name: /^Rank bands: 0 at #1, 1 at #2–3/ }),
  ).toBeVisible();
  await expect(tomato).toContainText("Audit");
  await expect(tomato).toContainText("Audit 55, fair");
  await expect(
    tomato.getByRole("link", { name: /1 open action\b/ }),
  ).toHaveAttribute("href", "/apps/app-gp/actions");
});

test("a storefront member shows its rating and open actions", async ({
  page,
}) => {
  await page.goto("/");

  const member = appsRegion(page)
    .locator('[data-slot="card"]')
    .filter({ hasText: "Storefronts" })
    .getByRole("listitem")
    .filter({ has: page.getByText("US", { exact: true }) });
  await expect(member).toContainText("Rating 4.6, strong");
  await expect(
    member.getByRole("link", { name: /5 open actions/ }),
  ).toHaveAttribute("href", "/apps/app-1/actions");
  await expect(
    member.getByRole("link", { name: /2 new low ratings/ }),
  ).toHaveCount(0);
});

test("a sparse app card leaves out what it does not have", async ({ page }) => {
  await page.goto("/");

  const habit = card(page, "Habit Tracker");
  await expect(habit).toContainText("Rating 4.1, fair");
  await expect(habit.getByRole("img", { name: /^Rank bands/ })).toHaveCount(0);
  await expect(habit).not.toContainText("Audit");
  await expect(habit.getByRole("link", { name: /open action/ })).toHaveCount(0);
  await expect(habit.getByText("0", { exact: true })).toHaveCount(0);
});

test("a pending app card still only says it is waiting", async ({ page }) => {
  await page.goto("/");

  const pending = card(page, "Pending App");
  await expect(pending.getByText(/Awaiting the first daily run/)).toBeVisible();
  await expect(pending.getByRole("img")).toHaveCount(0);
  await expect(pending).not.toContainText("Rating");
  await expect(pending.getByText("0", { exact: true })).toHaveCount(0);
});

test("app card footers line up along a grid row", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");

  const footers = page.locator('[data-slot="app-card-footer"]');
  await expect(footers.first()).toBeVisible();
  const boxes = await footers.evaluateAll((nodes) =>
    nodes.map((node) => {
      const card = node.closest("li")!.getBoundingClientRect();
      return { top: card.top, bottom: node.getBoundingClientRect().bottom };
    }),
  );
  const firstRow = boxes.filter((box) => Math.abs(box.top - boxes[0].top) <= 1);

  expect(firstRow.length).toBeGreaterThan(1);
  for (const box of firstRow) {
    expect(Math.abs(box.bottom - firstRow[0].bottom)).toBeLessThanOrEqual(1);
  }
});
