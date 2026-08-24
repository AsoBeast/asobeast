import { expect, test } from "./session.mts";

test("same-app storefronts group under one header", async ({ page }) => {
  await page.goto("/");

  const group = page
    .getByRole("listitem")
    .filter({ has: page.getByText("Storefronts", { exact: true }) });

  await expect(group).toHaveCount(1);
  await expect(
    group.getByRole("link", { name: "Focus Timer", exact: true }),
  ).toHaveCount(2);
  await expect(group.getByText("US", { exact: true })).toBeVisible();
  await expect(group.getByText("DE", { exact: true })).toBeVisible();
  await expect(group.getByText("5 keywords")).toBeVisible();
  await expect(group.getByText("3 keywords")).toBeVisible();
});

test("an unrelated app stays a plain row", async ({ page }) => {
  await page.goto("/");

  const habit = page
    .getByRole("listitem")
    .filter({ has: page.getByText("Habit Tracker", { exact: true }) });

  await expect(habit).toHaveCount(1);
  await expect(habit.getByText("Storefronts", { exact: true })).toHaveCount(0);
  await expect(habit.getByText("Linked", { exact: true })).toHaveCount(0);
});
