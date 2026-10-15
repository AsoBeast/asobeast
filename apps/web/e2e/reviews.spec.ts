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
    "\uFEFFreviewedAt,score,title,text,version,author,reviewId",
  );
  expect(lines).toHaveLength(3);
  expect(lines[1]).toMatch(
    /^\d{4}-\d{2}-\d{2}T[\d:.]+Z,2,Crashes often,It crashes when I start a session\.,3\.4\.0,Jordan,store-rev-2$/,
  );
  expect(lines[2]).toMatch(
    /^\d{4}-\d{2}-\d{2}T[\d:.]+Z,1,,Please add dark mode\.,3\.4\.0,,store-rev-3$/,
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
