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
