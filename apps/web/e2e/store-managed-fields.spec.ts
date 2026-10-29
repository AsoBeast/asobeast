import { APP_MANAGED_LOCALES_ID } from "./fixtures.mts";
import { localizationItem, seedLocalizations } from "./localizations.mts";
import { expect, test } from "./session.mts";

const SECTION = "App Store localizations";
const MANAGED_METADATA = `/apps/${APP_MANAGED_LOCALES_ID}/metadata`;

test("imports the keyword field read only when App Store Connect manages it", async ({
  page,
}) => {
  await seedLocalizations(page.request, APP_MANAGED_LOCALES_ID, {
    markets: ["us"],
    fields: { "en-US": ["focus", "timer"] },
  });
  await page.goto(MANAGED_METADATA);

  const section = page.getByRole("region", { name: SECTION });
  const panel = localizationItem(page, "English (U.S.)").panel;
  await expect(page.getByRole("heading", { name: "Suggestion" })).toBeVisible();
  await expect(
    panel.getByRole("button", { name: "Save keyword field" }),
  ).toBeVisible();
  await expect(
    section.getByRole("button", { name: "Add localization" }),
  ).toBeVisible();

  await seedLocalizations(page.request, APP_MANAGED_LOCALES_ID, {
    markets: ["us"],
    fields: { "en-US": ["focus", "timer"] },
    storeManaged: true,
  });
  await page.reload();

  await expect(
    panel.getByText("Imported from App Store Connect"),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Suggestion" })).toHaveCount(
    0,
  );
  await expect(panel.getByText(/last read .+ UTC/)).toBeVisible();
  await expect(panel.getByRole("textbox")).not.toBeEditable();
  await expect(
    panel.getByRole("button", { name: "Save keyword field" }),
  ).toHaveCount(0);
  await expect(
    panel.getByRole("button", { name: "Remove localization" }),
  ).toHaveCount(0);
  await expect(
    section.getByRole("button", { name: "Add localization" }),
  ).toHaveCount(0);
  await expect(
    section.getByRole("button", { name: "Find localizations" }),
  ).toHaveCount(0);
});
