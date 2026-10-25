import { expect, type Locator, type Page } from "@playwright/test";
import { hydrated } from "./hydrated.mts";

export interface HeldRequest {
  release: () => void;
}

export async function holdRequest(
  page: Page,
  url: RegExp,
  method: string,
): Promise<HeldRequest> {
  const { promise, resolve } = Promise.withResolvers<void>();
  await page.route(url, async (route) => {
    if (route.request().method() !== method) return route.fallback();
    await promise;
    return route.fallback();
  });
  return { release: resolve };
}

export async function pressFromKeyboard(control: Locator): Promise<void> {
  await (await hydrated(control)).focus();
  await control.page().keyboard.press("Enter");
}

export async function expectFocusKeptWhileHeld(
  control: Locator,
  held: HeldRequest,
): Promise<void> {
  await expect(control).toHaveAttribute("aria-disabled", "true");
  await expect(control).not.toHaveAttribute("disabled");
  await expect(control).toBeFocused();
  held.release();
  await expect(control).not.toHaveAttribute("aria-disabled", "true");
  await expect(control).toBeFocused();
}
