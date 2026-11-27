import { expect, test } from "./session.mts";
import type { Page } from "@playwright/test";
import { APP_PL_NATIVE_ID, APP_SUGGESTED_LOCALES_ID } from "./fixtures.mts";
import { hydrated } from "./hydrated.mts";
import { METADATA_AUDIT_COOKIE } from "./metadata-fixtures.mts";
import { seedLocalizations } from "./localizations.mts";
import { seedViewer } from "./viewer.mts";

const APPLE_URL =
  "https://developer.apple.com/help/app-store-connect/reference/app-store-localizations/";

const SECTION = "App Store localizations";

test("the metadata page lists what the home storefront and each market read", async ({
  page,
}) => {
  await page.goto("/apps/app-1/metadata");

  const section = page.getByRole("region", { name: SECTION });

  await expect(page.getByRole("heading", { level: 2 })).toHaveText([
    "Metadata",
    "Coverage by field",
    "Keyword coverage",
    SECTION,
    "Screenshot captions",
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
  expect(html).toContain("Each localization has its own");

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

test("links the suggestion to the keyword field of the viewed localization", async ({
  page,
}) => {
  await page.goto("/apps/app-1/metadata?market=pl&localization=pl");

  await expect(
    page.getByText("Suggested keyword field · Polish"),
  ).toBeVisible();
  await expect(
    page.getByRole("tablist", { name: "Repeated words shown" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Edit this keyword field" }).click();
  await expect(page).toHaveURL(
    /\/apps\/app-1\/metadata\?fieldLocale=pl#app-localizations$/,
  );
  await expect(page.getByRole("button", { name: /^Polish/ })).toHaveAttribute(
    "aria-expanded",
    "true",
  );
  await expect(
    page.getByRole("textbox", { name: "Polish keyword field" }),
  ).toHaveValue("nawyki,cel");
});

test("opens the polish home box from the keyword field suggestion", async ({
  page,
}) => {
  await page.context().addCookies([
    {
      name: METADATA_AUDIT_COOKIE,
      value: "suggestion",
      domain: "localhost",
      path: "/",
    },
  ]);
  await page.goto(`/apps/${APP_PL_NATIVE_ID}/metadata`);

  await (
    await hydrated(page.getByRole("link", { name: "Edit this keyword field" }))
  ).click();

  await expect(page).toHaveURL(
    new RegExp(
      `/apps/${APP_PL_NATIVE_ID}/metadata\\?fieldLocale=pl#app-localizations$`,
    ),
  );
  await expect(page.getByRole("button", { name: /^Polish/ })).toHaveAttribute(
    "aria-expanded",
    "true",
  );
});

test("shows the keyword field card of the viewed localization", async ({
  page,
}) => {
  await page.goto("/apps/app-1/metadata?market=pl&localization=pl");

  await expect(
    page.getByRole("textbox", { name: "Keyword field" }),
  ).toHaveValue("nawyki,cel");
});

test.describe("suggested markets in the localization matrix", () => {
  test.describe.configure({ mode: "serial" });
  const LOCALES = APP_SUGGESTED_LOCALES_ID;
  const matrixOf = (page: Page) =>
    page.getByRole("region", { name: SECTION }).getByRole("table", {
      name: /Which of your markets read each localization/,
    });

  test("the matrix suggests an untracked default reader of a shipped localization", async ({
    page,
  }) => {
    await seedLocalizations(page.request, LOCALES, {
      shipped: [{ localization: "fr", origin: "detected" }],
    });
    await page.goto(`/apps/${LOCALES}/metadata`);

    const matrix = matrixOf(page);
    const suggested = matrix.getByRole("columnheader", {
      name: /^FR suggested/,
    });
    await expect(suggested).toBeVisible();
    await expect(suggested).toHaveAttribute("title", "France, suggested");
    await expect(
      matrix.getByRole("columnheader", { name: /^BR suggested/ }),
    ).toHaveCount(0);
    const french = matrix
      .getByRole("row")
      .filter({ has: page.getByRole("rowheader", { name: /^French/ }) });
    await expect(french.getByRole("cell").last()).toHaveText("Default");
    await expect(
      page.getByText("France reads French.", { exact: false }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Add FR as a market" }),
    ).toHaveAttribute("href", `/apps/${LOCALES}/keywords?country=fr`);
  });

  test("a suggested market becomes an ordinary column once tracked", async ({
    page,
  }) => {
    await seedLocalizations(page.request, LOCALES, {
      shipped: [{ localization: "fr", origin: "detected" }],
      fields: { fr: ["minuteur"] },
      tracked: { fr: ["minuteur"] },
    });
    await page.goto(`/apps/${LOCALES}/metadata`);

    const matrix = matrixOf(page);
    await expect(
      matrix.getByRole("columnheader", { name: /^FR France$/ }),
    ).toBeVisible();
    await expect(
      matrix.getByRole("columnheader", { name: /suggested/ }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("link", { name: "Add FR as a market" }),
    ).toHaveCount(0);
  });
});

test.describe("the localizations header and fields note from the first paint", () => {
  const serverHtml = async (page: Page) => {
    const response = await page.request.get(
      "/apps/app-1/metadata?market=pl&localization=pl",
    );
    expect(response.ok()).toBe(true);
    return response.text();
  };

  test("holds the owner's import control in the localizations header", async ({
    page,
  }) => {
    expect(await serverHtml(page)).toContain("Import from App Store Connect");
  });

  test("dates the snapshot of the viewed market", async ({ page }) => {
    expect(await serverHtml(page)).toContain("Snapshot of ");
  });

  test("leaves the import control out for a member", async ({
    page,
    context,
  }) => {
    await seedViewer(context, "member");
    expect(await serverHtml(page)).not.toContain(
      "Import from App Store Connect",
    );

    await page.goto("/apps/app-1/metadata?market=pl&localization=pl");
    const section = page.getByRole("region", { name: SECTION });
    await expect(
      await hydrated(
        section.getByRole("button", { name: "Find localizations" }),
      ),
    ).toBeVisible();
    await expect(
      section.getByRole("button", { name: "Import from App Store Connect" }),
    ).toHaveCount(0);
  });

  test("hydrates the owner's controls without a mismatch", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    page.on("pageerror", (error) => errors.push(error.message));

    const signedIn = page.waitForResponse(/\/auth\/me/);
    await page.goto("/apps/app-1/metadata?market=pl&localization=pl");
    await signedIn;
    const importButton = page
      .getByRole("region", { name: SECTION })
      .getByRole("button", { name: "Import from App Store Connect" });
    await expect(await hydrated(importButton)).toBeVisible();

    expect(errors.filter((text) => /hydrat|#418/i.test(text))).toEqual([]);
  });
});
