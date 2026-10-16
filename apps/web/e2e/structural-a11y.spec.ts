import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { expect, test } from "./session.mts";
import { startedSetup } from "./setup-session.mts";

const STRUCTURAL_RULES = [
  "aria-valid-attr-value",
  "aria-prohibited-attr",
  "empty-table-header",
];

const structuralViolations = async (page: Page) => {
  const { violations } = await new AxeBuilder({ page })
    .withRules(STRUCTURAL_RULES)
    .analyze();
  return violations.map(({ id, nodes }) => ({
    id,
    targets: nodes.map((node) => node.target.join(" ")),
  }));
};

for (const path of [
  "/",
  "/actions",
  "/apps/app-1",
  "/apps/app-1/changes",
  "/apps/app-1/rankings",
  "/apps/app-1/reviews",
  "/apps/app-1/keywords",
  "/apps/app-1/competitors",
  "/settings",
]) {
  test(`${path} names every range tab, star rating and table header`, async ({
    page,
  }) => {
    await page.goto(path);
    await page.waitForLoadState("networkidle");

    expect(await structuralViolations(page)).toEqual([]);
  });
}

test("/apps/app-1/setup names the panel of every picker tab", async ({
  page,
  context,
}) => {
  await startedSetup(context, "app-1");
  await page.goto("/apps/app-1/setup");
  await expect(
    page.getByRole("tab", { name: "From your listing" }),
  ).toHaveAttribute("aria-selected", "true");
  await page.waitForLoadState("networkidle");

  expect(await structuralViolations(page)).toEqual([]);
});

test("the import dialog names the panel of every store tab", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Import app" }).click();
  const dialog = page.getByRole("dialog", { name: "Import an app" });
  await expect(dialog.getByRole("tab")).toHaveCount(2);

  expect(await structuralViolations(page)).toEqual([]);
});
