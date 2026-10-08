import { contrastViolations, THEMES } from "./contrast-check.mts";
import { expect, test } from "./session.mts";

const LOCALIZATION = "Localization";
const DEFAULT = "English (U.K.) · default";
const POLISH_TITLE = "Skupienie: Minutnik Pracy";

test("switches to the polish localization of the polish market", async ({
  page,
}) => {
  await page.goto("/apps/app-1/metadata?market=pl");

  const switcher = page.getByRole("combobox", { name: LOCALIZATION });
  await expect(switcher).toHaveText(DEFAULT);
  await switcher.click();
  await expect(page.getByRole("option")).toHaveText([DEFAULT, "Polish"]);
  await page.getByRole("option", { name: "Polish" }).click();

  await expect(page).toHaveURL(/localization=pl/);
  await expect(page.getByText(POLISH_TITLE).first()).toBeVisible();
  await expect(page.getByText("Skup się na jednym zadaniu")).toBeVisible();

  const market = page.getByRole("combobox", { name: "Listing market" });
  await market.click();
  await page.getByRole("option", { name: "US · United States (home)" }).click();

  await expect(page).not.toHaveURL(/localization=/);
  await expect(page.getByRole("combobox", { name: LOCALIZATION })).toHaveCount(
    0,
  );
});

test("shows no localization switcher without a localization", async ({
  page,
}) => {
  for (const path of ["/apps/app-1/metadata", "/apps/app-2/metadata"]) {
    await page.goto(path);
    await expect(
      page.getByRole("heading", { level: 2, name: "Keyword coverage" }),
    ).toBeVisible();
    await expect(
      page.getByRole("combobox", { name: LOCALIZATION }),
    ).toHaveCount(0);
  }
});

test("names the language of a cell covered only by a localization", async ({
  page,
}) => {
  await page.goto("/apps/app-1/metadata?market=pl");

  const row = page.getByRole("row").filter({ hasText: "skupienie" });
  await expect(row.getByText("in Title (Polish)")).toHaveCount(1);
});

test("names the language of a localized change", async ({ page }) => {
  await page.goto("/apps/app-1/changes?market=pl");

  await expect(page.getByText("Title · Polish")).toBeVisible();
});

test("server renders the localization switcher and the localized listing", async ({
  page,
}) => {
  const response = await page.request.get(
    "/apps/app-1/metadata?market=pl&localization=pl",
  );
  const html = await response.text();

  expect(html).toContain(LOCALIZATION);
  expect(html).toContain(POLISH_TITLE);
});

for (const theme of THEMES) {
  test(`the localized metadata page has no contrast violation in the ${theme} theme`, async ({
    page,
  }) => {
    expect(
      await contrastViolations(
        page,
        theme,
        "/apps/app-1/metadata?market=pl&localization=pl",
      ),
    ).toEqual([]);
  });
}
