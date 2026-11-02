import type { Page } from "@playwright/test";
import { expect, test } from "./session.mts";

const exportButtons = (page: Page) =>
  page.locator("button", { hasText: "Export CSV" });

const expectNamed = async (page: Page, names: readonly string[]) => {
  await expect(exportButtons(page)).toHaveCount(names.length);
  for (const name of names) {
    await expect(page.getByRole("button", { name, exact: true })).toHaveCount(
      1,
    );
  }
  for (const button of await exportButtons(page).all()) {
    await expect(button).not.toHaveAttribute("aria-label", /.+/);
  }
};

for (const [path, names] of [
  ["/apps/app-1/keywords", ["Export CSV of keywords"]],
  ["/apps/app-1/rankings", ["Export CSV of rankings"]],
  ["/apps/app-1/reviews", ["Export CSV of reviews"]],
  [
    "/apps/app-1/competitors",
    ["Export CSV of competitors", "Export CSV of the comparison"],
  ],
] as const) {
  test(`${path} names its export buttons from the visible words`, async ({
    page,
  }) => {
    await page.goto(path);
    await page.waitForLoadState("networkidle");

    await expectNamed(page, names);
  });
}

test("the keywords bulk bar adds Export CSV of selected keywords", async ({
  page,
}) => {
  await page.goto("/apps/app-1/keywords");
  await page.waitForLoadState("networkidle");

  await page.getByRole("checkbox", { name: "Select all keywords" }).check();

  await expectNamed(page, [
    "Export CSV of keywords",
    "Export CSV of selected keywords",
  ]);
});

test("the search results sheet names its export from the visible words", async ({
  page,
}) => {
  await page.goto("/apps/app-1/keywords");
  await page.waitForLoadState("networkidle");

  await page
    .getByRole("button", {
      name: "View search results for focus timer",
      exact: true,
    })
    .click();
  const sheet = page.getByRole("dialog", { name: "Search results" });

  await expect(
    sheet.getByRole("button", {
      name: "Export CSV of the search results",
      exact: true,
    }),
  ).toHaveCount(1);
  await expect(
    sheet.locator("button", { hasText: "Export CSV" }),
  ).not.toHaveAttribute("aria-label", /.+/);
});
