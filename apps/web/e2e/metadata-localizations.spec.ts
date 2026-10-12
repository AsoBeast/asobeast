import { expect, test } from "./session.mts";

const APPLE_URL =
  "https://developer.apple.com/help/app-store-connect/reference/app-store-localizations/";

const SECTION = "App Store localizations";

test("the metadata page lists what the home storefront and each market read", async ({
  page,
}) => {
  await page.goto("/apps/app-1/metadata");

  const section = page.getByRole("region", { name: SECTION });

  await expect(page.getByRole("heading", { level: 2 })).toHaveText([
    "Screenshot captions",
    SECTION,
    "Keyword coverage",
  ]);
  await expect(
    section.getByText(
      "Each localization has its own 30 character title, 30 character subtitle and 100 character keyword field.",
    ),
  ).toBeVisible();
  await expect(
    section.getByRole("link", { name: /Apple.s localization table/ }),
  ).toHaveAttribute("href", APPLE_URL);
  await expect(section.locator("[data-slot=accordion-trigger]")).toHaveCount(4);
});

test("a google play app shows no storefront localizations", async ({
  page,
}) => {
  await page.goto("/apps/app-gp/metadata");

  await expect(
    page.getByRole("heading", { name: "Keyword coverage" }),
  ).toBeVisible();
  await expect(page.getByRole("region", { name: SECTION })).toHaveCount(0);
});

test("the section arrives with the page and the browser never asks for it", async ({
  page,
}) => {
  const requested: string[] = [];
  page.on("request", (request) => {
    const { pathname } = new URL(request.url());
    if (
      pathname.endsWith("/keyword-countries") ||
      pathname.endsWith("/localizations")
    ) {
      requested.push(request.url());
    }
  });

  const html = await page.request
    .get("/apps/app-1/metadata")
    .then((response) => response.text());
  expect(html).toContain("A keyword field belongs to a language");

  await page.goto("/apps/app-1/metadata");
  await expect(page.getByRole("region", { name: SECTION })).toBeVisible();
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
  await expect(page.getByRole("region", { name: SECTION })).toBeVisible();
});

test("without ai drafts there is no draft button in a localization", async ({
  page,
}) => {
  await page.goto("/apps/app-1/metadata?fieldLocale=es-MX");

  await expect(page.getByRole("region", { name: SECTION })).toBeVisible();
  await expect(
    page.getByRole("textbox", { name: "Spanish (Mexico) keyword field" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /^Draft with AI/ }),
  ).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "AI drafts" })).toHaveCount(0);
});

test("suggests and links the keyword field of the viewed localization", async ({
  page,
}) => {
  await page.goto("/apps/app-1/metadata?market=pl&localization=pl");

  await expect(
    page.getByText("Suggested keyword field · Polish"),
  ).toBeVisible();
  await page.getByRole("link", { name: "Edit this keyword field" }).click();
  await expect(page).toHaveURL(
    /\/apps\/app-1\/keywords\?country=pl&fieldLocale=pl$/,
  );
  await expect(
    page.getByText("App Store keyword field · Polish"),
  ).toBeVisible();
});

test("shows the keyword field card of the viewed localization", async ({
  page,
}) => {
  await page.goto("/apps/app-1/metadata?market=pl&localization=pl");

  await expect(
    page.getByRole("textbox", { name: "Keyword field" }),
  ).toHaveValue("nawyki,cel");
});
