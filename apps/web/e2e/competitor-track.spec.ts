import { expect, test } from "./session.mts";
import {
  APP_1_DE_DETAIL,
  APP_1_DE_DISCOVERY,
  APP_GP_DETAIL,
  APP_GP_DISCOVERY,
  APP_GP_SERP_MOVERS,
} from "./fixtures.mts";

const [PLAY_DISCOVERED] = APP_GP_DISCOVERY.items;
const [, PLAY_MOVER] = APP_GP_SERP_MOVERS.items;
const [APPLE_DISCOVERED] = APP_1_DE_DISCOVERY.items;

test("tracking a google play discovery row adds the competitor", async ({
  page,
}) => {
  await page.goto(`/apps/${APP_GP_DETAIL.id}/competitors`);
  await page.waitForLoadState("networkidle");

  const row = page
    .getByRole("table", { name: /appearing in your keyword search results/ })
    .getByRole("row")
    .filter({ hasText: PLAY_DISCOVERED.title });

  await row.getByRole("button", { name: "Track" }).click();

  await expect(
    page.getByText(`Now tracking ${PLAY_DISCOVERED.title}`),
  ).toBeVisible();
});

test("a double click on Track sends one competitor add", async ({ page }) => {
  const adds: string[] = [];
  page.on("request", (request) => {
    if (
      request.method() === "POST" &&
      request
        .url()
        .endsWith(`/api/backend/apps/${APP_GP_DETAIL.id}/competitors`)
    ) {
      adds.push(request.url());
    }
  });
  await page.goto(`/apps/${APP_GP_DETAIL.id}/competitors`);
  await page.waitForLoadState("networkidle");

  const row = page
    .getByRole("table", { name: /appearing in your keyword search results/ })
    .getByRole("row")
    .filter({ hasText: PLAY_DISCOVERED.title });

  await row.getByRole("button", { name: "Track" }).dblclick();

  await expect(
    page.getByText(`Now tracking ${PLAY_DISCOVERED.title}`).first(),
  ).toBeVisible();
  expect(adds).toHaveLength(1);
});

test("tracking a google play serp movers row adds the competitor", async ({
  page,
}) => {
  await page.goto(`/apps/${APP_GP_DETAIL.id}/rankings`);
  await page.waitForLoadState("networkidle");

  const row = page.getByRole("listitem").filter({ hasText: PLAY_MOVER.title });

  await row.getByRole("button", { name: "Track" }).click();

  await expect(
    page.getByText(`Now tracking ${PLAY_MOVER.title}`),
  ).toBeVisible();
});

test("tracking an app store discovery row keeps working outside the us", async ({
  page,
}) => {
  await page.goto(`/apps/${APP_1_DE_DETAIL.id}/competitors`);
  await page.waitForLoadState("networkidle");

  const row = page
    .getByRole("table", { name: /appearing in your keyword search results/ })
    .getByRole("row")
    .filter({ hasText: APPLE_DISCOVERED.title });

  await row.getByRole("button", { name: "Track" }).click();

  await expect(
    page.getByText(`Now tracking ${APPLE_DISCOVERED.title}`),
  ).toBeVisible();
});

test("the add competitor example names the store of the app in view", async ({
  page,
}) => {
  await page.goto(`/apps/${APP_GP_DETAIL.id}/competitors`);

  await expect(
    page.getByRole("textbox", { name: "Competitor Google Play URL" }),
  ).toHaveAttribute(
    "placeholder",
    "https://play.google.com/store/apps/details?id=com.example.app",
  );

  await page.goto(`/apps/${APP_1_DE_DETAIL.id}/competitors`);

  await expect(
    page.getByRole("textbox", { name: "Competitor App Store URL" }),
  ).toHaveAttribute(
    "placeholder",
    "https://apps.apple.com/us/app/name/id123456789",
  );
});

test("the discovery panel names the store its rows come from", async ({
  page,
}) => {
  await page.goto(`/apps/${APP_GP_DETAIL.id}/competitors`);

  await expect(
    page.getByRole("table", { name: /Untracked Google Play apps/ }),
  ).toBeVisible();
  await expect(
    page
      .getByText("Apps you don’t track yet")
      .locator("xpath=..")
      .getByText("Google Play"),
  ).toBeVisible();

  await page.goto(`/apps/${APP_1_DE_DETAIL.id}/competitors`);

  await expect(
    page.getByRole("table", { name: /Untracked App Store apps/ }),
  ).toBeVisible();
  await expect(
    page
      .getByText("Apps you don’t track yet")
      .locator("xpath=..")
      .getByText("App Store"),
  ).toBeVisible();
});

test("the discovery table sorts by rating both ways and searches by name", async ({
  page,
}) => {
  await page.goto("/apps/app-1/competitors");
  await page.waitForLoadState("networkidle");
  const table = page.getByRole("table", {
    name: /appearing in your keyword search results/,
  });
  const rows = table.getByRole("row");
  await expect(rows.nth(1)).toContainText("Deep Work Sessions");

  const rating = table.getByRole("button", { name: "Rating", exact: true });
  await rating.click();
  await expect(page).toHaveURL(/appSort=rating/);
  await expect(rows.nth(1)).toContainText("Deep Work Sessions");
  await expect(rows.nth(1).getByLabel("Rating 4.7, strong")).toHaveAttribute(
    "data-grade",
    "strong",
  );

  await rating.click();
  await expect(page).toHaveURL(/appDir=asc/);
  await expect(rows.nth(1)).toContainText("Tomato Clock");
  await expect(page).not.toHaveURL(/[?&]sort=/);

  await page.getByRole("textbox", { name: "Search apps" }).fill("deep");
  await expect(page).toHaveURL(/appQ=deep/);
  await expect(rows).toHaveCount(2);
  await expect(
    rows.nth(1).getByRole("button", { name: "Track" }),
  ).toBeVisible();
  await expect(page.getByText("1 of 2 apps")).toBeVisible();
});
