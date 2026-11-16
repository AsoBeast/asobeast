import { expect, test } from "./reporting.mts";

test("closed registration sends a visitor to sign in and says why", async ({
  page,
}) => {
  await page.goto("/register");

  await expect(page).toHaveURL(/\/login\?registration=closed$/);
  await expect(
    page.getByText(
      "Registration is closed on this deployment. Ask the owner for an account.",
    ),
  ).toBeVisible();
});
