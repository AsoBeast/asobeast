import { expect, test } from "./session.mts";
import { ACTIONS } from "./fixtures.mts";

const DASHBOARD_ACTION_LIMIT = 5;

test("top actions name their app and open the exact action", async ({
  page,
}) => {
  await page.goto("/");

  const card = page
    .getByRole("heading", { name: "Top actions", level: 2 })
    .locator("xpath=ancestor::*[@data-slot='card'][1]");
  const rows = card.getByRole("listitem");
  await expect(rows.first()).toBeVisible();
  expect(await rows.count()).toBeLessThanOrEqual(DASHBOARD_ACTION_LIMIT);

  const [first] = ACTIONS;
  const link = rows.first().getByRole("link");
  await expect(link).toContainText(first.scope.appName ?? "");
  await expect(link).toContainText(first.scope.country.toUpperCase());
  await expect(link).toHaveAttribute("href", `/actions?action=${first.id}`);

  await link.click();
  await expect(page).toHaveURL(new RegExp(`/actions\\?action=${first.id}$`));
  await expect(page.locator(`#action-${first.id}`)).toHaveAttribute(
    "data-focused",
    "true",
  );
});
