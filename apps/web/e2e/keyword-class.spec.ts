import type { Page } from "@playwright/test";
import { holdRequest } from "./held-request.mts";
import { expect, test } from "./session.mts";

const PAGE = "/apps/app-1/keywords";

const rowOf = (page: Page, text: string) =>
  page
    .getByRole("table", { name: /Tracked keywords/ })
    .getByRole("row")
    .filter({
      has: page.getByRole("checkbox", { name: `Select ${text}`, exact: true }),
    });

test.describe("the keyword type badge", () => {
  test("marks the own brand and the competitor brand and nothing else", async ({
    page,
  }) => {
    await page.goto(PAGE);

    await expect(
      rowOf(page, "focus timer").getByText("Brand keyword"),
    ).toHaveCount(1);
    await expect(
      rowOf(page, "pomodoro").getByText("Competitor brand keyword"),
    ).toHaveCount(1);
    for (const text of ["study timer", "productivity app", "time blocking"]) {
      await expect(rowOf(page, text).getByText(/brand keyword/)).toHaveCount(0);
    }
    await expect(
      page.getByRole("button", { name: "Keyword", exact: true }),
    ).toBeVisible();
  });

  test("sits after the keyword text", async ({ page }) => {
    await page.goto(PAGE);
    const row = rowOf(page, "focus timer");
    const text = await row
      .getByTitle("focus timer", { exact: true })
      .boundingBox();
    const badge = await row
      .getByTitle("Brand keyword", { exact: true })
      .boundingBox();

    expect(text && badge && badge.x >= text.x + text.width).toBe(true);
  });

  for (const width of [320, 375]) {
    test(`keeps the badge visible without widening the page at ${width} px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 800 });
      await page.goto(PAGE);

      await expect(
        rowOf(page, "focus timer").getByTitle("Brand keyword", { exact: true }),
      ).toBeVisible();
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
    });
  }
});

test.describe("the keyword type menu", () => {
  test.describe.configure({ mode: "serial" });

  const MOCK_API_URL = `http://localhost:${process.env.MOCK_API_PORT ?? 4100}`;
  const LAB = "/apps/app-class/keywords";
  const PATCH_URL = /\/api\/backend\/apps\/app-class\/keywords\/[^/?]+$/;

  test.beforeEach(async ({ request }) => {
    await request.post(
      `${MOCK_API_URL}/__reset/keyword-annotations/app-class`,
      {
        failOnStatusCode: true,
      },
    );
  });

  const openTypeMenu = async (page: Page, text: string) => {
    await rowOf(page, text)
      .getByRole("button", { name: "Keyword actions" })
      .click();
    await page.getByRole("menuitem", { name: "Keyword type" }).click();
    return page.getByRole("menu").last();
  };

  const choose = async (page: Page, text: string, choice: string) => {
    const menu = await openTypeMenu(page, text);
    await menu.getByRole("menuitemradio", { name: choice }).click();
  };

  test("offers the detected type and the three types, checked on the detected one", async ({
    page,
  }) => {
    await page.goto(LAB);
    const menu = await openTypeMenu(page, "focus timer");

    await expect(menu.getByRole("menuitemradio")).toHaveText([
      "Detected automatically",
      "Own brand",
      "Competitor brand",
      "Generic",
    ]);
    await expect(
      menu.getByRole("menuitemradio", { name: "Detected automatically" }),
    ).toBeChecked();
  });

  test("sends nothing when the checked choice is chosen again", async ({
    page,
  }) => {
    await page.goto(LAB);
    const patches: string[] = [];
    page.on("request", (request) => {
      if (request.method() === "PATCH" && PATCH_URL.test(request.url())) {
        patches.push(request.url());
      }
    });

    await choose(page, "pomodoro", "Detected automatically");
    await expect(
      rowOf(page, "pomodoro").getByRole("button", { name: "Keyword actions" }),
    ).toBeFocused();
    await page.waitForLoadState("networkidle");

    expect(patches).toEqual([]);
  });

  test("sets a type at once with one request and keeps it after the refetch", async ({
    page,
  }) => {
    await page.goto(LAB);
    const bodies: unknown[] = [];
    page.on("request", (request) => {
      if (request.method() === "PATCH" && PATCH_URL.test(request.url())) {
        bodies.push(request.postDataJSON());
      }
    });
    const held = await holdRequest(page, PATCH_URL, "PATCH");
    const badge = rowOf(page, "focus timer").getByTitle(/^Brand keyword/);

    await choose(page, "focus timer", "Generic");

    await expect(badge).toHaveCount(0);
    await expect(
      rowOf(page, "focus timer").getByRole("button", {
        name: "Keyword actions",
      }),
    ).toBeFocused();
    held.release();
    await expect.poll(() => bodies).toEqual([{ keywordClass: "generic" }]);
    await page.waitForLoadState("networkidle");
    await expect(badge).toHaveCount(0);

    const menu = await openTypeMenu(page, "focus timer");
    await expect(
      menu.getByRole("menuitemradio", { name: "Generic" }),
    ).toBeChecked();
    await page.keyboard.press("Escape");
    await page.keyboard.press("Escape");
    expect(bodies).toHaveLength(1);
  });

  test("goes back to the detected type without dropping the badge in between", async ({
    page,
  }) => {
    await page.goto(LAB);
    const row = rowOf(page, "focus timer");
    await choose(page, "focus timer", "Competitor brand");
    await expect(
      row.getByTitle("Competitor brand keyword, set by you"),
    ).toBeVisible();

    const held = await holdRequest(page, PATCH_URL, "PATCH");
    await choose(page, "focus timer", "Detected automatically");
    await expect(
      row.getByTitle("Competitor brand keyword, set by you"),
    ).toBeVisible();
    held.release();

    await expect(
      row.getByTitle("Brand keyword", { exact: true }),
    ).toBeVisible();
  });

  test("sends a second choice only after the first one landed and keeps the last", async ({
    page,
  }) => {
    await page.goto(LAB);
    const held = await holdRequest(page, PATCH_URL, "PATCH");
    const sent: unknown[] = [];
    page.on("request", (request) => {
      if (request.method() === "PATCH" && PATCH_URL.test(request.url())) {
        sent.push(request.postDataJSON());
      }
    });
    const row = rowOf(page, "study timer");

    await choose(page, "study timer", "Own brand");
    await expect.poll(() => sent).toHaveLength(1);
    await choose(page, "study timer", "Competitor brand");
    await expect(
      row.getByTitle("Competitor brand keyword, set by you"),
    ).toBeVisible();
    expect(sent).toEqual([{ keywordClass: "ownBrand" }]);

    held.release();
    await expect
      .poll(() => sent)
      .toEqual([
        { keywordClass: "ownBrand" },
        { keywordClass: "competitorBrand" },
      ]);
    await page.waitForLoadState("networkidle");
    await page.reload();
    await expect(
      row.getByTitle("Competitor brand keyword, set by you"),
    ).toBeVisible();
  });

  test("keeps the detected type a reset answered when the list cannot reload", async ({
    page,
  }) => {
    await page.goto(LAB);
    const row = rowOf(page, "focus timer");
    await choose(page, "focus timer", "Generic");
    await expect(row.getByTitle(/brand keyword/i)).toHaveCount(0);
    await page.waitForLoadState("networkidle");
    await page.route(
      /\/api\/backend\/apps\/app-class\/keywords(\?|$)/,
      (route) =>
        route.request().method() === "GET"
          ? route.fulfill({ status: 500, body: "{}" })
          : route.fallback(),
    );

    await choose(page, "focus timer", "Detected automatically");

    await expect(
      row.getByTitle("Brand keyword", { exact: true }),
    ).toBeVisible();
  });

  test("shows a failed change and keeps the type it had", async ({
    page,
    context,
  }) => {
    await context.addCookies([
      {
        name: "e2e-fail-keyword-patch",
        value: "1",
        domain: "localhost",
        path: "/",
      },
    ]);
    await page.goto(LAB);

    await choose(page, "study timer", "Own brand");

    await expect(page.getByText("Could not update study timer")).toBeVisible();
    await expect(
      rowOf(page, "study timer").getByTitle(/brand keyword/i),
    ).toHaveCount(0);
  });

  test("moves the keyword between the type facet counts", async ({ page }) => {
    await page.goto(LAB);
    await choose(page, "study timer", "Own brand");
    await expect(
      rowOf(page, "study timer").getByTitle("Brand keyword, set by you"),
    ).toBeVisible();

    await page.getByRole("button", { name: "Filter by type" }).click();
    await expect(page.getByRole("option", { name: /Own brand/ })).toHaveText(
      /Own brand\s*2/,
    );
  });
});
