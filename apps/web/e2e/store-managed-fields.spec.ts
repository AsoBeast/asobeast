import {
  APP_MANAGED_LOCALES_ID,
  APP_UNLISTED_MANAGED_ID,
} from "./fixtures.mts";
import { localizationItem, seedLocalizations } from "./localizations.mts";
import { expect, test } from "./session.mts";

const SECTION = "App Store localizations";
const MANAGED_METADATA = `/apps/${APP_MANAGED_LOCALES_ID}/metadata`;
const UNLISTED_METADATA = `/apps/${APP_UNLISTED_MANAGED_ID}/metadata`;

test.describe.configure({ mode: "serial" });

test("imports the keyword field read only when App Store Connect manages it", async ({
  page,
}) => {
  await seedLocalizations(page.request, APP_MANAGED_LOCALES_ID, {
    markets: ["us"],
    fields: { "en-US": ["focus", "timer"] },
    storeManaged: true,
  });
  await page.goto(MANAGED_METADATA);

  const section = page.getByRole("region", { name: SECTION });
  const panel = localizationItem(page, "English (U.S.)").panel;
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
  ).toBeVisible();
  await expect(
    section.getByRole("button", { name: "Stop importing" }),
  ).toBeVisible();
});

test("leaves the unlisted localizations without Add actions when managed", async ({
  page,
}) => {
  await seedLocalizations(page.request, APP_UNLISTED_MANAGED_ID, {
    markets: ["us", "de"],
    fields: { "en-US": ["focus", "timer"] },
    storeManaged: true,
  });
  await page.goto(UNLISTED_METADATA);

  const section = page.getByRole("region", { name: SECTION });
  await expect(
    section.getByRole("heading", { name: "Not listed yet" }),
  ).toBeVisible();
  await expect(section.getByRole("button", { name: "Add German" })).toHaveCount(
    0,
  );
  await expect(
    section.getByRole("button", { name: "Find localizations" }),
  ).toBeVisible();
});

test("starts the import from a confirmation dialog", async ({ page }) => {
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

  await section
    .getByRole("button", { name: "Import from App Store Connect" })
    .click();
  const dialog = page.getByRole("alertdialog");
  await expect(
    dialog.getByText(
      "Your English (U.S.) field will be replaced by what App Store Connect serves.",
    ),
  ).toBeVisible();
  await expect(
    dialog.getByText("Stopping does not bring them back."),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "Import" }).click();

  await expect(dialog).toHaveCount(0);
  await expect(
    panel.getByText("Imported from App Store Connect"),
  ).toBeVisible();
  await expect(panel.getByRole("textbox")).not.toBeEditable();
  await expect(
    section.getByRole("button", { name: "Stop importing" }),
  ).toBeVisible();
  await expect(
    section.getByRole("button", { name: "Add localization" }),
  ).toHaveCount(0);
});

test("says the import waits for its first read", async ({ page }) => {
  await seedLocalizations(page.request, APP_MANAGED_LOCALES_ID, {
    markets: ["us"],
    fields: { "en-US": ["focus", "timer"] },
    storeManaged: true,
    storeSyncAt: null,
  });
  await page.goto(MANAGED_METADATA);

  const panel = localizationItem(page, "English (U.S.)").panel;
  await expect(
    panel.getByText("Imported from App Store Connect"),
  ).toBeVisible();
  await expect(panel.getByText(/waiting for its first read/)).toBeVisible();
  await expect(panel.getByText(/last read/)).toHaveCount(0);
});

test("keeps the fields editable again after stopping the import", async ({
  page,
}) => {
  await seedLocalizations(page.request, APP_MANAGED_LOCALES_ID, {
    markets: ["us"],
    fields: { "en-US": ["focus", "timer"] },
    storeManaged: true,
  });
  await page.goto(MANAGED_METADATA);

  const section = page.getByRole("region", { name: SECTION });
  const panel = localizationItem(page, "English (U.S.)").panel;
  await expect(panel.getByRole("textbox")).not.toBeEditable();

  await section.getByRole("button", { name: "Stop importing" }).click();

  await expect(panel.getByText("Imported from App Store Connect")).toHaveCount(
    0,
  );
  await expect(panel.getByRole("textbox")).toBeEditable();
  await expect(
    section.getByRole("button", { name: "Import from App Store Connect" }),
  ).toBeVisible();
  await expect(
    section.getByRole("button", { name: "Add localization" }),
  ).toBeVisible();
});

test("tells the connection needs attention while the import is paused", async ({
  page,
}) => {
  await seedLocalizations(page.request, APP_MANAGED_LOCALES_ID, {
    markets: ["us"],
    fields: { "en-US": ["focus", "timer"] },
    storeImport: "paused",
  });
  await page.goto(MANAGED_METADATA);

  const section = page.getByRole("region", { name: SECTION });
  const panel = localizationItem(page, "English (U.S.)").panel;
  await expect(
    section.getByText(
      /Importing from App Store Connect is paused because the connection needs attention/,
    ),
  ).toBeVisible();
  await expect(panel.getByRole("textbox")).toBeEditable();
  await expect(
    section.getByRole("button", { name: "Stop importing" }),
  ).toBeVisible();
  await expect(
    section.getByRole("button", { name: "Add localization" }),
  ).toBeVisible();
  await expect(
    section.getByRole("button", { name: "Import from App Store Connect" }),
  ).toHaveCount(0);
});
