import { expect, type Locator, type Page } from "@playwright/test";

export async function openSettledDialog(
  page: Page,
  trigger: string,
  scope: Page | Locator = page,
): Promise<Locator> {
  await scope
    .getByRole("button", { name: trigger, exact: true })
    .first()
    .click();

  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: trigger })).toBeVisible();
  await settleAnimations(dialog);

  return dialog;
}

export async function settleAnimations(element: Locator): Promise<void> {
  await element.evaluate((node) =>
    Promise.all(
      node.getAnimations().map((animation) => animation.finished),
    ).then(() => undefined),
  );
}

export async function expectFitsViewport(page: Page, dialog: Locator) {
  const viewport = page.viewportSize();
  if (viewport === null) throw new Error("viewport size is unavailable");

  const box = await dialog.boundingBox();
  if (box === null) throw new Error("the dialog has no layout box");

  expect(
    box.y,
    "the dialog must not extend above the viewport",
  ).toBeGreaterThan(-1);
  expect(
    box.y + box.height,
    "the dialog must not extend below the viewport",
  ).toBeLessThan(viewport.height + 1);
  expect(
    box.x,
    "the dialog must not extend past the left edge",
  ).toBeGreaterThan(-1);
  expect(
    box.x + box.width,
    "the dialog must not extend past the right edge",
  ).toBeLessThan(viewport.width + 1);
}

export async function expectContains(outer: Locator, inner: Locator) {
  const outerBox = await outer.boundingBox();
  const innerBox = await inner.boundingBox();
  if (outerBox === null || innerBox === null) {
    throw new Error("an element has no layout box");
  }

  expect(innerBox.y, "content must start inside the dialog").toBeGreaterThan(
    outerBox.y - 1,
  );
  expect(
    innerBox.y + innerBox.height,
    "content must end inside the dialog",
  ).toBeLessThan(outerBox.y + outerBox.height + 1);
  expect(
    innerBox.x,
    "content must stay inside the left edge of the dialog",
  ).toBeGreaterThan(outerBox.x - 1);
  expect(
    innerBox.x + innerBox.width,
    "content must stay inside the right edge of the dialog",
  ).toBeLessThan(outerBox.x + outerBox.width + 1);
}
