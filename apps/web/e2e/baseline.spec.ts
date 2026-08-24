import { expect, test, type Page } from "@playwright/test";
import { SESSION_COOKIE } from "@asobeast/shared";
import { SIGNED_IN_ROUTES } from "./routes.mts";

type Capture = {
  page: Page;
  theme: Theme;
  width: number;
  name: string;
  path: string;
};

const WIDTHS = [375, 768, 1024, 1440] as const;
const THEMES = ["light", "dark"] as const;

type Theme = (typeof THEMES)[number];

function cookie(name: string, value: string) {
  return { name, value, domain: "localhost", path: "/" };
}

async function capture({ page, theme, width, name, path }: Capture) {
  await page.goto(path);
  await page.waitForLoadState("networkidle");
  await expect(page.locator("html")).toHaveClass(
    theme === "dark" ? /dark/ : /light/,
  );

  await page.screenshot({
    path: `e2e/__baseline__/${theme}/${width}/${name}.png`,
    fullPage: true,
    animations: "disabled",
    mask: [page.locator("time"), page.getByText(/^Last run /)],
  });
}

for (const theme of THEMES) {
  for (const width of WIDTHS) {
    test(`baseline ${theme} at ${width}`, async ({ page, context }) => {
      await page.addInitScript(
        (value) => window.localStorage.setItem("theme", value),
        theme,
      );
      await page.emulateMedia({ colorScheme: theme });
      await page.setViewportSize({ width, height: 900 });

      await context.addCookies([cookie(SESSION_COOKIE, "e2e")]);
      for (const [name, path] of SIGNED_IN_ROUTES) {
        await capture({ page, theme, width, name, path });
      }

      await context.clearCookies();
      await capture({ page, theme, width, name: "login", path: "/login" });

      await context.addCookies([cookie("e2e_setup_required", "1")]);
      await capture({
        page,
        theme,
        width,
        name: "register",
        path: "/register",
      });
    });
  }
}
