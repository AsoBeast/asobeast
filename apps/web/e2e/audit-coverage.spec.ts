import { expect, test } from "./session.mts";

test("audit factor meters separate a weak score from a strong one", async ({
  page,
}) => {
  await page.goto("/apps/app-1/audit");

  await expect(
    page.getByRole("heading", { name: "Factors", level: 2 }),
  ).toBeVisible();

  const fills = await page
    .locator('details [data-slot="meter"] > span')
    .evaluateAll((nodes) =>
      nodes.map((node) => getComputedStyle(node).backgroundColor),
    );

  expect(fills.length).toBe(3);
  expect(new Set(fills).size).toBe(3);
});

test("keyword coverage marks a covered field apart from a missing one", async ({
  page,
}) => {
  await page.goto("/apps/app-1/metadata");

  const uncovered = page.getByRole("row", { name: /productivity app/ });
  await expect(uncovered.getByText("Uncovered")).toBeVisible();

  const covered = page.getByRole("row", { name: /focus timer/ });
  const tones = await covered.evaluate((row) =>
    [...row.querySelectorAll("td span span")]
      .filter((node) => node.textContent?.trim() !== "")
      .map((node) => node.textContent?.trim()),
  );

  expect(tones).toContain("in Title");
  expect(tones).toContain("missing from Subtitle");
});
