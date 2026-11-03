import { version } from "../package.json";
import { expect, test } from "./session.mts";
import type { Page } from "@playwright/test";

const SEEN = "asobeast.whatsNew.seen";

const releases = (page: Page) =>
  page.getByRole("list", { name: "Releases" }).getByRole("article");

const storedSeen = (page: Page) =>
  page.evaluate((key) => window.localStorage.getItem(key), SEEN);

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
});
