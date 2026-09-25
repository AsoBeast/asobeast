import type { Page } from "@playwright/test";
import { seedCookies } from "./routes.mts";
import { expect, test } from "./session.mts";

const draftRequest = (page: Page) =>
  page.waitForRequest(
    (request) =>
      request.method() === "POST" &&
      request.url().endsWith("/metadata/assistant"),
  );

test.beforeEach(async ({ context }) => {
  await seedCookies(context, { e2e_metadata_ai: "1" });
});

test("drafts a chosen localization and sends it to the api", async ({
  page,
}) => {
  await page.goto("/apps/app-1/metadata");

  const localization = page.getByRole("combobox", { name: "Localization" });
  await expect(localization).toHaveText("Primary listing");
  await localization.click();
  await expect(page.getByRole("option")).toHaveText([
    "Primary listing",
    "Arabic",
    "Chinese (Simplified)",
    "Chinese (Traditional)",
    "French",
    "Korean",
    "Portuguese (Brazil)",
    "Russian",
    "Spanish (Mexico)",
    "Vietnamese",
    "Polish",
  ]);
  await page.getByRole("option", { name: "Spanish (Mexico)" }).click();
  await expect(page).toHaveURL(/draftLocale=es-MX/);
  await expect(
    page.getByText("Drafts are written in Spanish (Mexico)."),
  ).toBeVisible();

  const request = draftRequest(page);
  await page.getByRole("button", { name: "Generate drafts" }).click();
  expect((await request).postDataJSON()).toEqual({
    fields: ["title", "subtitle", "keywordField"],
    localization: "es-MX",
  });
  await expect(page.getByText("Drafted in Spanish (Mexico)")).toBeVisible();
});

test("a storefront language opens the drafts card on that language", async ({
  page,
}) => {
  await page.goto("/apps/app-1/metadata");

  await page
    .getByRole("button", { name: "Draft with AI: Spanish (Mexico)" })
    .click();

  await expect(page).toHaveURL(/draftLocale=es-MX/);
  const localization = page.getByRole("combobox", { name: "Localization" });
  await expect(localization).toBeFocused();
  await expect(localization).toHaveText("Spanish (Mexico)");
});

test("a google play app never sends a localization", async ({ page }) => {
  await page.goto("/apps/app-gp/metadata?draftLocale=es-MX");

  await expect(page.getByRole("heading", { name: "AI drafts" })).toBeVisible();
  await expect(
    page.getByRole("combobox", { name: "Localization" }),
  ).toHaveCount(0);
  const request = draftRequest(page);
  await page.getByRole("button", { name: "Generate drafts" }).click();
  expect((await request).postDataJSON()).toEqual({
    fields: ["title", "shortDescription", "description"],
  });
});

test("a deep link to another app store language keeps it and hydrates cleanly", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto("/apps/app-1/metadata?draftLocale=ja");

  await expect(page.getByRole("combobox", { name: "Localization" })).toHaveText(
    "Japanese",
  );
  const request = draftRequest(page);
  await page.getByRole("button", { name: "Generate drafts" }).click();
  expect((await request).postDataJSON()).toMatchObject({ localization: "ja" });
  await page.waitForLoadState("networkidle");
  expect(errors).toEqual([]);
});
