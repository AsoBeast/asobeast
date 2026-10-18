import type { Page } from "@playwright/test";
import { hydrated } from "./hydrated.mts";
import { expect, test } from "./session.mts";

const track = (page: Page, strategies: string[]) =>
  page.on("request", (sent) => {
    const url = new URL(sent.url());
    if (url.pathname.endsWith("/keywords/suggestions")) {
      strategies.push(url.searchParams.get("strategy") ?? "");
    }
  });

const openSuggestions = async (page: Page) => {
  await (
    await hydrated(page.getByRole("button", { name: /^Suggestions/ }))
  ).click();
};

const refreshListing = async (page: Page) => {
  const keywordsRefetched = page.waitForRequest((sent) =>
    new URL(sent.url()).pathname.endsWith("/api/backend/apps/app-1/keywords"),
  );
  await page
    .getByRole("banner")
    .getByRole("button", { name: "Refresh", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Snapshot refreshed" }),
  ).toBeVisible();
  await keywordsRefetched;
  await page.waitForLoadState("networkidle");
};

test("refreshing the listing does not look up a store suggestion again", async ({
  page,
}) => {
  const strategies: string[] = [];
  track(page, strategies);
  await page.goto("/apps/app-1/keywords?strategy=search");
  await openSuggestions(page);
  await expect(page.getByText("focus timer app")).toBeVisible();
  expect(strategies).toEqual(["search"]);

  await refreshListing(page);

  expect(strategies).toEqual(["search"]);
});

test("refreshing the listing still refreshes the listing source", async ({
  page,
}) => {
  const strategies: string[] = [];
  track(page, strategies);
  await page.goto("/apps/app-1/keywords");
  await openSuggestions(page);
  await expect.poll(() => strategies).toEqual(["metadata"]);

  await refreshListing(page);

  await expect.poll(() => strategies).toEqual(["metadata", "metadata"]);
});
