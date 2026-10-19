import { expect, test } from "./session.mts";
import { APP_1_DETAIL, APP_GP_DETAIL } from "./fixtures.mts";

const suggestionsHint = (store: string) =>
  new RegExp(
    `Search, Similar apps, More by developer, and Competitor searches run a live ${store} lookup`,
  );

test("a google play keywords page names google play in the suggestions hint", async ({
  page,
}) => {
  await page.goto(`/apps/${APP_GP_DETAIL.id}/keywords`);

  await expect(page.getByText(suggestionsHint("Google Play"))).toBeVisible();
  await expect(page.getByText(suggestionsHint("App Store"))).toHaveCount(0);
});

test("an app store keywords page names the app store in the suggestions hint", async ({
  page,
}) => {
  await page.goto(`/apps/${APP_1_DETAIL.id}/keywords`);

  await expect(page.getByText(suggestionsHint("App Store"))).toBeVisible();
});

for (const width of [375, 1440] as const) {
  test(`the suggestion sources never scroll vertically at ${width} px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`/apps/${APP_1_DETAIL.id}/keywords`);
    await page.getByRole("button", { name: /^Suggestions/ }).click();

    const sources = page
      .getByRole("tablist")
      .filter({ has: page.getByRole("tab", { name: "Similar apps" }) });
    await expect(sources.getByRole("tab", { name: "Metadata" })).toBeVisible();

    const overflow = await sources.evaluate((strip) => {
      const style = getComputedStyle(strip);
      const scrolls = (overflow: string, content: number, box: number) =>
        ["auto", "scroll"].includes(overflow) && content > box;
      return {
        x: scrolls(style.overflowX, strip.scrollWidth, strip.clientWidth),
        y: scrolls(style.overflowY, strip.scrollHeight, strip.clientHeight),
      };
    });
    expect(overflow).toEqual({ x: width < 768, y: false });
  });
}
