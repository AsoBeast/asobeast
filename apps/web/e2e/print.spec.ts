import { type Page } from "@playwright/test";
import { expect, test } from "./session.mts";
import { APP_1_DETAIL } from "./fixtures.mts";

const OVERVIEW = `/apps/${APP_1_DETAIL.id}`;

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
