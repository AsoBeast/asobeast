import type { Page } from "@playwright/test";
import { expect, test } from "./session.mts";

const mainHeadings = (page: Page) =>
  page.getByRole("main").getByRole("heading").allInnerTexts();

test("the dashboard outline reads in visual order on a phone", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Apps", level: 2 }),
  ).toBeVisible();

  expect(await mainHeadings(page)).toEqual([
    "Dashboard",
    "Top actions",
    "Apps",
    "Recent changes",
  ]);
});

test("apps and recent changes share a row once the sidebar collapses", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await page.getByRole("button", { name: "Toggle Sidebar" }).first().click();
  await expect(page.locator("[data-slot=sidebar]")).toHaveAttribute(
    "data-state",
    "collapsed",
  );

  const apps = page.getByRole("region", { name: "Apps" });
  const changes = page
    .getByRole("heading", { name: "Recent changes", level: 2 })
    .locator("xpath=ancestor::*[@data-slot='card'][1]");

  await expect(async () => {
    const appsBox = (await apps.boundingBox())!;
    const changesBox = (await changes.boundingBox())!;
    expect(changesBox.x).toBeGreaterThanOrEqual(appsBox.x + appsBox.width);
    expect(changesBox.y).toBeLessThan(appsBox.y + appsBox.height);
    expect(appsBox.y).toBeLessThan(changesBox.y + changesBox.height);
  }).toPass();
});
