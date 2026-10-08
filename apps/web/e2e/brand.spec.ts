import { expect, test } from "./reporting.mts";
import { renderedRgb, renderedTokenRgb, type Rgb } from "./colour.mts";
import { test as signedIn } from "./session.mts";

const LANDING_ORANGE: Rgb = [248, 152, 32];
const LANDING_HOVER: Rgb = [232, 128, 16];
const THEMES = ["light", "dark"] as const;
const SETTINGS_TRIGGERS = [
  "Flush now",
  "Add webhook",
  "Add email alert",
  "New token",
  "Connect an agent",
];

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
      const settlesOn = (expected: Rgb) =>
        expect
          .poll(async () =>
            channelGap(await renderedRgb(signIn, "backgroundColor"), expected),
          )
          .toBeLessThanOrEqual(1);

      await settlesOn(LANDING_ORANGE);
      const ink = await renderedTokenRgb(page, "--neutral-950");
      await expect.poll(() => renderedRgb(signIn, "color")).toEqual(ink);

      await signIn.hover();
      await settlesOn(LANDING_HOVER);
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

signedIn(
  "settings outlines its dialog triggers and fills nothing else",
  async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/settings");
    for (const name of SETTINGS_TRIGGERS) {
      await expect(
        page.getByRole("button", { name, exact: true }),
      ).toHaveAttribute("data-variant", "outline");
    }

    await expect(
      page.locator('button[data-variant="default"]:visible'),
    ).toHaveCount(0);
  },
);

signedIn("action rows mark done without a filled button", async ({ page }) => {
  await page.goto("/actions");
  const done = page.locator('[data-command="done"]').first();
  await expect(done).toBeVisible();
  await expect(done).toHaveAttribute("data-variant", "secondary");
});
