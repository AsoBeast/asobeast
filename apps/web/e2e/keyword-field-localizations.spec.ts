import type { Page } from "@playwright/test";
import { expect, test } from "./session.mts";
import { typeInto } from "./type.mts";

const MOCK_API_URL = `http://localhost:${process.env.MOCK_API_PORT ?? 4100}`;
const APP = "app-unchecked";

function storeField(
  page: Page,
  query: Record<string, string>,
  text: string,
): Promise<unknown> {
  const search = new URLSearchParams(query).toString();
  return page.request.put(
    `${MOCK_API_URL}/apps/${APP}/keyword-field${search ? `?${search}` : ""}`,
    { data: { text } },
  );
}

async function resetFields(page: Page): Promise<void> {
  await storeField(page, {}, "");
  await storeField(page, { localization: "es-MX" }, "");
  await storeField(page, { country: "de" }, "");
}

const editorOf = (page: Page) =>
  page.getByRole("textbox", { name: "App Store keyword field" });

async function save(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Save keyword field" }).click();
  await expect(page.getByText("Saved keyword field")).toBeVisible();
}

test.describe("keyword fields per localization", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeEach(async ({ page }) => {
    await resetFields(page);
  });

  test("offers the localizations the market reads, default first", async ({
    page,
  }) => {
    await page.goto(`/apps/${APP}/keywords`);
    await page.getByLabel("Localization").click();

    await expect(page.getByRole("option").first()).toHaveText(
      "English (U.S.) · default",
    );
    await expect(
      page.getByRole("option", { name: /Spanish \(Mexico\)/ }),
    ).toBeVisible();
    await expect(page.getByRole("option", { name: /German/ })).toHaveCount(0);
  });

  test("saves the spanish (mexico) field beside the english one", async ({
    page,
  }) => {
    await page.goto(`/apps/${APP}/keywords`);
    await typeInto(editorOf(page), "focus timer");
    await save(page);

    await page.getByLabel("Localization").click();
    await page.getByRole("option", { name: /Spanish \(Mexico\)/ }).click();
    await expect(page).toHaveURL(/fieldLocale=es-MX/);
    await expect(editorOf(page)).toHaveValue("");
    await typeInto(editorOf(page), "temporizador");
    await save(page);

    await page.reload();
    await expect(editorOf(page)).toHaveValue("temporizador");
    await page.goto(`/apps/${APP}/keywords`);
    await expect(editorOf(page)).toHaveValue("focus timer");
    await page.getByLabel("Localization").click();
    await expect(
      page.getByRole("option", { name: "Spanish (Mexico) · saved" }),
    ).toBeVisible();
  });

  test("shows the keyword field in a market other than home", async ({
    page,
  }) => {
    await page.goto(`/apps/${APP}/keywords?country=de`);

    await expect(
      page.getByText("App Store keyword field · German"),
    ).toBeVisible();
    await expect(page.getByText("tracked for your home market")).toHaveCount(0);
    await expect(editorOf(page)).toBeEditable();
  });

  test("names the phrases of a field that are not tracked in this market", async ({
    page,
  }) => {
    await page.goto(`/apps/${APP}/keywords?country=de`);
    await typeInto(editorOf(page), "gewohnheit");
    await save(page);

    await page.goto(`/apps/${APP}/keywords?country=at`);
    await expect(editorOf(page)).toHaveValue("gewohnheit");
    await expect(
      page.getByText("Not tracked in Austria: gewohnheit"),
    ).toBeVisible();

    await save(page);
    await expect(page.getByText("Not tracked in Austria")).toHaveCount(0);
  });

  test("ignores a localization the market does not read", async ({ page }) => {
    await page.goto(`/apps/${APP}/keywords?country=de&fieldLocale=es-MX`);

    await expect(
      page.getByText("App Store keyword field · German"),
    ).toBeVisible();
  });

  test("explains that a code which is no storefront has no keyword field", async ({
    page,
  }) => {
    await page.goto(`/apps/${APP}/keywords?country=zz`);

    await expect(
      page.getByText(
        "ZZ is not an App Store storefront, so it has no keyword field.",
      ),
    ).toBeVisible();
    await expect(editorOf(page)).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Import CSV" }).first(),
    ).toBeVisible();
  });
});
