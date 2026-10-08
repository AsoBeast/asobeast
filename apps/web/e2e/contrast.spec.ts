import { contrastViolations, THEMES } from "./contrast-check.mts";
import { test as signedOut } from "./reporting.mts";
import { SIGNED_IN_ROUTES, SIGNED_OUT_ROUTES, seedCookies } from "./routes.mts";
import { expect, test } from "./session.mts";

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
