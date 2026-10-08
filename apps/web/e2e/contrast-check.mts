import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";

export const THEMES = ["light", "dark"] as const;

type Theme = (typeof THEMES)[number];

export async function contrastViolations(
  page: Page,
  theme: Theme,
  path: string,
) {
  await page.addInitScript(
    (value) => window.localStorage.setItem("theme", value),
    theme,
  );
  await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
  await page.goto(path);
  await page.waitForLoadState("networkidle");

  const { violations } = await new AxeBuilder({ page })
    .withRules(["color-contrast"])
    .analyze();

  return violations.flatMap(({ nodes }) =>
    nodes.map(({ target, any }) => ({
      target: target.join(" "),
      detail: any[0]?.message ?? "",
    })),
  );
}
