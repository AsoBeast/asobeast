import { version } from "../package.json";
import { contrastRatio } from "../src/lib/contrast";
import { hydrated } from "./hydrated.mts";
import { revealAfterLoad } from "./late-reveal.mts";
import { expect, test } from "./session.mts";
import type { BrowserContext, Page } from "@playwright/test";

const SEEN = "asobeast.whatsNew.seen";

const releases = (page: Page) =>
  page.getByRole("list", { name: "Releases" }).getByRole("article");

const storedSeen = (page: Page) =>
  page.evaluate((key) => window.localStorage.getItem(key), SEEN);

const seedSeen = (context: BrowserContext, value: string) =>
  context.addInitScript(
    ([key, seen]) => {
      if (!window.sessionStorage.getItem("seeded")) {
        window.localStorage.setItem(key, seen);
        window.sessionStorage.setItem("seeded", "1");
      }
    },
    [SEEN, value] as const,
  );

const footer = (page: Page) =>
  page
    .getByRole("navigation", { name: "Main" })
    .locator('[data-slot="sidebar-footer"]');

const whatsNew = (page: Page) =>
  footer(page).getByRole("link", { name: /^What's New/ });

const dot = (page: Page) => whatsNew(page).locator('[data-slot="unread-dot"]');

async function expectUnread(page: Page) {
  await expect(whatsNew(page)).toHaveAttribute("data-unread", "true");
  await expect(whatsNew(page)).toHaveAccessibleName("What's New, new updates");
  await expect(dot(page)).toBeVisible();
}

async function expectQuiet(page: Page) {
  await expect(whatsNew(page)).toHaveAttribute("data-unread", "false");
  await expect(whatsNew(page)).toHaveAccessibleName("What's New");
  await expect(dot(page)).toBeHidden();
}

test.describe("the what's new page", () => {
  test("lists the releases up to the running version, newest first", async ({
    page,
  }) => {
    await page.goto("/whats-new");

    await expect(
      page.getByRole("heading", { level: 1, name: "What's New" }),
    ).toBeVisible();
    const first = releases(page).first();
    await expect(first).toHaveAccessibleName(`Version ${version}`);

    const names = await releases(page).evaluateAll((articles) =>
      articles.map(
        (article) =>
          article.querySelector("h2")?.textContent?.replace("Version ", "") ??
          "",
      ),
    );
    const numbers = names.map((name) => name.split(".").map(Number));
    numbers.slice(1).forEach((current, index) => {
      const previous = numbers[index] ?? [];
      const order =
        (previous[0] ?? 0) - (current[0] ?? 0) ||
        (previous[1] ?? 0) - (current[1] ?? 0) ||
        (previous[2] ?? 0) - (current[2] ?? 0);
      expect(order).toBeGreaterThan(0);
    });
    expect(names.at(-1)).toBe("1.0.0");
  });

  test("names the page in the breadcrumb", async ({ page }) => {
    await page.goto("/whats-new");

    await expect(
      page
        .getByRole("navigation", { name: "breadcrumb" })
        .locator('[aria-current="page"]'),
    ).toHaveText("What's New");
  });

  test("marks only the newest release as latest", async ({ page }) => {
    await page.goto("/whats-new");

    await expect(page.getByText("Latest", { exact: true })).toHaveCount(1);
    await expect(
      releases(page).first().getByText("Latest", { exact: true }),
    ).toBeVisible();
  });

  test("groups the changes under words", async ({ page }) => {
    await page.goto("/whats-new");
    await expect(releases(page).first()).toBeVisible();

    const groups = await releases(page)
      .getByRole("heading", { level: 3 })
      .allTextContents();
    expect(groups.length).toBeGreaterThan(0);
    for (const group of groups) {
      expect(["New", "Improved", "Fixed"]).toContain(group.trim());
    }
  });

  test("writes out the date of each release", async ({ page }) => {
    await page.goto("/whats-new");

    const time = releases(page).first().locator("time");
    await expect(time).toHaveAttribute("datetime", /^\d{4}-\d{2}-\d{2}$/);
    await expect(time).toHaveText(/^[A-Z][a-z]{2} \d{1,2}, \d{4}$/);
  });

  test("remembers the newest release as seen", async ({ page }) => {
    await page.goto("/whats-new");

    await expect.poll(() => storedSeen(page)).toBe(version);
  });

  test("keeps a newer seen release when this version opens the page", async ({
    context,
    page,
  }) => {
    await seedSeen(context, "999.0.0");
    await page.goto("/whats-new");
    await expect(releases(page).first()).toBeVisible();
    await page.waitForLoadState("networkidle");

    expect(await storedSeen(page)).toBe("999.0.0");
  });

  test("renders when browser storage throws", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.addInitScript(() => {
      Storage.prototype.getItem = () => {
        throw new Error("blocked");
      };
      Storage.prototype.setItem = () => {
        throw new Error("blocked");
      };
    });
    await page.goto("/whats-new");

    await expect(releases(page).first()).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("fits a phone without sideways scrolling", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 720 });
    await page.goto("/whats-new");

    await expect(releases(page).first()).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth + 1,
      ),
    ).toBe(true);
  });

  test("draws its loading state inside a phone screen", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 720 });
    const { promise: released, resolve: release } =
      Promise.withResolvers<void>();
    await page.route(/\/whats-new\?_rsc=/, async (route) => {
      if (route.request().headers()["next-router-prefetch"]) {
        return route.fallback();
      }
      await released;
      return route.fallback();
    });
    await page.goto("/settings");
    await page.getByRole("button", { name: "Toggle Sidebar" }).first().click();
    await (await hydrated(whatsNew(page))).click();

    await expect(
      page.locator("main [data-slot='skeleton']").first(),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth + 1,
      ),
    ).toBe(true);
    release();
    await expect(releases(page).first()).toBeVisible();
  });

  test("links the technical notes in a new tab", async ({ page }) => {
    await page.goto("/whats-new");

    const link = page.getByRole("link", { name: "Technical release notes" });
    await expect(link).toHaveAttribute(
      "href",
      "https://github.com/AsoBeast/asobeast/releases",
    );
    await expect(link).toHaveAttribute("target", "_blank");
    await expect(link).toHaveAttribute("rel", /noopener/);
  });

  test("deep links a release", async ({ page }) => {
    await page.goto("/whats-new#release-1-0-0");

    await expect(page.locator("#release-1-0-0")).toBeInViewport();
  });

  test("deep links a release that streams in after the page loaded", async ({
    page,
  }) => {
    const heldReveals = await revealAfterLoad(page);
    await page.goto("/whats-new#release-1-0-0");

    await expect(page.locator("#release-1-0-0")).toBeInViewport();
    expect(await heldReveals()).toBeGreaterThan(0);
  });
});

test.describe("the what's new sidebar item", () => {
  test("sits just before documentation", async ({ page }) => {
    await page.goto("/");

    const names = await footer(page).getByRole("link").allInnerTexts();
    expect(names.slice(0, 2).map((name) => name.trim())).toEqual([
      "What's New",
      "Documentation",
    ]);
  });

  test("shows the dot to a viewer who never opened the page", async ({
    page,
  }) => {
    await page.goto("/");

    await expectUnread(page);
  });

  test("shows the dot after an older release was seen", async ({
    context,
    page,
  }) => {
    await seedSeen(context, "1.0.0");
    await page.goto("/");

    await expectUnread(page);
  });

  test("is quiet once the newest release was seen", async ({
    context,
    page,
  }) => {
    await seedSeen(context, version);
    await page.goto("/");

    await expectQuiet(page);
  });

  test("is quiet for a release newer than the running one", async ({
    context,
    page,
  }) => {
    await seedSeen(context, "999.0.0");
    await page.goto("/");

    await expectQuiet(page);
  });

  test("clears the dot when the page opens and keeps it cleared", async ({
    page,
  }) => {
    await page.goto("/");
    await expectUnread(page);

    await (await hydrated(whatsNew(page))).click();

    await expect(page).toHaveURL("/whats-new");
    await expect(whatsNew(page)).toHaveAttribute("data-active", "true");
    await expectQuiet(page);
    await page.reload();
    await expectQuiet(page);
  });

  test("clears the dot in another tab", async ({ context, page }) => {
    await page.goto("/");
    await expectUnread(page);

    const other = await context.newPage();
    await other.goto("/whats-new");
    await expect.poll(() => storedSeen(other)).toBe(version);

    await expectQuiet(page);
  });

  test("keeps the dot on the icon when the sidebar is collapsed", async ({
    page,
  }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Toggle Sidebar" }).first().click();

    await expect(dot(page)).toBeVisible();
    const icon = await whatsNew(page).locator("svg").boundingBox();
    const mark = await dot(page).boundingBox();
    expect(icon && mark).toBeTruthy();
    expect(mark!.x + mark!.width).toBeGreaterThan(icon!.x + icon!.width / 2);
    expect(mark!.y).toBeLessThan(icon!.y + icon!.height / 2);

    await whatsNew(page).hover();
    await expect(page.getByRole("tooltip")).toHaveText(
      "What's New, new updates",
    );
  });

  test("shows in the phone sheet", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/");
    await page.getByRole("button", { name: "Toggle Sidebar" }).first().click();

    await expect(whatsNew(page)).toBeVisible();
    await expect(dot(page)).toBeVisible();
  });

  test("closes the phone sheet when it opens the page", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/");
    await page.getByRole("button", { name: "Toggle Sidebar" }).first().click();
    await (await hydrated(whatsNew(page))).click();

    await expect(page).toHaveURL("/whats-new");
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  test("keeps the version of an entry clear of the site header", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1512, height: 982 });
    await page.goto("/whats-new");
    await expect(releases(page).first()).toBeVisible();
    await page.mouse.wheel(0, 500);
    await expect
      .poll(() => page.evaluate(() => window.scrollY))
      .toBeGreaterThan(400);

    const header = await page.locator("header").first().boundingBox();
    const version = await releases(page)
      .first()
      .getByRole("heading", { level: 2 })
      .boundingBox();
    expect(header && version).toBeTruthy();
    expect(version!.y).toBeGreaterThanOrEqual(header!.y + header!.height);
  });

  test("renders quiet on the server so hydration matches", async ({
    context,
    page,
  }) => {
    const warnings: string[] = [];
    page.on("console", (message) => {
      if (/hydrat/i.test(message.text())) warnings.push(message.text());
    });
    await seedSeen(context, "1.0.0");

    const html = await (await page.request.get("/")).text();
    expect(html).toContain('data-unread="false"');
    await page.goto("/");
    await expectUnread(page);
    expect(warnings).toEqual([]);
  });

  test("moves nothing when the dot appears", async ({ context, page }) => {
    await seedSeen(context, version);
    await page.goto("/");
    await expectQuiet(page);
    const quiet = await whatsNew(page).boundingBox();

    await page.evaluate(
      (key) => window.localStorage.setItem(key, "1.0.0"),
      SEEN,
    );
    await page.reload();
    await expectUnread(page);

    expect(await whatsNew(page).boundingBox()).toEqual(quiet);
  });

  for (const theme of ["light", "dark"] as const) {
    test(`draws the dot at 3 to 1 against the ${theme} sidebar`, async ({
      page,
    }) => {
      await page.addInitScript(
        (value) => window.localStorage.setItem("theme", value),
        theme,
      );
      await page.emulateMedia({ colorScheme: theme });
      await page.goto("/");
      await expectUnread(page);

      const [mark, sidebar] = await dot(page).evaluate((element) => {
        const container = element.closest('[data-slot="sidebar-inner"]');
        return [
          getComputedStyle(element).backgroundColor,
          getComputedStyle(container ?? document.body).backgroundColor,
        ];
      });
      expect(contrastRatio(mark, sidebar)).toBeGreaterThanOrEqual(3);
    });
  }

  test("works when browser storage throws", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.addInitScript(() => {
      Storage.prototype.getItem = () => {
        throw new Error("blocked");
      };
      Storage.prototype.setItem = () => {
        throw new Error("blocked");
      };
    });
    await page.goto("/");
    await expectUnread(page);

    await (await hydrated(whatsNew(page))).click();

    await expect(page).toHaveURL("/whats-new");
    await expectQuiet(page);
    expect(errors).toEqual([]);
  });
});

test("the command palette opens what's new and clears the dot", async ({
  page,
}) => {
  await page.goto("/");
  await expectUnread(page);
  await hydrated(whatsNew(page));

  await page.keyboard.press("ControlOrMeta+k");
  const palette = page.getByRole("dialog", { name: "Command palette" });
  await expect(palette).toBeVisible();
  await page.keyboard.type("what");
  await expect(
    palette.getByRole("option", { name: "What's New" }),
  ).toBeVisible();
  await page.keyboard.press("Enter");

  await expect(page).toHaveURL("/whats-new");
  await expectQuiet(page);
});
