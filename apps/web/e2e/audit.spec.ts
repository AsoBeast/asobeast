import { expect, test } from "./session.mts";
import { seedCookies } from "./routes.mts";

test("shows one score with its grade, measured share and potential", async ({
  page,
}) => {
  await page.goto("/apps/app-1/audit");

  const hero = page.getByRole("region", { name: "ASO score" });
  await expect(
    hero.getByRole("img", {
      name: "ASO score 72 out of 100, grade B, Good, 82% measured",
    }),
  ).toBeVisible();
  await expect(hero.getByText("Reach 86 by finishing the plan")).toBeVisible();
  await expect(hero.getByText("82% of the rubric measured")).toBeVisible();
});

test("never labels the history snapshot as the latest score", async ({
  page,
}) => {
  await page.goto("/apps/app-1/audit");

  await expect(page.getByText("Latest ASO score")).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Score history" }),
  ).toBeVisible();
});

test("shows the score without scrolling on a phone", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/apps/app-1/audit");

  await expect(
    page.getByRole("img", { name: /^ASO score 72/ }),
  ).toBeInViewport();
});

test("labels a low confidence grade provisional", async ({ page, context }) => {
  await seedCookies(context, { e2e_audit: "provisional" });
  await page.goto("/apps/app-1/audit");

  await expect(page.getByText("Provisional · 55% measured")).toBeVisible();
});

test("names the date of the history snapshot it shows", async ({ page }) => {
  await page.goto("/apps/app-gp/audit");

  await expect(page.getByText(/Last daily snapshot · /)).toBeVisible();
});
