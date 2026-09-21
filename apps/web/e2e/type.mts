import { expect, type Locator } from "@playwright/test";

export async function typeInto(field: Locator, value: string): Promise<void> {
  await expect(async () => {
    await field.fill(value);
    await expect(field).toHaveValue(value, { timeout: 1000 });
  }).toPass();
}
