import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "./session.mts";

const STRUCTURAL_RULES = [
  "aria-valid-attr-value",
  "aria-prohibited-attr",
  "empty-table-header",
];

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

    const { violations } = await new AxeBuilder({ page })
      .withRules(STRUCTURAL_RULES)
      .analyze();

    expect(
      violations.map(({ id, nodes }) => ({
        id,
        targets: nodes.map((node) => node.target.join(" ")),
      })),
    ).toEqual([]);
  });
}
