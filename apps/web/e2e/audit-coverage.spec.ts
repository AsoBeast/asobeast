import { expect, test } from "./session.mts";

test("audit factor meters separate a weak score from a strong one", async ({
  page,
}) => {
  await page.goto("/apps/app-1/audit");

  await expect(
    page.getByRole("heading", { name: "Search visibility", level: 2 }),
  ).toBeVisible();

  const fills = await page
    .locator('article [data-slot="meter"] > span')
    .evaluateAll((nodes) =>
      nodes.map((node) => getComputedStyle(node).backgroundColor),
    );

  expect(fills.length).toBeGreaterThanOrEqual(3);
  expect(new Set(fills).size).toBe(3);
});
