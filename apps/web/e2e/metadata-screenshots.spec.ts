import { randomUUID } from "node:crypto";
import type { Page } from "@playwright/test";
import { expect, test } from "./session.mts";
import { UNREAD_MARKET_COOKIE } from "./fixtures.mts";
import { seedCookies } from "./routes.mts";

const strip = (page: Page) =>
  page.getByRole("list", { name: "Screenshots in store order" });

const STRIP_HEIGHT = 224;
const LANDSCAPE_PIXELS =
  "iVBORw0KGgoAAAANSUhEUgAAAAIAAAABCAIAAAB7QOjdAAAAC0lEQVR4nGNoAAMACocDAcTGH2YAAAAASUVORK5CYII=";
const PORTRAIT_PIXELS =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAACCAIAAAAW4yFwAAAADklEQVR4nGPo6OhgAGIADMgDMYVmI7sAAAAASUVORK5CYII=";

const isScreenshot = (url: URL, file: string) =>
  url.pathname === "/_next/image" &&
  (url.searchParams.get("url") ?? "").includes(`/e2e-focus/${file}/`);

const routeScreenshot = (page: Page, file: string, pixels: string) =>
  page.route(
    (url) => isScreenshot(url, file),
    (route) =>
      route.fulfill({
        contentType: "image/png",
        body: Buffer.from(pixels, "base64"),
      }),
  );

const requestedWidth = (page: Page, name: string) =>
  strip(page)
    .getByRole("img", { name, exact: true })
    .evaluate((node: HTMLImageElement) =>
      Number(new URL(node.currentSrc).searchParams.get("w")),
    );

const boxOf = async (page: Page, name: string) => {
  const image = strip(page).getByRole("img", { name, exact: true });
  await expect(image).toBeVisible();
  await expect
    .poll(() => image.evaluate((node) => node.getBoundingClientRect().height))
    .toBeGreaterThan(0);
  const box = await image.boundingBox();
  if (!box) throw new Error(`no box for ${name}`);
  return box;
};

const coverageTable = (page: Page) =>
  page.getByRole("table", { name: /Keyword coverage across/ });

test("lists every screenshot in store order with the caption read from it", async ({
  page,
}) => {
  await page.goto("/apps/app-1/metadata");

  await expect(strip(page)).toHaveAttribute("tabindex", "0");
  const items = strip(page).getByRole("listitem");
  await expect(items).toHaveCount(4);
  await expect(items.nth(0)).toContainText("Focus timer for deep work");
  await expect(items.nth(1)).toContainText("The productivity app that sticks");
  await expect(items.nth(2)).toContainText("No caption");
  await expect(items.nth(3)).toContainText("Could not read");
  await expect(
    page.getByText("2 of 4 screenshots carry a caption."),
  ).toBeVisible();
});

test("draws a screenshot at its own aspect ratio instead of cropping it", async ({
  page,
}) => {
  await page.goto("/apps/app-1/metadata");
  const image = strip(page).getByRole("img", {
    name: "Screenshot 1",
    exact: true,
  });
  await expect
    .poll(() => image.evaluate((node: HTMLImageElement) => node.naturalWidth))
    .toBeGreaterThan(0);

  const box = await boxOf(page, "Screenshot 1");

  expect(Math.round(box.height)).toBe(STRIP_HEIGHT);
  expect(Math.abs(box.width - box.height)).toBeLessThanOrEqual(1);
});

test("draws a landscape screenshot whole without covering the next one", async ({
  page,
}) => {
  await routeScreenshot(page, "1.jpg", LANDSCAPE_PIXELS);
  await page.goto("/apps/app-1/metadata");
  const image = strip(page).getByRole("img", {
    name: "Screenshot 1",
    exact: true,
  });
  await expect
    .poll(() => image.evaluate((node: HTMLImageElement) => node.naturalWidth))
    .toBe(2);

  const box = await boxOf(page, "Screenshot 1");
  const next = await boxOf(page, "Screenshot 2");

  expect(Math.round(box.height)).toBe(STRIP_HEIGHT);
  expect(Math.abs(box.width - 2 * box.height)).toBeLessThanOrEqual(3);
  expect(next.x).toBeGreaterThanOrEqual(box.x + box.width);
});

test("requests a rendition as wide as the landscape screenshot is drawn", async ({
  page,
}) => {
  await routeScreenshot(page, "1.jpg", LANDSCAPE_PIXELS);
  await page.goto("/apps/app-1/metadata");
  const image = strip(page).getByRole("img", {
    name: "Screenshot 1",
    exact: true,
  });
  await expect
    .poll(() => image.evaluate((node: HTMLImageElement) => node.naturalWidth))
    .toBe(2);

  const box = await boxOf(page, "Screenshot 1");

  await expect
    .poll(() => requestedWidth(page, "Screenshot 1"))
    .toBeGreaterThanOrEqual(box.width);
});

test("keeps a portrait screenshot on a small rendition", async ({ page }) => {
  await routeScreenshot(page, "2.jpg", PORTRAIT_PIXELS);
  let requests = 0;
  page.on("request", (request) => {
    if (isScreenshot(new URL(request.url()), "2.jpg")) requests += 1;
  });
  await page.goto("/apps/app-1/metadata");
  const image = strip(page).getByRole("img", {
    name: "Screenshot 2",
    exact: true,
  });
  await expect
    .poll(() => image.evaluate((node: HTMLImageElement) => node.naturalHeight))
    .toBe(2);
  await page.waitForLoadState("networkidle");

  expect(requests).toBe(1);
  expect(await requestedWidth(page, "Screenshot 2")).toBeLessThanOrEqual(256);
});

test("adds a screenshot text column that does not count as coverage", async ({
  page,
}) => {
  await page.goto("/apps/app-1/metadata");

  const table = coverageTable(page);
  await expect(
    table.getByRole("columnheader", { name: /Screenshot text/ }),
  ).toBeVisible();
  await expect(
    table
      .getByRole("row", { name: /productivity app/ })
      .getByText("in screenshot text"),
  ).toBeAttached();
  await expect(
    table.getByRole("row", { name: /productivity app/ }).getByText("Uncovered"),
  ).toBeVisible();
  await expect(
    page.getByText(
      "Screenshot text is a weak signal that Apple has not confirmed. It never changes whether a keyword counts as covered.",
    ),
  ).toBeVisible();
});

test("marks a keyword whose market listing was never read as not read", async ({
  page,
  context,
}) => {
  await seedCookies(context, { [UNREAD_MARKET_COOKIE]: "1" });
  await page.goto("/apps/app-1/metadata");

  const table = coverageTable(page);
  const unread = table.getByRole("row", { name: /minuteur focus/ });
  await expect(unread.getByText("screenshot text not read")).toBeAttached();
  await expect(unread.getByText("missing from screenshot text")).toHaveCount(0);
  await expect(
    table
      .getByRole("row", { name: /pomodoro/ })
      .getByText("missing from screenshot text"),
  ).toBeAttached();
  await expect(
    page.getByText(
      "A dashed circle means the screenshots of that keyword's listing have not been read yet.",
    ),
  ).toBeVisible();
});

test("keeps the uncovered filter on indexed fields only", async ({ page }) => {
  await page.goto("/apps/app-1/metadata");

  await page.getByRole("switch", { name: "Uncovered only" }).click();

  await expect(page.getByText("1 of 3 keywords")).toBeVisible();
  await expect(
    coverageTable(page).getByRole("row", { name: /productivity app/ }),
  ).toBeVisible();
});

test("says reading is switched off and hides the column", async ({
  page,
  context,
}) => {
  await seedCookies(context, { e2e_screenshots_off: "1" });
  await page.goto("/apps/app-1/metadata");

  await expect(
    page.getByText("Reading screenshot text is switched off on this instance."),
  ).toBeVisible();
  await expect(
    coverageTable(page).getByRole("columnheader", { name: /Screenshot text/ }),
  ).toHaveCount(0);
});

test("shows no screenshot card for a google play app", async ({ page }) => {
  await page.goto("/apps/app-gp/metadata");

  await expect(
    page.getByRole("list", { name: "Screenshots in store order" }),
  ).toHaveCount(0);
  await expect(page.getByText("Screenshot captions")).toHaveCount(0);
});

test("updates the card on its own when pending screenshots settle", async ({
  page,
  context,
}) => {
  await seedCookies(context, { e2e_screenshots_pending: randomUUID() });
  await page.goto("/apps/app-1/metadata");

  await expect(
    page.getByText(
      "Reading 1 of 4 screenshots. This page updates when they are done.",
    ),
  ).toBeVisible();
  await expect(
    page.getByText("2 of 4 screenshots carry a caption."),
  ).toBeVisible({
    timeout: 15_000,
  });
});

test("shows a screenshot again after switching away from a market whose image failed", async ({
  page,
}) => {
  await page.route(
    (url) =>
      url.pathname === "/_next/image" &&
      (url.searchParams.get("url") ?? "").includes("/e2e-focus/1.jpg/"),
    (route) => route.abort(),
  );
  await page.goto("/apps/app-1/metadata");
  await expect(
    strip(page).getByRole("img", { name: "Screenshot 1, image unavailable" }),
  ).toBeVisible();
  const placeholder = await boxOf(page, "Screenshot 1, image unavailable");
  expect(Math.round(placeholder.height)).toBe(STRIP_HEIGHT);

  await page.getByRole("combobox", { name: "Listing market" }).click();
  await page.getByRole("option", { name: "PL · Poland" }).click();

  await expect(page).toHaveURL(/market=pl/);
  await expect(
    strip(page).getByRole("img", { name: "Screenshot 1", exact: true }),
  ).toBeVisible();
});
