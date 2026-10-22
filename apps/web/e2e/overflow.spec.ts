import { expect, test } from "./session.mts";
import { settleAnimations } from "./dialog.mts";
import { seedCookies } from "./routes.mts";

const WIDTHS = [375, 768, 1440] as const;
const LONG_SEARCH = `q=${"a".repeat(400)}`;

interface RouteSetup {
  readonly cookies?: Readonly<Record<string, string>>;
  readonly opensDialog?: boolean;
}

const ROUTES: ReadonlyArray<readonly [string, string, RouteSetup?]> = [
  ["app overview", "/apps/app-long"],
  ["keyword workspace", "/apps/app-long/keywords"],
  ["portfolio", "/"],
  ["app audit", "/apps/app-long/audit"],
  ["play audit", "/apps/app-gp/audit"],
  ["competitors", "/apps/app-1/competitors"],
  [
    "competitors with every section collapsed",
    "/apps/app-1/competitors",
    {
      cookies: {
        asobeast_collapsed:
          "competitors.tracked%2Ccompetitors.discovery%2Ccompetitors.matrix",
      },
    },
  ],
  ["metadata", "/apps/app-1/metadata"],
  [
    "metadata with a localization open",
    "/apps/app-1/metadata?fieldLocale=en-GB",
  ],
  ["keyword combinations", "/apps/app-long/keywords?combos=true"],
  ["metadata with a long listing", "/apps/app-long/metadata"],
  ["metadata of an arabic play listing", "/apps/app-ar/metadata"],
  ["changes", "/apps/app-1/changes"],
  ["dashboard table", "/?view=table"],
  ["dashboard many apps", "/", { cookies: { portfolio_many: "1" } }],
  ["action center", "/actions"],
  ["keyword search with a long term", `/apps/app-1/keywords?${LONG_SEARCH}`],
  ["metadata search with a long term", `/apps/app-1/metadata?${LONG_SEARCH}`],
  ["action center search with a long term", `/actions?${LONG_SEARCH}`],
  ["app action center", "/apps/app-1/actions"],
  ["action sheet", "/actions?action=act-push", { opensDialog: true }],
  ["top charts", "/charts"],
  ["top charts table", "/charts?view=table"],
  ["top charts on google play", "/charts?store=GOOGLE_PLAY&genre=GAME_PUZZLE"],
];

async function overflowingElements(page: import("@playwright/test").Page) {
  return page.evaluate(() => {
    const scrollsHorizontally = (node: HTMLElement) =>
      ["auto", "scroll"].includes(getComputedStyle(node).overflowX);

    const insideScroller = (node: HTMLElement) => {
      for (let el = node.parentElement; el; el = el.parentElement) {
        if (scrollsHorizontally(el)) return true;
      }
      return false;
    };

    const limit = document.documentElement.clientWidth;
    return Array.from(document.querySelectorAll<HTMLElement>("body *"))
      .filter((node) => {
        const box = node.getBoundingClientRect();
        if (box.width === 0) return false;
        if (box.right <= limit + 1 && box.left >= -1) return false;
        return !insideScroller(node);
      })
      .map((node) => `${node.tagName}.${node.className}`.slice(0, 120))
      .slice(0, 5);
  });
}

for (const width of WIDTHS) {
  for (const [name, path, setup] of ROUTES) {
    test(`${name} contains long user strings at ${width}`, async ({
      page,
      context,
    }) => {
      if (setup?.cookies) await seedCookies(context, setup.cookies);
      await page.setViewportSize({ width, height: 900 });
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      if (setup?.opensDialog) await settleAnimations(page.getByRole("dialog"));

      expect(
        await page.evaluate(
          () =>
            document.documentElement.scrollWidth <=
            document.documentElement.clientWidth,
        ),
        "the document must not scroll horizontally",
      ).toBe(true);

      expect(await overflowingElements(page)).toEqual([]);
    });
  }

  test(`the app title stays within two lines at ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/apps/app-long");
    await page.waitForLoadState("networkidle");

    const heading = page.getByRole("heading", { level: 1 });
    await expect(heading).toBeVisible();

    const lines = await heading.evaluate((node) => {
      const { lineHeight, fontSize } = getComputedStyle(node);
      const leading =
        lineHeight === "normal"
          ? Number.parseFloat(fontSize) * 1.2
          : Number.parseFloat(lineHeight);
      return Math.round(node.getBoundingClientRect().height / leading);
    });

    expect(lines).toBeLessThanOrEqual(2);
  });

  test(`the action sheet wraps a long keyword at ${width}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/actions?action=act-push");

    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: "Trend" })).toBeVisible();

    expect(
      await dialog.evaluate((node) => node.scrollWidth <= node.clientWidth),
      "the sheet must not scroll sideways",
    ).toBe(true);
    const title = await dialog
      .getByRole("heading", { name: /pomodoro timer for deep focus/ })
      .first()
      .evaluate((node) => node.scrollWidth <= node.clientWidth);
    expect(title, "the sheet title wraps inside itself").toBe(true);
  });
}
