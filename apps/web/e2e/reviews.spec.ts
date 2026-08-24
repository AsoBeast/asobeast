import { expect, test } from "./session.mts";

test("reviews tab lists stored reviews and the ratings chart", async ({
  page,
}) => {
  await page.goto("/apps/app-1/reviews");

  await expect(
    page.getByRole("region", { name: "Average rating and review volume" }),
  ).toBeVisible();

  await expect(page.getByText("Love the focus timer")).toBeVisible();
  await expect(page.getByText("Please add dark mode.")).toBeVisible();
});

test("a star filter writes to the url and narrows the list", async ({
  page,
}) => {
  await page.goto("/apps/app-1/reviews");

  await page.getByRole("button", { name: "1", exact: true }).click();

  await expect(page).toHaveURL(/score=1/);
  await expect(page.getByRole("article")).toHaveCount(1);
  await expect(
    page.getByRole("article").getByText("Please add dark mode."),
  ).toBeVisible();
  await expect(page.getByText("Love the focus timer")).toBeHidden();
});

test("a filtered review list says no match, not no data", async ({ page }) => {
  await page.goto("/apps/app-1/reviews?score=3");

  await expect(page.getByText("No reviews match these filters")).toBeVisible();

  await page.getByRole("button", { name: "Clear filters" }).click();

  await expect(page.getByText("No reviews match these filters")).toBeHidden();
});
