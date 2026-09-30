import { expect, type Locator } from "@playwright/test";

export async function hydrated(control: Locator): Promise<Locator> {
  await expect
    .poll(() =>
      control.evaluate((element) =>
        Object.keys(element).some((key) => key.startsWith("__reactProps")),
      ),
    )
    .toBe(true);
  return control;
}
