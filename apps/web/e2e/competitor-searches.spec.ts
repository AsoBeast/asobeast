import type { Page } from "@playwright/test";
import { hydrated } from "./hydrated.mts";
import { MOCK_API_URL } from "./localizations.mts";
import { expect, test } from "./session.mts";

const openTab = async (page: Page, path: string) => {
  await page.goto(path);
  await (
    await hydrated(page.getByRole("button", { name: /^Suggestions/ }))
  ).click();
  await page.getByRole("tab", { name: "Competitor searches" }).click();
};

const row = (page: Page, text: string) =>
  page
    .getByRole("listitem")
    .filter({ hasText: text })
    .filter({ hasNotText: "Tracking" });

test("the competitor searches tab lists searches with their seed", async ({
  page,
}) => {
  await openTab(page, "/apps/app-1/keywords");

  await expect(page).toHaveURL(/strategy=competitorSearch/);
  const search = row(page, "focus timer for adhd");
  await expect(search).toContainText("from “focus timer”");
  await expect(search).toContainText("1 competitor");
  await expect(row(page, "deep work timer app")).toContainText("2 competitors");
});

test("a competitor search is tracked in one click", async ({
  page,
  request,
}) => {
  const posts: string[] = [];
  page.on("request", (sent) => {
    if (
      sent.method() === "POST" &&
      new URL(sent.url()).pathname.endsWith("/apps/app-1/keywords")
    ) {
      posts.push(sent.postData() ?? "");
    }
  });
  await openTab(page, "/apps/app-1/keywords");

  await row(page, "focus timer for adhd")
    .getByRole("button", { name: /^Track/ })
    .click();

  await expect(page.getByText("Tracking focus timer for adhd")).toBeVisible();
  await expect(row(page, "focus timer for adhd")).toContainText("Tracked");
  expect(posts).toHaveLength(1);
  expect(JSON.parse(posts[0])).toMatchObject({
    keywords: ["focus timer for adhd"],
  });
  await request.post(`${MOCK_API_URL}/__reset/keywords/app-1`, {
    failOnStatusCode: true,
  });
});

test("an empty competitor search explains why", async ({ page }) => {
  await openTab(page, "/apps/app-2/keywords");

  await expect(
    page.getByText(
      "Your competitors' titles share no phrase to search from in this market yet.",
    ),
  ).toBeVisible();
});

test("the tab runs once per visit", async ({ page }) => {
  const strategies: string[] = [];
  page.on("request", (sent) => {
    const url = new URL(sent.url());
    if (url.pathname.endsWith("/keywords/suggestions")) {
      strategies.push(url.searchParams.get("strategy") ?? "");
    }
  });
  await openTab(page, "/apps/app-1/keywords");
  await expect(row(page, "focus timer for adhd")).toBeVisible();

  await page.getByRole("tab", { name: "Search", exact: true }).click();
  await expect(page.getByText("focus timer app")).toBeVisible();
  await page.getByRole("tab", { name: "Competitor searches" }).click();
  await expect(row(page, "focus timer for adhd")).toBeVisible();

  expect(
    strategies.filter((strategy) => strategy === "competitorSearch"),
  ).toHaveLength(1);
});
