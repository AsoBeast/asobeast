import { readFileSync } from "node:fs";
import type { Page } from "@playwright/test";
import {
  UNBROKEN_REVIEW_AUTHOR,
  UNBROKEN_REVIEW_TEXT,
  UNBROKEN_REVIEW_TITLE,
} from "./fixtures.mts";
import { hydrated } from "./hydrated.mts";
import { seedCookies } from "./routes.mts";
import { expect, test } from "./session.mts";

test("reviews tab lists stored reviews and the ratings chart", async ({
  page,
}) => {
  await page.goto("/apps/app-1/reviews");

  await expect(
    page.getByRole("region", { name: "Average rating and review volume" }),
  ).toBeVisible();

  await expect(page.getByText("Love the focus timer")).toBeVisible();
  await expect(page.getByText("Please add dark mode.")).toBeVisible();
});

test("a star filter writes to the url and narrows the list", async ({
  page,
}) => {
  await page.goto("/apps/app-1/reviews");

  await page.getByRole("button", { name: "1", exact: true }).click();

  await expect(page).toHaveURL(/score=1/);
  await expect(page.getByRole("article")).toHaveCount(1);
  await expect(
    page.getByRole("article").getByText("Please add dark mode."),
  ).toBeVisible();
  await expect(page.getByText("Love the focus timer")).toBeHidden();
});

test("a rating without written text says it has no written review", async ({
  page,
}) => {
  await page.goto("/apps/app-1/reviews?score=4");

  await expect(page.getByRole("article")).toHaveCount(2);
  await expect(
    page.getByRole("article").getByText("No written review"),
  ).toHaveCount(2);
});

test("a filtered review list says no match, not no data", async ({ page }) => {
  await page.goto("/apps/app-1/reviews?score=3");

  await expect(page.getByText("No reviews match these filters")).toBeVisible();

  await page.getByRole("button", { name: "Clear filters" }).click();

  await expect(page.getByText("No reviews match these filters")).toBeHidden();
});

test("exporting reviews asks for the newest 200 that match the filters", async ({
  page,
}) => {
  await page.goto("/apps/app-1/reviews?version=3.4.0");
  await page.waitForLoadState("networkidle");
  const button = page.getByRole("button", { name: "Export CSV of reviews" });
  await expect(button).toHaveAccessibleDescription(
    "Exports the newest 200 reviews that match the filters",
  );

  const [request, download] = await Promise.all([
    page.waitForRequest((candidate) => {
      const url = new URL(candidate.url());
      return (
        url.pathname === "/api/backend/apps/app-1/reviews" &&
        url.searchParams.get("limit") === "200"
      );
    }),
    page.waitForEvent("download"),
    button.click(),
  ]);

  expect(new URL(request.url()).searchParams.get("version")).toBe("3.4.0");
  expect(download.suggestedFilename()).toMatch(
    /^reviews-app-1-\d{4}-\d{2}-\d{2}\.csv$/,
  );
  const lines = readFileSync(await download.path(), "utf8").split("\r\n");
  expect(lines[0]).toBe(
    "\uFEFFreviewedAt,score,title,text,version,author,reviewId,replyState,replyText",
  );
  expect(lines).toHaveLength(3);
  expect(lines[1]).toMatch(
    /^\d{4}-\d{2}-\d{2}T[\d:.]+Z,2,Crashes often,It crashes when I start a session\.,3\.4\.0,Jordan,store-rev-2,drafted,"Sorry about the crash, Jordan\. Version 3\.4\.1 fixes it; please update and tell us if it persists\."$/,
  );
  expect(lines[2]).toMatch(
    /^\d{4}-\d{2}-\d{2}T[\d:.]+Z,1,,Please add dark mode\.,3\.4\.0,,store-rev-3,needs_reply,$/,
  );
});

async function claimMoreReviews(page: Page, total: number) {
  await page.route(
    (url) =>
      url.pathname === "/api/backend/apps/app-1/reviews" &&
      url.searchParams.get("limit") === "200",
    async (route) => {
      const response = await route.fetch();
      await route.fulfill({
        response,
        json: { ...((await response.json()) as object), total },
      });
    },
  );
}

test("a searched export says what the file holds and where the search stopped", async ({
  page,
}) => {
  await claimMoreReviews(page, 450);
  await page.goto("/apps/app-1/reviews");
  await page.getByRole("textbox", { name: "Search reviews" }).fill("crash");
  await expect(
    page.getByText("Search covers the 5 loaded of 450 reviews"),
  ).toBeVisible();

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Export CSV of reviews" }).click(),
  ]);

  expect(
    readFileSync(await download.path(), "utf8").split("\r\n"),
  ).toHaveLength(2);
  await expect(
    page.getByText(
      "Exported 1 review found in the newest 5 of 450. Narrow the filters to search the others.",
    ),
  ).toBeVisible();
  await expect(page.getByText(/^Exported the newest/)).toHaveCount(0);
});

test("an export without a search keeps the unsearched notice", async ({
  page,
}) => {
  await claimMoreReviews(page, 450);
  await page.goto("/apps/app-1/reviews");
  await page.waitForLoadState("networkidle");

  await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Export CSV of reviews" }).click(),
  ]);

  await expect(
    page.getByText(
      "Exported the newest 5 of 450 reviews. Narrow the filters to reach the others.",
    ),
  ).toBeVisible();
});

test("the reviews export is disabled when no review matches", async ({
  page,
}) => {
  await page.goto("/apps/app-1/reviews?score=3");

  await expect(page.getByText("No reviews match these filters")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Export CSV of reviews" }),
  ).toBeDisabled();
});

test("the counts strip filters the list by reply state", async ({ page }) => {
  await page.goto("/apps/app-1/reviews");
  const strip = page.getByRole("region", { name: "Reply status" });
  const needsReply = strip.getByRole("button", { name: /Needs reply/ });

  await expect(needsReply).toContainText("3");
  await expect(
    strip.getByRole("button", { name: /Draft saved/ }),
  ).toContainText("1");
  await expect(strip.getByRole("button", { name: /Replied/ })).toContainText(
    "1",
  );

  await needsReply.click();

  await expect(page).toHaveURL(/replyState=needs_reply/);
  await expect(needsReply).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("article")).toHaveCount(3);

  await needsReply.click();

  await expect(page).not.toHaveURL(/replyState=/);
  await expect(page.getByRole("article")).toHaveCount(5);
});

test("a reply state badge names the state and its source", async ({ page }) => {
  await page.goto("/apps/app-1/reviews");

  await expect(
    page
      .getByRole("article")
      .filter({ hasText: "Crashes often" })
      .getByText("Draft saved"),
  ).toBeVisible();
  await expect(
    page
      .getByRole("article")
      .filter({ hasText: "Sam" })
      .getByText("Marked replied"),
  ).toBeVisible();

  await page.goto("/apps/app-gp/reviews");
  const replied = page.getByRole("article").filter({ hasText: "Stürzt ab" });

  await expect(replied.getByText("Replied on Google Play")).toBeVisible();
  await expect(replied.getByText(/^Developer reply/)).toBeVisible();
  await expect(
    replied.getByText(
      "Danke für den Hinweis, Version 2.8.0 behebt den Absturz.",
    ),
  ).toBeVisible();
});

test("sorting by lowest score puts the one star review first", async ({
  page,
}) => {
  await page.goto("/apps/app-1/reviews");

  await page.getByRole("combobox", { name: "Sort reviews" }).click();
  await page.getByRole("option", { name: "Lowest first" }).click();

  await expect(page).toHaveURL(/sort=lowest/);
  await expect(page.getByRole("article").first()).toContainText(
    "Please add dark mode.",
  );
});

test("searching narrows the list in the browser", async ({ page }) => {
  await page.goto("/apps/app-1/reviews");
  await expect(page.getByRole("article")).toHaveCount(5);

  await page.getByRole("textbox", { name: "Search reviews" }).fill("crash");

  await expect(page.getByRole("article")).toHaveCount(1);
  await expect(page).toHaveURL(/q=crash/);
  await expect(
    page
      .getByRole("region", { name: "Reply status" })
      .getByRole("button", { name: /Needs reply/ }),
  ).toContainText("3");

  await page.getByRole("textbox", { name: "Search reviews" }).fill("zzz");
  await page.getByRole("button", { name: "Reset search" }).click();

  await expect(page.getByRole("article")).toHaveCount(5);
});

test("show all loads up to two hundred reviews", async ({ page }) => {
  await page.goto("/apps/app-long/reviews");

  await expect(page.getByRole("article")).toHaveCount(50);
  await expect(page.getByText("Showing 50 of 60")).toBeVisible();

  const [request] = await Promise.all([
    page.waitForRequest((candidate) => {
      const url = new URL(candidate.url());
      return (
        url.pathname === "/api/backend/apps/app-long/reviews" &&
        url.searchParams.get("limit") === "200"
      );
    }),
    page.getByRole("button", { name: "Show all" }).click(),
  ]);

  expect(request).toBeTruthy();
  await expect(page.getByRole("article")).toHaveCount(60);
  await expect(page.getByText("Showing 50 of 60")).toBeHidden();
});

test("a search loads every review the page can hold before it filters", async ({
  page,
}) => {
  await page.goto("/apps/app-long/reviews");
  await expect(page.getByRole("article")).toHaveCount(50);

  const [request] = await Promise.all([
    page.waitForRequest((candidate) => {
      const url = new URL(candidate.url());
      return (
        url.pathname === "/api/backend/apps/app-long/reviews" &&
        url.searchParams.get("limit") === "200"
      );
    }),
    page.getByRole("textbox", { name: "Search reviews" }).fill("number 5"),
  ]);

  expect(request).toBeTruthy();
  await expect(page.getByRole("article")).toHaveCount(11);
  await expect(page.getByText(/Search covers the/)).toBeHidden();
});

test("show more appears only for a review that runs past four lines", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1512, height: 900 });
  await page.goto("/apps/app-long/reviews");
  const fits = page.getByRole("article").filter({ hasText: "Review number 2" });
  const overflows = page
    .getByRole("article")
    .filter({ hasText: "Review number 3" });

  await expect(fits.getByText(/The timer stops/)).toBeVisible();
  await expect(fits.getByRole("button", { name: "Show more" })).toHaveCount(0);

  const text = overflows.getByText(/Paragraph 1 of a review/);
  const collapsed = (await text.boundingBox())?.height ?? 0;
  await overflows.getByRole("button", { name: "Show more" }).click();

  await expect(
    overflows.getByRole("button", { name: "Show less" }),
  ).toHaveAttribute("aria-expanded", "true");
  expect((await text.boundingBox())?.height ?? 0).toBeGreaterThan(collapsed);
});

for (const [width, clamped] of [
  [375, true],
  [768, true],
  [1440, false],
] as const) {
  test(`a long unbroken title, text and author wrap inside the card at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/apps/app-long/reviews");
    const card = page
      .getByRole("article")
      .filter({ hasText: UNBROKEN_REVIEW_TITLE });
    await expect(card).toBeVisible();
    const edge = (await card.boundingBox())!;
    const right = edge.x + edge.width;

    for (const token of [
      card.getByText(UNBROKEN_REVIEW_TITLE),
      card.getByText(UNBROKEN_REVIEW_TEXT),
      card.getByText(new RegExp(`^${UNBROKEN_REVIEW_AUTHOR}`)),
    ]) {
      const box = (await token.boundingBox())!;
      expect(box.x + box.width).toBeLessThanOrEqual(right + 1);
    }

    const more = card.getByRole("button", { name: "Show more" });
    if (!clamped) {
      await expect(more).toHaveCount(0);
      return;
    }
    await expect(more).toBeVisible();
    const text = card.getByText(UNBROKEN_REVIEW_TEXT);
    const collapsed = (await text.boundingBox())!.height;
    await more.click();
    expect((await text.boundingBox())!.height).toBeGreaterThan(collapsed);
  });
}

test("each ratings distribution row stays on one line on a laptop and a phone", async ({
  page,
}) => {
  for (const width of [1512, 375]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/apps/app-1/reviews");
    const row = page.getByRole("listitem").filter({ hasText: "5 star" });

    await expect(row).toBeVisible();
    const label = await row.getByText("5 star").boundingBox();
    const count = await row.getByText(/17,230/).boundingBox();
    expect(label?.height ?? 0).toBeLessThan(28);
    expect(count?.height ?? 0).toBeLessThan(28);
  }
});

test("the reply status tiles share one row on a phone", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/apps/app-1/reviews");
  const tiles = page
    .getByRole("region", { name: "Reply status" })
    .getByRole("button", { name: /Needs reply|Draft saved|Replied/ });

  await expect(tiles).toHaveCount(3);
  const tops = await tiles.evaluateAll((nodes) =>
    nodes.map((node) => Math.round(node.getBoundingClientRect().top)),
  );
  expect(new Set(tops).size).toBe(1);
});

test("a since filter writes to the url and keeps the reviews of that period", async ({
  page,
}) => {
  await page.goto("/apps/app-long/reviews");

  await page.getByRole("combobox", { name: "Filter by date" }).click();
  const [request] = await Promise.all([
    page.waitForRequest((candidate) => {
      const url = new URL(candidate.url());
      return (
        url.pathname === "/api/backend/apps/app-long/reviews" &&
        url.searchParams.has("from")
      );
    }),
    page.getByRole("option", { name: "Last 30 days" }).click(),
  ]);

  await expect(page).toHaveURL(/since=30d/);
  expect(new URL(request.url()).searchParams.get("from")).toMatch(
    /^\d{4}-\d{2}-\d{2}$/,
  );
  await expect(page.getByRole("article")).toHaveCount(31);
  await expect(page.getByText("Review number 45")).toBeHidden();
});

test("a theme searches for its phrase and a second press clears it", async ({
  page,
}) => {
  await page.goto("/apps/app-1/reviews");
  const themes = page.getByRole("region", { name: "What people mention" });
  const complaints = themes.getByRole("list", { name: "Complaints" });
  const crashes = complaints.getByRole("button", { name: /^crashes in/ });

  await expect(complaints.getByRole("listitem")).toHaveCount(2);
  await expect(
    themes.getByRole("list", { name: "Praise" }).getByRole("listitem"),
  ).toHaveCount(1);
  await expect(crashes).toHaveAccessibleName(
    "crashes in 1 review, 1 at 2 stars or less",
  );

  await crashes.click();

  await expect(page).toHaveURL(/q=%22crashes%22/);
  await expect(crashes).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("article")).toHaveCount(1);
  await expect(
    page.getByRole("textbox", { name: "Search reviews" }),
  ).toHaveValue('"crashes"');

  await crashes.click();

  await expect(page).not.toHaveURL(/q=/);
  await expect(page.getByRole("article")).toHaveCount(5);
});

test("a pressed theme lists as many reviews as its number counts", async ({
  context,
  page,
}) => {
  await seedCookies(context, { e2e_reviews: "update" });
  await page.goto("/apps/app-1/reviews");
  const update = page
    .getByRole("region", { name: "What people mention" })
    .getByRole("button", { name: /^update in/ });
  const counted = Number(
    await update.locator("span[aria-hidden]").textContent(),
  );

  await update.click();

  await expect(update).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText("The last update broke sync.")).toBeVisible();
  await expect(page.getByRole("article")).toHaveCount(counted);
  expect(counted).toBe(2);
});

test("the themes strip stays hidden when nothing is repeated", async ({
  page,
}) => {
  await page.goto("/apps/app-long/reviews");

  await expect(page.getByRole("article").first()).toBeVisible();
  await expect(
    page.getByRole("region", { name: "What people mention" }),
  ).toHaveCount(0);
});

test("a failing themes request keeps the reviews page and offers a retry", async ({
  page,
}) => {
  let failing = true;
  await page.route("**/api/backend/apps/app-1/reviews/themes*", (route) =>
    failing
      ? route.fulfill({ status: 500, json: { statusCode: 500 } })
      : route.fallback(),
  );
  await page.goto("/apps/app-1/reviews");
  const themes = page.getByRole("region", { name: "What people mention" });
  await expect(themes).toBeVisible();

  await page
    .getByRole("region", { name: "Reply status" })
    .getByRole("button", { name: /Needs reply/ })
    .click();

  const failure = page
    .getByRole("alert")
    .filter({ hasText: "Could not load what people mention." });
  await expect(failure).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("article")).toHaveCount(3);
  await expect(
    page.getByRole("region", { name: "Average rating and review volume" }),
  ).toBeVisible();
  await expect(page.getByText("Reviews could not be loaded")).toHaveCount(0);

  failing = false;
  await page.getByRole("button", { name: "Retry" }).click();

  await expect(themes).toBeVisible();
  await expect(failure).toHaveCount(0);
});

test("retrying a failed themes request keeps focus on Retry", async ({
  page,
}) => {
  await page.route("**/api/backend/apps/app-1/reviews/themes*", (route) =>
    route.fulfill({ status: 500, json: { statusCode: 500 } }),
  );
  await page.goto("/apps/app-1/reviews");
  await page
    .getByRole("region", { name: "Reply status" })
    .getByRole("button", { name: /Needs reply/ })
    .click();
  const failure = page
    .getByRole("alert")
    .filter({ hasText: "Could not load what people mention." });
  await expect(failure).toBeVisible({ timeout: 15_000 });
  const retry = page.getByRole("button", { name: "Retry" });

  await retry.focus();
  await page.keyboard.press("Enter");

  await expect(retry).toBeFocused();
  await expect(retry).toHaveAttribute("aria-disabled", "true");
  await expect(retry).not.toHaveAttribute("aria-disabled", "true", {
    timeout: 15_000,
  });
  await expect(retry).toBeFocused();
  await expect(failure).toBeVisible();
});

const REVIEWS_LIST_PATH = "/api/backend/apps/app-1/reviews";

const isScoredList = (url: URL) =>
  url.pathname === REVIEWS_LIST_PATH && url.searchParams.has("score");

test("try again refetches a reviews list that failed after the page was open", async ({
  page,
}) => {
  let failing = false;
  await page.route(isScoredList, (route) =>
    failing
      ? route.fulfill({ status: 500, json: { statusCode: 500 } })
      : route.fallback(),
  );
  await page.goto("/apps/app-1/reviews");
  await expect(page.getByRole("article")).toHaveCount(5);

  failing = true;
  const oneStar = page.getByRole("button", { name: "1", exact: true });
  await hydrated(oneStar);
  await oneStar.click();
  const boundary = page
    .getByRole("main")
    .getByRole("alert")
    .filter({ hasText: "Reviews could not be loaded" });
  await expect(boundary).toBeVisible({ timeout: 20_000 });
  await expect(page).toHaveURL(/score=1/);

  failing = false;
  const refetched = page.waitForRequest(
    (request) =>
      isScoredList(new URL(request.url())) &&
      new URL(request.url()).searchParams.get("score") === "1",
  );
  await boundary.getByRole("button", { name: "Try again" }).click();
  await refetched;

  await expect(boundary).toBeHidden();
  await expect(page.getByRole("article")).toHaveCount(1);
  await expect(
    page.getByRole("article").getByText("Please add dark mode."),
  ).toBeVisible();
  await expect(page).toHaveURL(/score=1/);
});

test("themes that fail on first load leave the page in place", async ({
  context,
  page,
}) => {
  await seedCookies(context, { e2e_themes_failing: "1" });
  await page.goto("/apps/app-1/reviews");

  await expect(page.getByRole("article")).toHaveCount(5);
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "Could not load what people mention." }),
  ).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("Reviews could not be loaded")).toHaveCount(0);
});

const openThemesTip = async (page: Page, path: string) => {
  await page.goto(path);
  await page
    .getByRole("region", { name: "What people mention" })
    .getByRole("button", { name: "About what people mention" })
    .click();
  const tip = page.getByRole("dialog", { name: "What people mention" });
  await expect(tip).toBeVisible();
  return tip;
};

for (const [name, path, counted] of [
  ["the default order", "/apps/app-1/reviews", "5 newest reviews"],
  ["lowest first", "/apps/app-1/reviews?sort=lowest", "5 lowest rated reviews"],
  [
    "the needs reply queue",
    "/apps/app-1/reviews?replyState=needs_reply&sort=lowest",
    "5 lowest rated reviews",
  ],
] as const) {
  test(`the themes tip says what its counts cover for ${name}`, async ({
    page,
  }) => {
    const tip = await openThemesTip(page, path);

    await expect(tip).toHaveAccessibleDescription(
      new RegExp(
        `compared with the newest 500 reviews of the version and period\\. Counts cover the ${counted} matching the filters\\.`,
      ),
    );
    await expect(tip).not.toHaveAccessibleDescription(/every review/);
  });
}

test("a play review edited after the reply says so and has its own filter", async ({
  page,
}) => {
  await page.goto("/apps/app-gp/reviews");
  const strip = page.getByRole("region", { name: "Reply status" });
  const updated = strip.getByRole("button", { name: /Updated after reply/ });

  await expect(
    page
      .getByRole("article")
      .filter({ hasText: "Jetzt besser" })
      .getByText("Updated after reply"),
  ).toBeVisible();
  await expect(updated).toContainText("1");

  await updated.click();

  await expect(page).toHaveURL(/replyState=updated/);
  await expect(page.getByRole("article")).toHaveCount(1);

  await page.goto("/apps/app-1/reviews");

  await expect(
    page
      .getByRole("region", { name: "Reply status" })
      .getByRole("button", { name: /Updated after reply/ }),
  ).toHaveCount(0);
});

const REVIEW_DAY = /[A-Z][a-z]{2} \d{1,2}, \d{4}/;

test("every review card is named and its buttons carry the review", async ({
  page,
}) => {
  await page.goto("/apps/app-1/reviews");
  await expect(page.getByRole("article")).toHaveCount(5);
  const articles = await page.getByRole("article").all();
  for (const article of articles) {
    await expect(article).toHaveAccessibleName(/^\d star review by .+ on /);
  }

  const jordan = page.getByRole("article").filter({ hasText: "Crashes often" });
  await expect(
    jordan.getByRole("button", {
      name: new RegExp(
        `^Edit reply to the 2 star review by Jordan on ${REVIEW_DAY.source}$`,
      ),
    }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("article")
      .filter({ hasText: "Please add dark mode." })
      .getByRole("button", {
        name: new RegExp(
          `^Reply to the 1 star review by Anonymous on ${REVIEW_DAY.source}$`,
        ),
      }),
  ).toBeVisible();

  const names = await Promise.all(
    (await page.getByRole("article").getByRole("button").all()).map((button) =>
      button.getAttribute("aria-label"),
    ),
  );
  expect(names).toHaveLength(5);
  expect(new Set(names).size).toBe(names.length);
});

test("show more and show less name the review they open", async ({ page }) => {
  await page.setViewportSize({ width: 1512, height: 900 });
  await page.goto("/apps/app-long/reviews");
  const card = page.getByRole("article").filter({ hasText: "Review number 3" });

  const more = card.getByRole("button", {
    name: new RegExp(
      `^Show more of the 3 star review by Reviewer 3 on ${REVIEW_DAY.source}$`,
    ),
  });
  await more.click();

  await expect(
    card.getByRole("button", {
      name: new RegExp(
        `^Show less of the 3 star review by Reviewer 3 on ${REVIEW_DAY.source}$`,
      ),
    }),
  ).toHaveAttribute("aria-expanded", "true");
});

test("translate buttons name the review they translate", async ({
  context,
  page,
}) => {
  await seedCookies(context, { e2e_metadata_ai: "1" });
  await page.goto("/apps/app-gp/reviews");

  const lena = page.getByRole("article").filter({ hasText: "Stürzt ab" });
  await expect(
    lena.getByRole("button", {
      name: new RegExp(
        `^Translate the 2 star review by Lena on ${REVIEW_DAY.source}$`,
      ),
    }),
  ).toBeVisible();
  const names = await Promise.all(
    (await page.getByRole("button", { name: /^Translate the / }).all()).map(
      (button) => button.getAttribute("aria-label"),
    ),
  );
  expect(names).toHaveLength(3);
  expect(new Set(names).size).toBe(3);
});

test("reviews that share stars, author and day get names that tell them apart", async ({
  context,
  page,
}) => {
  await seedCookies(context, { e2e_reviews: "twins" });
  await page.goto("/apps/app-1/reviews");
  await expect(page.getByRole("article")).toHaveCount(3);

  const first = page.getByRole("article").filter({ hasText: "Broken one." });
  const second = page.getByRole("article").filter({ hasText: "Broken two." });
  const other = page.getByRole("article").filter({ hasText: "Works for me." });
  const twin = (rank: number) =>
    `1 star review by A Google user on ${REVIEW_DAY.source} \\(${rank} of 2\\)`;

  await expect(first).toHaveAccessibleName(new RegExp(`^${twin(1)}$`));
  await expect(second).toHaveAccessibleName(new RegExp(`^${twin(2)}$`));
  await expect(
    first.getByRole("button", {
      name: new RegExp(`^Reply to the ${twin(1)}$`),
    }),
  ).toBeVisible();
  await expect(
    second.getByRole("button", {
      name: new RegExp(`^Reply to the ${twin(2)}$`),
    }),
  ).toBeVisible();
  await expect(other).toHaveAccessibleName(
    new RegExp(`^5 star review by Casey on ${REVIEW_DAY.source}$`),
  );

  const articleNames = await Promise.all(
    (await page.getByRole("article").all()).map((card) =>
      card.getAttribute("aria-label"),
    ),
  );
  const buttonNames = await Promise.all(
    (await page.getByRole("article").getByRole("button").all()).map((button) =>
      button.getAttribute("aria-label"),
    ),
  );
  expect(new Set(articleNames).size).toBe(3);
  expect(new Set(buttonNames).size).toBe(buttonNames.length);
});

test("the needs reply tile opens the queue lowest score first", async ({
  page,
}) => {
  await page.goto("/apps/app-1/reviews");

  await page
    .getByRole("region", { name: "Reply status" })
    .getByRole("button", { name: /Needs reply/ })
    .click();

  await expect(page).toHaveURL(/replyState=needs_reply/);
  await expect(page).toHaveURL(/sort=lowest/);
  await expect(page.getByRole("article").first()).toContainText(
    "Please add dark mode.",
  );
});
