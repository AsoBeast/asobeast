import type { Page } from "@playwright/test";
import { hydrated } from "./hydrated.mts";
import { expect, test } from "./session.mts";

const editor = (page: Page) =>
  page.getByRole("region", { name: "Draft listing" });
const field = (page: Page, name: string) =>
  editor(page).getByRole("textbox", { name, exact: true });
const modes = (page: Page) =>
  page.getByRole("tablist", { name: "Listing mode" });

test("opens draft mode with the live listing in its fields", async ({
  page,
}) => {
  await page.goto("/apps/app-1/metadata?mode=draft");

  await expect(field(page, "Title")).toHaveValue("Focus Timer");
  await expect(field(page, "Subtitle")).toHaveValue(
    "Pomodoro sessions that stick",
  );
  await expect(field(page, "Keyword field")).toHaveValue(
    "study timer,deep work",
  );
  await expect(editor(page).getByText("11/30", { exact: true })).toBeVisible();
  await expect(field(page, "Description")).toHaveCount(0);
  await editor(page).getByRole("button", { name: "Description" }).click();
  await expect(field(page, "Description")).toBeVisible();
});

test("switches between the live listing and the draft without losing either", async ({
  page,
}) => {
  await page.goto("/apps/app-1/metadata?mode=draft");
  await (await hydrated(field(page, "Title"))).fill("Habit Tracker");

  await modes(page).getByRole("tab", { name: "Live listing" }).click();
  await expect(page).not.toHaveURL(/mode=draft/);
  await expect(editor(page)).toHaveCount(0);
  await expect(
    page.getByRole("region", { name: "Listing fields" }),
  ).toBeVisible();

  await modes(page).getByRole("tab", { name: "Draft" }).click();
  await expect(page).toHaveURL(/mode=draft/);
  await expect(field(page, "Title")).toHaveValue("Habit Tracker");

  await page.goBack();
  await expect(page).not.toHaveURL(/mode=draft/);
});

test("keeps the draft across a reload", async ({ page }) => {
  await page.goto("/apps/app-1/metadata?mode=draft");
  await (await hydrated(field(page, "Title"))).fill("Habit Tracker");

  await page.reload();

  await expect(field(page, "Title")).toHaveValue("Habit Tracker");
});

test("keeps a separate draft per localization", async ({ page }) => {
  await page.goto("/apps/app-1/metadata?mode=draft");
  await (await hydrated(field(page, "Title"))).fill("Habit Tracker");

  await page.goto("/apps/app-1/metadata?market=pl&localization=pl&mode=draft");
  await expect(field(page, "Title")).toHaveValue("Skupienie: Minutnik Pracy");

  await page.goto("/apps/app-1/metadata?mode=draft");
  await expect(field(page, "Title")).toHaveValue("Habit Tracker");
});

test("counts characters the way the store does", async ({ page }) => {
  await page.goto("/apps/app-1/metadata?mode=draft");
  const title = await hydrated(field(page, "Title"));

  await title.fill("Focus ⏱ Timer");
  await expect(editor(page).getByText("13/30", { exact: true })).toBeVisible();

  await title.fill("A".repeat(35));
  await expect(
    editor(page).getByText("35/30 · 5 over", { exact: true }),
  ).toBeVisible();
  await expect(title).toHaveAttribute("aria-invalid", "true");
});

test("resets the draft to the live listing", async ({ page }) => {
  await page.goto("/apps/app-1/metadata?mode=draft");
  const reset = editor(page).getByRole("button", {
    name: "Reset to live listing",
  });
  await expect(reset).toHaveAttribute("aria-disabled", "true");
  await (await hydrated(field(page, "Title"))).fill("Habit Tracker");
  await expect(reset).not.toHaveAttribute("aria-disabled", "true");

  await reset.click();

  await expect(field(page, "Title")).toHaveValue("Focus Timer");
  await expect(reset).toBeFocused();
  await expect(reset).toHaveAttribute("aria-disabled", "true");
});

test("shows short description and no subtitle or keyword field on Google Play", async ({
  page,
}) => {
  await page.goto("/apps/app-gp/metadata?mode=draft");

  await expect(field(page, "Title")).toBeVisible();
  await expect(field(page, "Short description")).toBeVisible();
  await expect(field(page, "Subtitle")).toHaveCount(0);
  await expect(field(page, "Keyword field")).toHaveCount(0);
});

test("opens on the live listing for a competitor", async ({ page }) => {
  await page.goto("/apps/app-rival/metadata?mode=draft");

  await expect(
    page.getByRole("region", { name: "Listing fields" }),
  ).toBeVisible();
  await expect(modes(page)).toHaveCount(0);
  await expect(editor(page)).toHaveCount(0);
});
