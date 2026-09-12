import { expect, test } from "./session.mts";
import { APP_2_ICON_URL, APP_LONG_ICON_URL } from "./fixtures.mts";

const NAME = "Habit Tracker";
const INITIAL = "H";
const SWITCHER = /^Switch app, currently /;
const PLACEHOLDER = "[data-slot=app-icon-placeholder]";

const PIXEL = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

function optimizerRoute(iconUrl: string) {
  return (url: URL) =>
    url.pathname === "/_next/image" && url.searchParams.get("url") === iconUrl;
}

test("a portfolio icon that fails before hydration falls back to the letter tile", async ({
  page,
}) => {
  await page.route(optimizerRoute(APP_2_ICON_URL), (route) => route.abort());

  await page.goto("/");

  const card = page.locator("[data-slot=card]").filter({ hasText: NAME });
  const placeholder = card.locator(PLACEHOLDER);

  await expect(placeholder).toHaveText(INITIAL);
  await expect(card.locator("img")).toHaveCount(0);
  expect(await placeholder.boundingBox()).toMatchObject({
    width: 48,
    height: 48,
  });
});

test("a switcher icon that fails after hydration falls back to the letter tile", async ({
  page,
}) => {
  await page.route(optimizerRoute(APP_2_ICON_URL), (route) => route.abort());

  await page.goto("/apps/app-2");

  const trigger = page.getByRole("button", { name: SWITCHER });
  const placeholder = trigger.locator(PLACEHOLDER);

  await expect(placeholder).toHaveText(INITIAL);
  await expect(trigger.locator("img")).toHaveCount(0);
  expect(await placeholder.boundingBox()).toMatchObject({
    width: 24,
    height: 24,
  });
});

test("an icon still in flight stays inside its tile and then renders", async ({
  page,
}) => {
  let deliver = () => {};
  const held = new Promise<void>((resolve) => {
    deliver = resolve;
  });
  await page.route(optimizerRoute(APP_2_ICON_URL), async (route) => {
    await held;
    await route.fulfill({ contentType: "image/png", body: PIXEL });
  });

  await page.goto("/apps/app-2");

  const image = page.getByRole("button", { name: SWITCHER }).locator("img");
  await expect(image).toHaveCount(1);
  expect(await image.boundingBox()).toMatchObject({ width: 24, height: 24 });

  deliver();

  await expect(image).toHaveJSProperty("naturalWidth", 1);
});

test("switching to another app retries an icon that already failed", async ({
  page,
}) => {
  await page.route(optimizerRoute(APP_2_ICON_URL), (route) => route.abort());
  await page.route(optimizerRoute(APP_LONG_ICON_URL), (route) =>
    route.fulfill({ contentType: "image/png", body: PIXEL }),
  );

  await page.goto("/apps/app-2");

  const trigger = page.getByRole("button", { name: SWITCHER });
  await expect(trigger.locator(PLACEHOLDER)).toHaveText(INITIAL);

  await trigger.click();
  await page.getByRole("option", { name: /Deep Focus Pomodoro/ }).click();

  await expect(page).toHaveURL("/apps/app-long");
  await expect(trigger.locator("img")).toHaveCount(1);
  await expect(trigger.locator(PLACEHOLDER)).toHaveCount(0);
});
