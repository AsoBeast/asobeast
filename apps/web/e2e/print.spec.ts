import { type Page } from "@playwright/test";
import { expect, test } from "./session.mts";
import { APP_1_DETAIL } from "./fixtures.mts";

const OVERVIEW = `/apps/${APP_1_DETAIL.id}`;
const APP_NAME = APP_1_DETAIL.name ?? "";

async function open(page: Page, path: string, width = 1440) {
  await page.setViewportSize({ width, height: 900 });
  await page.goto(path);
  await page.waitForLoadState("networkidle");
}

function printed(page: Page) {
  return page.emulateMedia({ media: "print" });
}

function bodyLuminance(page: Page, property: "backgroundColor" | "color") {
  return page.evaluate((name) => {
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("no 2d context");
    context.fillStyle = getComputedStyle(document.body)[name];
    context.fillRect(0, 0, 1, 1);
    const [red, green, blue] = context.getImageData(0, 0, 1, 1).data;
    return (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255;
  }, property);
}

test("prints in the light theme while the dark theme is stored", async ({
  page,
}) => {
  await page.addInitScript(() => window.localStorage.setItem("theme", "dark"));
  await open(page, OVERVIEW);
  await expect(page.locator("html")).toHaveClass(/dark/);
  expect(await bodyLuminance(page, "backgroundColor")).toBeLessThan(0.2);

  await printed(page);

  expect(await bodyLuminance(page, "backgroundColor")).toBeGreaterThan(0.9);
  expect(await bodyLuminance(page, "color")).toBeLessThan(0.3);
  expect(
    await page
      .locator("html")
      .evaluate((node) => getComputedStyle(node).colorScheme),
  ).toBe("light");
});

test("leaves the app shell out of the printout", async ({ page }) => {
  await open(page, OVERVIEW);
  const navigation = page.getByRole("navigation", { name: "Main" });
  await expect(navigation).toBeVisible();
  await expect(page.getByRole("banner")).toHaveCount(1);

  await printed(page);

  await expect(navigation).toHaveCount(0);
  await expect(page.getByRole("banner")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Skip to content" })).toHaveCount(
    0,
  );
  await expect(page.getByRole("link", { name: "Store page" })).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Link store listing" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("heading", { level: 1, name: APP_NAME }),
  ).toBeVisible();

  const layout = await page.evaluate(() => {
    const main = document.querySelector("main");
    const inset = document.querySelector("[data-slot='sidebar-inset']");
    if (!main || !inset) throw new Error("shell missing");
    const box = main.getBoundingClientRect();
    const style = getComputedStyle(inset);
    return {
      left: box.left,
      right: box.right,
      viewport: document.documentElement.clientWidth,
      scroll: document.documentElement.scrollWidth,
      margin: style.marginTop,
      shadow: style.boxShadow,
    };
  });
  expect(layout.left).toBeLessThan(1);
  expect(layout.right).toBeLessThanOrEqual(layout.viewport);
  expect(layout.scroll).toBeLessThanOrEqual(layout.viewport);
  expect(layout.margin).toBe("0px");
  expect(layout.shadow).toBe("none");
});

test("leaves the system banner out of the printout", async ({
  page,
  context,
}) => {
  await context.addCookies([
    { name: "e2e_store_broken", value: "1", domain: "localhost", path: "/" },
  ]);
  await open(page, OVERVIEW);
  const banner = page
    .getByRole("alert")
    .filter({ hasText: "parsing looks broken" });
  await expect(banner).toBeVisible();

  await printed(page);

  await expect(banner).toBeHidden();
});

test("leaves toasts out of the printout", async ({ page }) => {
  await open(page, OVERVIEW);
  await page.getByRole("button", { name: "Run daily" }).click();
  const toast = page.getByText(/^Queued · rank checks for 5 keywords$/);
  await expect(toast).toBeVisible();

  await printed(page);

  await expect(toast).toBeHidden({ timeout: 1000 });
});
