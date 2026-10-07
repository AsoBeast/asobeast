import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { test as signedOut } from "./reporting.mts";
import { SIGNED_IN_ROUTES, SIGNED_OUT_ROUTES, seedCookies } from "./routes.mts";
import { expect, test } from "./session.mts";

const THEMES = ["light", "dark"] as const;

type Theme = (typeof THEMES)[number];

async function contrastViolations(page: Page, theme: Theme, path: string) {
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

for (const theme of THEMES) {
  for (const [name, path] of SIGNED_IN_ROUTES) {
    test(`${name} has no contrast violation in the ${theme} theme`, async ({
      page,
    }) => {
      expect(await contrastViolations(page, theme, path)).toEqual([]);
    });
  }

  for (const [name, path, cookies] of SIGNED_OUT_ROUTES) {
    signedOut(
      `${name} has no contrast violation in the ${theme} theme`,
      async ({ page, context }) => {
        await seedCookies(context, cookies);
        expect(await contrastViolations(page, theme, path)).toEqual([]);
      },
    );
  }
}
