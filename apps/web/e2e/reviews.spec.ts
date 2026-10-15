import { readFileSync } from "node:fs";
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
  const button = page.getByRole("button", { name: "Export reviews to CSV" });
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

test("the reviews export is disabled when no review matches", async ({
  page,
}) => {
  await page.goto("/apps/app-1/reviews?score=3");

  await expect(page.getByText("No reviews match these filters")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Export reviews to CSV" }),
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

test("a search on a long list says it covers the loaded reviews", async ({
  page,
}) => {
  await page.goto("/apps/app-long/reviews?q=number%201");

  await expect(
    page.getByText("Search covers the 50 loaded of 60 reviews"),
  ).toBeVisible();
  await expect(page.getByText("Showing 50 of 60")).toBeHidden();
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
  const crashes = themes.getByRole("button", { name: /^crashes:/ });

  await expect(themes.getByRole("listitem")).toHaveCount(2);
  await expect(crashes).toHaveAccessibleName(
    "crashes: 2 reviews, 2 at 2 stars or less",
  );

  await crashes.click();

  await expect(page).toHaveURL(/q=crashes/);
  await expect(crashes).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("article")).toHaveCount(1);
  await expect(
    page.getByRole("textbox", { name: "Search reviews" }),
  ).toHaveValue("crashes");

  await crashes.click();

  await expect(page).not.toHaveURL(/q=/);
  await expect(page.getByRole("article")).toHaveCount(5);
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
