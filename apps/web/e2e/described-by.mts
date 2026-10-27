import type { Locator } from "@playwright/test";

export const missingDescriptionIds = (element: Locator): Promise<string[]> =>
  element.evaluate((node) =>
    (node.getAttribute("aria-describedby") ?? "")
      .split(/\s+/)
      .filter((id) => id.length > 0 && document.getElementById(id) === null),
  );
