import type { Page } from "@playwright/test";
import { clipboardPng, isPng, readPng } from "./chart-image.mts";
import { expect, test } from "./session.mts";

const chart = (page: Page) =>
  page.getByRole("region", { name: "Keyword rank positions" });

test.beforeEach(({ context }) => context.grantPermissions(["clipboard-read"]));

for (const theme of ["light", "dark"] as const) {
  test(`Copy image draws the colours of the ${theme} theme in this engine`, async ({
    page,
  }) => {
    await page.addInitScript(
      (value) => window.localStorage.setItem("theme", value),
      theme,
    );
    await page.emulateMedia({ colorScheme: theme });
    await page.goto("/apps/app-1/rankings");
    await expect(chart(page)).toBeVisible();

    await page
      .getByRole("button", { name: "Copy image of the rankings chart" })
      .click();
    await expect(page.getByText("Chart copied")).toBeVisible();

    const png = await clipboardPng(page);
    expect(isPng(png)).toBe(true);
    const reading = await readPng(page, png, "--chart-1");
    expect(reading.corner).toEqual(reading.background);
    expect(reading.seriesPixels).toBeGreaterThan(100);
  });
}

test("Download PNG saves a picture in this engine", async ({ page }) => {
  await page.goto("/apps/app-1/rankings");
  await expect(chart(page)).toBeVisible();

  const [file] = await Promise.all([
    page.waitForEvent("download"),
    page
      .getByRole("button", { name: "Download PNG of the rankings chart" })
      .click(),
  ]);

  expect(file.suggestedFilename()).toMatch(
    /^asobeast-rankings-focus-timer-.*\.png$/,
  );
});
