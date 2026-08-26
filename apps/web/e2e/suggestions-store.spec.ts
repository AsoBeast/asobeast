import { expect, test } from "./session.mts";
import { APP_1_DETAIL, APP_GP_DETAIL } from "./fixtures.mts";

const suggestionsHint = (store: string) =>
  new RegExp(`Search and Similar apps run a live ${store} lookup`);

test("a google play keywords page names google play in the suggestions hint", async ({
  page,
}) => {
  await page.goto(`/apps/${APP_GP_DETAIL.id}/keywords`);

  await expect(page.getByText(suggestionsHint("Google Play"))).toBeVisible();
  await expect(page.getByText(suggestionsHint("App Store"))).toHaveCount(0);
});

test("an app store keywords page names the app store in the suggestions hint", async ({
  page,
}) => {
  await page.goto(`/apps/${APP_1_DETAIL.id}/keywords`);

  await expect(page.getByText(suggestionsHint("App Store"))).toBeVisible();
});
