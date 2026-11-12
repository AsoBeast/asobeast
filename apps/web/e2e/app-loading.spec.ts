import { seedCookies } from "./routes.mts";
import { expect, test } from "./session.mts";

test("the overview keeps one app header while it loads", async ({
  page,
  context,
}) => {
  await page.goto("/apps/app-1/keywords");
  await page.waitForLoadState("networkidle");
  await seedCookies(context, { e2e_api_latency: "4000" });

  await page
    .getByRole("navigation")
    .getByRole("link", { name: "Overview", exact: true })
    .first()
    .click();

  const skeletons = page.locator("main [data-slot=skeleton]");
  await expect(skeletons.first()).toBeVisible();
  expect(await skeletons.and(page.locator(".size-8")).count()).toBe(0);
});
