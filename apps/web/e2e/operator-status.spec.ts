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
