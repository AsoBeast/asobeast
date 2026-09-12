import type { BrowserContext, Page } from "@playwright/test";
import { expect, test } from "./session.mts";
import { test as signedOut } from "./reporting.mts";
import { SIGNED_IN_ROUTES, SIGNED_OUT_ROUTES } from "./routes.mts";

const DEEP_LINKS = [
  {
    name: "a reviews star filter",
    url: "/apps/app-1/reviews?score=3",
    endpoint: "/api/backend/apps/app-1/reviews",
    ready: (page: Page) => page.getByText("No reviews match these filters"),
  },
  {
    name: "an overview category range",
    url: "/apps/app-1?categoryRange=7d",
    endpoint: "/api/backend/apps/app-1/category-ranks",
    ready: (page: Page) =>
      page.getByRole("region", { name: "Category chart position over time" }),
  },
  {
    name: "a competitor gaps filter",
    url: "/apps/app-1/competitors?onlyGaps=true",
    endpoint: "/api/backend/apps/app-1/keywords/compare",
    ready: (page: Page) => page.getByRole("table"),
  },
] as const;

for (const { name, url, endpoint, ready } of DEEP_LINKS) {
  test(`${name} hydrates from the server without refetching`, async ({
    page,
  }) => {
    const refetched: string[] = [];
    page.on("request", (request) => {
      const target = new URL(request.url());
      if (target.pathname === endpoint && target.search) {
        refetched.push(target.pathname + target.search);
      }
    });

    await page.goto(url);
    await expect(ready(page).first()).toBeVisible();
    await page.waitForLoadState("networkidle");

    expect(refetched).toEqual([]);
  });
}

function collectPageErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
}

function seedCookies(
  context: BrowserContext,
  cookies: Readonly<Record<string, string>>,
) {
  return context.addCookies(
    Object.entries(cookies).map(([name, value]) => ({
      name,
      value,
      domain: "localhost",
      path: "/",
    })),
  );
}

for (const [name, path] of SIGNED_IN_ROUTES) {
  test(`${name} hydrates without an uncaught error`, async ({ page }) => {
    const errors = collectPageErrors(page);

    await page.goto(path);
    await page.waitForLoadState("networkidle");

    expect(errors, `${name} (${path}) threw: ${errors.join(", ")}`).toEqual([]);
  });
}

for (const [name, path, cookies] of SIGNED_OUT_ROUTES) {
  signedOut(
    `${name} hydrates without an uncaught error when signed out`,
    async ({ page, context }) => {
      await seedCookies(context, cookies);
      const errors = collectPageErrors(page);

      await page.goto(path);
      await page.waitForLoadState("networkidle");

      expect(new URL(page.url()).pathname, `${name} redirected away`).toBe(
        path,
      );
      expect(errors, `${name} (${path}) threw: ${errors.join(", ")}`).toEqual(
        [],
      );
    },
  );
}
