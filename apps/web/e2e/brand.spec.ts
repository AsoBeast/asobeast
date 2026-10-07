import { expect, test } from "./reporting.mts";
import { renderedRgb, renderedTokenRgb, type Rgb } from "./colour.mts";
import { test as signedIn } from "./session.mts";

const LANDING_ORANGE: Rgb = [248, 152, 32];
const LANDING_HOVER: Rgb = [232, 128, 16];
const THEMES = ["light", "dark"] as const;

function channelGap(actual: Rgb, expected: Rgb): number {
  return Math.max(
    ...actual.map((channel, index) => Math.abs(channel - expected[index]!)),
  );
}

for (const theme of THEMES) {
  test.describe(`${theme} theme`, () => {
    test.beforeEach(async ({ page }) => {
      await page.addInitScript(
        (value) => window.localStorage.setItem("theme", value),
        theme,
      );
      await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
      await page.goto("/login");
    });

    test("the primary button wears the landing orange with ink text", async ({
      page,
    }) => {
      const signIn = page.getByRole("button", { name: "Sign in" });

      expect(
        channelGap(
          await renderedRgb(signIn, "backgroundColor"),
          LANDING_ORANGE,
        ),
      ).toBeLessThanOrEqual(1);
      expect(await renderedRgb(signIn, "color")).toEqual(
        await renderedTokenRgb(page, "--neutral-950"),
      );

      await signIn.hover();
      await expect
        .poll(async () =>
          channelGap(
            await renderedRgb(signIn, "backgroundColor"),
            LANDING_HOVER,
          ),
        )
        .toBeLessThanOrEqual(1);
    });

    test("the primary button shows a solid ring offset from its fill", async ({
      page,
    }) => {
      const signIn = page.getByRole("button", { name: "Sign in" });
      await signIn.focus();
      await expect
        .poll(() =>
          signIn.evaluate((element) => element.matches(":focus-visible")),
        )
        .toBe(true);

      const boxShadow = () =>
        signIn.evaluate((element) => getComputedStyle(element).boxShadow);
      await expect.poll(boxShadow).toMatch(/0px 0px 0px 2px.*0px 0px 0px 4px/);
      expect(await boxShadow()).not.toMatch(/\/\s*0?\.5\)|50%/);
    });
  });
}

signedIn("settings keeps the orange for its main actions", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/settings");
  await expect(
    page.getByRole("button", { name: "Connect an agent" }),
  ).toBeVisible();

  const filled = page.locator('button[data-variant="default"]:visible');
  expect(await filled.count()).toBeLessThanOrEqual(2);
});

signedIn("action rows mark done without a filled button", async ({ page }) => {
  await page.goto("/actions");
  const done = page.locator('[data-command="done"]').first();
  await expect(done).toBeVisible();
  await expect(done).toHaveAttribute("data-variant", "secondary");
});
