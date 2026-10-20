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

export async function activateInOneTask(
  first: Locator,
  ...others: Locator[]
): Promise<void> {
  const controls = await Promise.all(
    [first, ...others].map((control) => hydrated(control)),
  );
  const handles = await Promise.all(
    controls.map((control) => control.elementHandle()),
  );
  await first.page().evaluate((elements) => {
    for (const element of elements) (element as HTMLElement).click();
  }, handles);
}

export const activateTwiceInOneTask = (control: Locator): Promise<void> =>
  activateInOneTask(control, control);
