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

  await expect(page).toHaveURL(/\/apps\/app-1$/);
  const skeletons = page.locator("main [data-slot=skeleton]");
  await expect(skeletons.first()).toBeVisible();
  expect(await skeletons.and(page.locator(".size-8")).count()).toBe(0);
});

test("the overview's loading market control is as wide as the market select", async ({
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

  await expect(page).toHaveURL(/\/apps\/app-1$/);
  const skeletons = page.locator("main [data-slot=skeleton]");
  await expect(skeletons.first()).toBeVisible();
  const placeholders = await skeletons.evaluateAll((nodes) =>
    nodes.map((node) => {
      const box = node.getBoundingClientRect();
      return `${Math.round(box.width)}x${Math.round(box.height)}`;
    }),
  );

  const select = page.getByRole("combobox", { name: "Market" });
  await expect(select).toBeVisible({ timeout: 15_000 });
  const box = await select.boundingBox();

  expect(placeholders).toContain(
    `${Math.round(box?.width ?? 0)}x${Math.round(box?.height ?? 0)}`,
  );
});
