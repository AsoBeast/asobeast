import { expect, type Locator, type Page } from "@playwright/test";

export async function hoverForTooltip(
  page: Page,
  trigger: Locator,
  content: Locator,
  position?: { x: number; y: number },
): Promise<void> {
  await expect(async () => {
    await page.mouse.move(0, 0);
    await trigger.hover(position ? { position } : undefined);
    await expect(content).toBeVisible({ timeout: 1500 });
  }).toPass();
}
