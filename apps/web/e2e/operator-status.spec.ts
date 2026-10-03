import { expect, test } from "@playwright/test";
import { seedSession } from "./plan-helpers.mts";
import { seedViewer } from "./viewer.mts";

test.describe("api status badge", () => {
  test("is shown to the platform operator", async ({ page }) => {
    await seedSession(page);
    await page.goto("/settings");

    await expect(
      page.getByRole("banner").getByText("api", { exact: true }),
    ).toBeVisible();
  });

  for (const viewer of ["customer", "member"] as const) {
    test(`is hidden from a ${viewer} and never polls health`, async ({
      page,
      context,
    }) => {
      const healthChecks: string[] = [];
      page.on("request", (request) => {
        if (request.url().includes("/api/backend/health")) {
          healthChecks.push(request.url());
        }
      });
      await seedSession(page);
      await seedViewer(context, viewer);
      await page.goto("/settings");
      await expect(
        page.getByRole("button", { name: "Account menu" }),
      ).toBeVisible();

      await expect(
        page.getByRole("banner").getByText("api", { exact: true }),
      ).toHaveCount(0);
      expect(healthChecks).toEqual([]);
    });
  }
});

test.describe("instance capacity", () => {
  test("the operator sees capacity in settings and on the dashboard", async ({
    page,
    context,
  }) => {
    await seedSession(page);
    await context.addCookies([
      { name: "e2e_budget_hot", value: "1", domain: "localhost", path: "/" },
    ]);

    await page.goto("/settings");
    await expect(page.getByRole("region", { name: "Capacity" })).toBeVisible();

    await page.goto("/");
    await expect(page.getByText(/of the daily request budget/)).toBeVisible();
    await expect(
      page.getByText(/exceed 85% of your store rate limit/),
    ).toBeVisible();
  });

  for (const viewer of ["customer", "member"] as const) {
    test(`a ${viewer} sees no instance capacity anywhere`, async ({
      page,
      context,
    }) => {
      await seedSession(page);
      await seedViewer(context, viewer);
      await context.addCookies([
        { name: "e2e_budget_hot", value: "1", domain: "localhost", path: "/" },
      ]);

      await page.goto("/settings");
      await expect(page.getByRole("region", { name: "Alerts" })).toBeVisible();
      await expect(page.getByRole("region", { name: "Capacity" })).toHaveCount(
        0,
      );
      await expect(page.getByText("Daily request budget")).toHaveCount(0);

      await page.goto("/");
      await expect(
        page.getByRole("button", { name: "Account menu" }),
      ).toBeVisible();
      await expect(page.getByText(/of the daily request budget/)).toHaveCount(
        0,
      );
      await expect(
        page.getByText(/exceed 85% of your store rate limit/),
      ).toHaveCount(0);
    });
  }
});
