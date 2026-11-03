import type { Locator } from "@playwright/test";

export async function layoutBox(locator: Locator) {
  const box = await locator.boundingBox();
  if (box === null) throw new Error(`${locator} has no layout box`);
  return box;
}
