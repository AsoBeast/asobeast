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
