import { expect, test } from "./session.mts";
import { APP_SECTIONS } from "../src/lib/app-sections";

const APP = "app-1";
const OTHER_APP = "app-2";

test("switching app keeps the section and drops app scoped state", async ({
  page,
}) => {
  await page.goto(`/apps/${APP}/rankings?range=90d&keywords=kw-1`);

  await page.getByRole("button", { name: /^Switch app/ }).click();
  await page.getByRole("option", { name: /Habit Tracker/ }).click();

  await expect(page).toHaveURL(`/apps/${OTHER_APP}/rankings`);
});

test("switching app from a workspace route lands on the app overview", async ({
  page,
}) => {
  await page.goto("/settings");

  await page.getByRole("button", { name: "Choose an app" }).click();
  await page.getByRole("option", { name: /Habit Tracker/ }).click();

  await expect(page).toHaveURL(`/apps/${OTHER_APP}`);
});

test("every sidebar destination is a real link", async ({ page }) => {
  await page.goto(`/apps/${APP}/keywords`);

  const sidebar = page.getByRole("navigation", { name: "Main" });
  const links = sidebar.getByRole("link");
  const count = await links.count();
  expect(count).toBeGreaterThan(APP_SECTIONS.length);

  for (let index = 0; index < count; index += 1) {
    await expect(links.nth(index)).toHaveAttribute("href", /.+/);
  }
});

test("the sidebar opens integrations and marks it current", async ({
  page,
}) => {
  await page.goto("/settings");

  await page
    .getByRole("navigation", { name: "Main" })
    .getByRole("link", { name: "Integrations", exact: true })
    .click();

  await expect(page).toHaveURL("/integrations");
  await expect(
    page.getByRole("heading", { level: 1, name: "Integrations" }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("navigation", { name: "Main" })
      .getByRole("link", { name: "Integrations", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await expect(
    page.getByRole("heading", { level: 2, name: "Store connections" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 2, name: "API and MCP" }),
  ).toBeVisible();
});

test("settings no longer holds the integration cards", async ({ page }) => {
  await page.goto("/settings");

  await expect(
    page.getByRole("heading", { level: 2, name: "Team" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 2, name: "Store connections" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("heading", { level: 2, name: "API and MCP" }),
  ).toHaveCount(0);
});

test.describe("without client javascript", () => {
  test.use({ javaScriptEnabled: false });

  for (const { segment, label } of APP_SECTIONS) {
    test(`a deep link marks ${label} current on first paint`, async ({
      page,
    }) => {
      await page.goto(segment ? `/apps/${APP}/${segment}` : `/apps/${APP}`);

      const item = page
        .getByRole("navigation", { name: "App sections" })
        .getByRole("link", { name: label, exact: true });

      await expect(item).toHaveAttribute("data-active", "true");
      await expect(item).toHaveAttribute(
        "href",
        segment ? `/apps/${APP}/${segment}` : `/apps/${APP}`,
      );
    });
  }
});
