import type { Page } from "@playwright/test";
import { expect, test } from "./session.mts";

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
