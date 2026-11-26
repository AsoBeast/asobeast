import { expect, test } from "./session.mts";
import { APP_1 } from "./fixtures.mts";

test("keyboard round trip navigates to an app and then a section", async ({
  page,
}) => {
  await page.goto("/");

  await page.keyboard.press("ControlOrMeta+k");

  const palette = page.locator('[data-slot="command-dialog"]');
  await expect(palette).toBeVisible();

  await page.keyboard.type(APP_1.name ?? "");
  await expect(
    palette.getByRole("option", { name: /Focus Timer/ }),
  ).toBeVisible();
  await page.keyboard.press("Enter");

  await expect(page).toHaveURL(`/apps/${APP_1.id}`);

  await page.keyboard.press("ControlOrMeta+k");
  await expect(palette).toBeVisible();
  await page.keyboard.type("Keywords");
  await expect(palette.getByRole("option", { name: "Keywords" })).toBeVisible();
  await page.keyboard.press("Enter");

  await expect(page).toHaveURL(`/apps/${APP_1.id}/keywords`);
});

test("the header button opens the palette and offers general destinations", async ({
  page,
}) => {
  await page.goto("/");

  await page.locator('[data-action="open-command-palette"]').click();

  const palette = page.locator('[data-slot="command-dialog"]');
  await expect(palette).toBeVisible();
  await expect(palette.getByRole("option", { name: "Settings" })).toBeVisible();
  await expect(
    palette.getByRole("option", { name: "Integrations" }),
  ).toBeVisible();
  await expect(
    palette.getByRole("option", { name: "Dashboard" }),
  ).toBeVisible();
});
