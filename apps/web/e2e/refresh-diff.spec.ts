import { expect, test } from "./session.mts";

test("the refresh dialog lists screenshot and icon changes", async ({
  page,
}) => {
  await page.goto("/apps/app-2/metadata");
  await page
    .getByRole("banner")
    .getByRole("button", { name: "Refresh", exact: true })
    .click();

  const dialog = page.getByRole("dialog", { name: "Snapshot refreshed" });
  await expect(dialog).toContainText(
    "2 fields changed since the last snapshot.",
  );
  await expect(
    dialog.getByRole("row", {
      name: "Screenshot images 8 screenshots 8 screenshots, reordered",
    }),
  ).toBeVisible();
  await expect(
    dialog.getByRole("row", { name: "Icon — Icon updated" }),
  ).toBeVisible();
  await expect(dialog).not.toContainText("mzstatic");
  await expect(dialog).not.toContainText("No changes detected");
});

test("the refresh dialog says when nothing changed", async ({ page }) => {
  await page.goto("/apps/app-1/metadata");
  await page
    .getByRole("banner")
    .getByRole("button", { name: "Refresh", exact: true })
    .click();

  const dialog = page.getByRole("dialog", { name: "Snapshot refreshed" });
  await expect(dialog).toContainText("No changes detected.");
});
