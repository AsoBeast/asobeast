import { expect, test } from "./session.mts";
import { ICON_PIXEL, optimizedIcon } from "./store-icons.mts";
import {
  CROWDED_COMPETITORS_COOKIE,
  CROWDED_ICON_URL,
  CROWDED_RIVALS,
} from "./fixtures.mts";

const ICON_SIZE = 20;
const SORT_ARROW_SIZE = 14;

for (const width of [375, 768, 1440] as const) {
  test(`every competitor logo keeps its square at ${width} px in a crowded matrix`, async ({
    page,
    context,
  }) => {
    await context.addCookies([
      {
        name: CROWDED_COMPETITORS_COOKIE,
        value: "1",
        domain: "localhost",
        path: "/",
      },
    ]);
    await context.route(optimizedIcon(CROWDED_ICON_URL), (route) =>
      route.fulfill({ contentType: "image/png", body: ICON_PIXEL }),
    );
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/apps/app-1/competitors");

    const matrix = page.getByRole("table", {
      name: /compared with each tracked competitor/,
    });
    const logos = matrix.locator("thead img");
    await expect(logos).toHaveCount(CROWDED_RIVALS.length);

    for (const logo of await logos.all()) {
      await logo.scrollIntoViewIfNeeded();
      expect(await logo.boundingBox()).toMatchObject({
        width: ICON_SIZE,
        height: ICON_SIZE,
      });
    }
    for (const arrow of await matrix.locator("thead button > svg").all()) {
      await arrow.scrollIntoViewIfNeeded();
      expect(await arrow.boundingBox()).toMatchObject({
        width: SORT_ARROW_SIZE,
        height: SORT_ARROW_SIZE,
      });
    }
    for (const { name } of CROWDED_RIVALS) {
      await expect(
        matrix.getByRole("button", { name, exact: true }),
      ).toBeAttached();
    }
  });
}
