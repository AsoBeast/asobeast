import type { Page } from "@playwright/test";
import { hydrated } from "./hydrated.mts";
import { expect, test } from "./session.mts";

const KEYWORDS = "/apps/app-1/keywords?q=timer&status=active";

const chips = (page: Page) =>
  page.getByRole("list", { name: "Active filters" });

const focusedName = (page: Page) =>
  page.evaluate(() => {
    const active = document.activeElement;
    if (!active || active === document.body) return "body";
    return active.getAttribute("aria-label") ?? active.textContent ?? "";
  });

async function pressFromKeyboard(page: Page, name: string | RegExp) {
  const button = chips(page).getByRole("button", { name });
  await (await hydrated(button)).focus();
  await page.keyboard.press("Enter");
}

test("removing a chip hands focus to the next chip", async ({ page }) => {
  await page.goto(KEYWORDS);

  await pressFromKeyboard(page, "Remove Search: timer");

  await expect(page).not.toHaveURL(/q=timer/);
  await expect(
    chips(page).getByRole("button", { name: "Remove Status: Active" }),
  ).toBeFocused();
});

test("removing the last chip hands focus to a control above the chips", async ({
  page,
}) => {
  await page.goto("/apps/app-1/keywords?q=timer");

  await pressFromKeyboard(page, "Remove Search: timer");

  await expect(chips(page)).toHaveCount(0);
  await expect.poll(() => focusedName(page)).not.toBe("body");
  await expect(page.getByRole("button", { name: /^Export CSV/ })).toBeFocused();
});

test("Clear all hands focus to a control above the chips", async ({ page }) => {
  await page.goto(KEYWORDS);

  await pressFromKeyboard(page, "Clear all");

  await expect(chips(page)).toHaveCount(0);
  await expect.poll(() => focusedName(page)).not.toBe("body");
  await expect(page.getByRole("button", { name: /^Export CSV/ })).toBeFocused();
});
