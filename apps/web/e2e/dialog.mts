import { expect, type Locator, type Page } from "@playwright/test";

export async function openSettledDialog(
  page: Page,
  trigger: string,
): Promise<Locator> {
  await page
    .getByRole("button", { name: trigger, exact: true })
    .first()
    .click();

  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: trigger })).toBeVisible();
  await dialog.evaluate((node) =>
    Promise.all(
      node.getAnimations().map((animation) => animation.finished),
    ).then(() => undefined),
  );

  return dialog;
}
