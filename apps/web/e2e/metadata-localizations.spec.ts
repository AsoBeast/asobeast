import { expect, test } from "./session.mts";

const APPLE_URL =
  "https://developer.apple.com/help/app-store-connect/reference/app-store-localizations/";

const US_LANGUAGES = [
  "Arabic",
  "Chinese (Simplified)",
  "Chinese (Traditional)",
  "French",
  "Korean",
  "Portuguese (Brazil)",
  "Russian",
  "Spanish (Mexico)",
  "Vietnamese",
];

test("the metadata page lists what the home storefront and each market read", async ({
  page,
}) => {
  await page.goto("/apps/app-1/metadata");

  const card = page.getByRole("region", { name: "Storefront localizations" });
  const storefront = (name: string) =>
    card
      .getByRole("listitem")
      .filter({ has: page.getByRole("heading", { level: 3, name }) });

  await expect(page.getByRole("heading", { level: 2 })).toHaveText([
    "Storefront localizations",
    "Keyword coverage",
  ]);
  await expect(card.getByRole("heading", { level: 3 })).toHaveText([
    "United States",
    "Poland",
    "United Kingdom",
  ]);
  await expect(
    card.getByText(
      "Each localization has its own 30 character title, 30 character subtitle and 100 byte keyword field.",
    ),
  ).toBeVisible();
  await expect(
    card.getByRole("link", { name: /Apple.s localization table/ }),
  ).toHaveAttribute("href", APPLE_URL);

  const us = storefront("United States");
  await expect(us.getByText("Home storefront")).toBeVisible();
  await expect(us.getByText("Default language: English (U.S.)")).toBeVisible();
  await expect(
    us.getByText(
      "9 more localizations: 9 more titles, subtitles and keyword fields that US search reads",
    ),
  ).toBeVisible();
  await expect(
    us
      .getByRole("list", { name: "Additional languages in United States" })
      .getByRole("listitem"),
  ).toHaveText(US_LANGUAGES);

  const poland = storefront("Poland");
  await expect(
    poland.getByText(
      "1 more localization: 1 more title, subtitle and keyword field that PL search reads",
    ),
  ).toBeVisible();
  await expect(
    poland
      .getByRole("list", { name: "Additional languages in Poland" })
      .getByRole("listitem"),
  ).toHaveText(["Polish"]);

  await expect(
    storefront("United Kingdom").getByText(
      "Apple lists no additional language for this storefront.",
    ),
  ).toBeVisible();
});

test("a google play app shows no storefront localizations", async ({
  page,
}) => {
  await page.goto("/apps/app-gp/metadata");

  await expect(
    page.getByRole("heading", { name: "Keyword coverage" }),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Storefront localizations" }),
  ).toHaveCount(0);
});

test("the card arrives with the page and the browser never asks for it", async ({
  page,
}) => {
  const requested: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.endsWith("/keyword-countries")) {
      requested.push(request.url());
    }
  });

  const html = await page.request
    .get("/apps/app-1/metadata")
    .then((response) => response.text());
  expect(html).toContain("9 more localizations");

  await page.goto("/apps/app-1/metadata");
  await expect(
    page.getByRole("region", { name: "Storefront localizations" }),
  ).toBeVisible();
  await page.waitForLoadState("networkidle");

  expect(requested).toEqual([]);
});

test("the metadata page stays up when the markets cannot be read", async ({
  page,
}) => {
  await page.context().addCookies([
    {
      name: "e2e-keyword-countries-error",
      value: "1",
      domain: "localhost",
      path: "/",
    },
  ]);
  const requested: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.endsWith("/keyword-countries")) {
      requested.push(request.url());
    }
  });

  await page.goto("/apps/app-1/metadata");
  await expect(
    page.getByRole("heading", { name: "Keyword coverage" }),
  ).toBeVisible();
  await page.waitForTimeout(3000);

  expect(requested).toEqual([]);
  await expect(page.getByText("Metadata could not be loaded")).toHaveCount(0);
  await expect(
    page.getByRole("region", { name: "Storefront localizations" }),
  ).toHaveCount(0);
});

test("without ai drafts the storefront languages are plain labels", async ({
  page,
}) => {
  await page.goto("/apps/app-1/metadata");

  await expect(
    page.getByRole("region", { name: "Storefront localizations" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /^Draft with AI/ }),
  ).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "AI drafts" })).toHaveCount(0);
});
