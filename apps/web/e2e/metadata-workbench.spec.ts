import type { Page } from "@playwright/test";
import { hydrated } from "./hydrated.mts";
import { METADATA_AUDIT_COOKIE } from "./metadata-fixtures.mts";
import { expect, test } from "./session.mts";

const status = (page: Page) =>
  page.getByRole("list", { name: "Work left on this listing" });
const byField = (page: Page) =>
  page.getByRole("region", { name: "Coverage by field" });
const coverage = (page: Page) =>
  page.getByRole("region", { name: "Keyword coverage" });

async function withAudit(page: Page, variant: string) {
  await page.context().addCookies([
    {
      name: METADATA_AUDIT_COOKIE,
      value: variant,
      domain: "localhost",
      path: "/",
    },
  ]);
}

test("opens with one line that counts the work left", async ({ page }) => {
  await page.goto("/apps/app-1/metadata");

  await expect(status(page).getByRole("listitem")).toHaveText([
    "1 keyword not covered",
    "·2 of 4 screenshots with a caption",
    /^·\d+ of 400 keyword field characters used$/,
  ]);
  await expect(page.getByRole("heading", { level: 2 })).toHaveText([
    "Metadata",
    "Coverage by field",
    "Keyword coverage",
    "App Store localizations",
    "Screenshot captions",
  ]);
});

test("the uncovered count turns the uncovered filter on", async ({ page }) => {
  await page.goto("/apps/app-1/metadata");

  const link = status(page).getByRole("button", {
    name: "1 keyword not covered",
  });
  await (await hydrated(link)).press("Enter");

  await expect(page).toHaveURL(/uncovered=true/);
  await expect(link).toBeFocused();
  await expect(
    coverage(page).getByRole("switch", { name: "Uncovered only" }),
  ).toBeChecked();
  await expect(coverage(page).getByText("1 of 3 keywords")).toBeVisible();
  await expect(coverage(page)).toBeInViewport();
});

test("coverage by field counts the keywords each field carries", async ({
  page,
}) => {
  await page.goto("/apps/app-1/metadata");

  const panel = byField(page);
  const fields = panel.getByRole("definition");
  await expect(panel.getByRole("term")).toHaveText([
    "Title",
    "Subtitle",
    "Keyword field",
    "Screenshot text",
  ]);
  await expect(fields).toHaveText(["1 of 3", "1 of 3", "1 of 3", "2 of 3"]);
  await expect(
    panel.getByRole("list", { name: "Not in this listing" }),
  ).toHaveText("productivity appLong tail");

  await (
    await hydrated(panel.getByRole("button", { name: "Show uncovered" }))
  ).click();
  await expect(page).toHaveURL(/uncovered=true/);
});

test("a covered listing says so and offers no uncovered filter", async ({
  page,
}) => {
  await page.goto("/apps/app-1/metadata?market=pl&localization=pl");

  await expect(status(page)).toContainText("All 2 keywords covered");
  await expect(
    byField(page).getByText("Every tracked keyword is in this listing."),
  ).toBeVisible();
  await expect(
    byField(page).getByRole("button", { name: "Show uncovered" }),
  ).toHaveCount(0);
  await expect(page.getByText("Not searched by the store")).toHaveCount(1);
  await expect(
    page
      .getByRole("region", { name: "App Store localizations" })
      .getByText("Adds plan"),
  ).toBeVisible();
});

test("without tracked keywords the coverage panel points at keywords", async ({
  page,
}) => {
  await withAudit(page, "empty");
  await page.goto("/apps/app-1/metadata");

  await expect(status(page)).toContainText("No keywords tracked yet");
  await expect(byField(page)).toHaveCount(0);
  await expect(
    coverage(page).getByRole("link", { name: "Open Keywords" }),
  ).toHaveAttribute("href", "/apps/app-1/keywords");
});

test("a competitor's suggestion is a section of its own", async ({ page }) => {
  await withAudit(page, "suggestion");
  await page.goto("/apps/app-rival/metadata");

  await expect(
    page.getByRole("region", { name: "App Store localizations" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("heading", { level: 2, name: /^Suggested keyword field/ }),
  ).toBeVisible();
  await expect(page.getByText("Adds habits")).toBeVisible();
});

test("a lint issue is its severity word, the rule and the sentence", async ({
  page,
}) => {
  await withAudit(page, "issues");
  await page.goto("/apps/app-1/metadata");

  await expect(status(page)).toContainText("2 fields with issues");
  await expect(page.getByText("44/30 · 14 over")).toBeVisible();
  const issues = page
    .getByRole("region", { name: "Listing fields" })
    .getByRole("listitem");
  await expect(issues).toHaveText([
    "Error· over-limitThe title is 14 characters over the limit.",
    "Warning· repeats-title-word“timer” already appears in the title.",
    "Info· no-benefitThe subtitle names no benefit.",
  ]);
  await expect(page.getByText("No issues.")).toHaveCount(0);
});

test("a google play listing has no captions, localizations or keyword field", async ({
  page,
}) => {
  await page.goto("/apps/app-gp/metadata");

  await expect(status(page)).not.toContainText("screenshots");
  await expect(status(page)).not.toContainText("keyword field");
  await expect(
    page.getByRole("region", { name: "App Store localizations" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Screenshot captions" }),
  ).toHaveCount(0);
});

test("the workbench fits a phone without sideways scroll", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto("/apps/app-1/metadata?fieldLocale=es-MX");

  await expect(coverage(page)).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await expect(
    coverage(page).getByRole("columnheader", { name: "Bucket" }),
  ).toBeHidden();
});
