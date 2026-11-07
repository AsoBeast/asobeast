import { type Page } from "@playwright/test";
import { PLAN_LIMITS, UPGRADE_PATH, type AccountPlan } from "@asobeast/shared";
import {
  APP_TRANSLATED_DISCOVERY_STATES_ID,
  APP_TRANSLATED_DISCOVERY_TRACK_ID,
} from "./fixtures.mts";
import { holdRequest } from "./held-request.mts";
import { hydrated } from "./hydrated.mts";
import { MOCK_API_URL } from "./localizations.mts";
import { startedSetup } from "./setup-session.mts";
import { seedChecklist } from "./workspace-checklist.mts";
import {
  chooseImportFile,
  openImportDialog,
  resetImportKeywords,
} from "./keyword-import-dialog.mts";
import { fulfillJson, routePlan } from "./plan-helpers.mts";
import { SERP_HISTORY_DAYS } from "./serp-history.mts";
import type { SerpEntryItem, SerpSnapshot } from "@asobeast/shared";
import { expect, test } from "./session.mts";
import { collectDomErrors, translateText } from "./translate.mts";
import { openBilling } from "./trial-plans.mts";
import { typeInto } from "./type.mts";
import {
  CHECKOUT_UNCONFIGURED,
  HANDLED_BY_STRIPE,
} from "../src/lib/plan-choice";
import { openSettledDialog } from "./dialog.mts";
import { GOOGLE_SIGN_IN_COOKIE } from "./store-connections.mts";
import { seedViewer } from "./viewer.mts";

const TRIAL_PLAN: AccountPlan = {
  plan: "trial",
  displayName: "Trial",
  billing: true,
  entitled: true,
  hasBillingAccount: false,
  subscribed: false,
  cancelAtPeriodEnd: false,
  trialEndsAt: "2026-11-02T00:00:00.000Z",
  renewsAt: null,
  upgradeTo: "indie",
  upgradePath: UPGRADE_PATH,
  limits: PLAN_LIMITS.trial,
  usage: {
    apps: { used: 1, limit: PLAN_LIMITS.trial.apps },
    keywordMarkets: { used: 20, limit: PLAN_LIMITS.trial.keywordMarkets },
  },
};

async function routeUpgrade(page: Page): Promise<void> {
  await page.route("**/api/backend/auth/status", (route) =>
    route.fulfill(
      fulfillJson(200, {
        billing: true,
        registrationOpen: true,
        setupRequired: false,
        authenticated: true,
      }),
    ),
  );
  await routePlan(page, TRIAL_PLAN);
  await page.route("**/api/backend/billing/catalog", (route) =>
    route.fulfill(
      fulfillJson(200, {
        enabled: true,
        prices: [
          {
            plan: "indie",
            interval: "month",
            priceId: "price_indie_month",
            amountUsd: 10,
          },
        ],
      }),
    ),
  );
}

async function openUpgrade(page: Page): Promise<void> {
  await routeUpgrade(page);
  await page.goto("/upgrade");
}

test("a translated upgrade page shows the payment note the catalog brings", async ({
  page,
}) => {
  const errors = collectDomErrors(page);
  await routeUpgrade(page);
  const catalog = await holdRequest(
    page,
    /\/api\/backend\/billing\/catalog$/,
    "GET",
    (route) =>
      route.fulfill(
        fulfillJson(200, {
          enabled: true,
          prices: [
            {
              plan: "indie",
              interval: "month",
              priceId: "price_indie_month",
              amountUsd: 10,
            },
          ],
        }),
      ),
  );
  await page.goto("/upgrade");
  await hydrated(page.getByText(CHECKOUT_UNCONFIGURED));

  await translateText(page);
  catalog.release();

  await expect(page.getByText(HANDLED_BY_STRIPE)).toBeVisible();
  expect(errors).toEqual([]);
});

test("a translated upgrade page keeps working when checkout starts", async ({
  page,
}) => {
  const errors = collectDomErrors(page);
  const checkout = await holdRequest(
    page,
    /\/api\/backend\/billing\/checkout$/,
    "POST",
    (route) => route.fulfill(fulfillJson(503, { message: "Try later" })),
  );
  await openUpgrade(page);
  const choose = await hydrated(
    page.getByRole("button", { name: "Choose Indie" }),
  );

  await translateText(page);
  await choose.click();

  await expect(choose.locator(".animate-spin")).toBeVisible();
  checkout.release();
  await expect(choose.locator(".animate-spin")).toHaveCount(0);
  await expect(choose).toBeVisible();
  expect(errors).toEqual([]);
});

test("a translated confirmation page shows the new label of a button it changed", async ({
  page,
}) => {
  const errors = collectDomErrors(page);
  await seedViewer(page.context(), "checkout-pending-unconfirmed");
  await openBilling(page);
  const resend = await holdRequest(
    page,
    /\/api\/backend\/auth\/verify\/resend$/,
    "POST",
    (route) => route.fulfill({ status: 204 }),
  );
  await page.goto("/confirm-email");
  const button = await hydrated(
    page.getByRole("button", { name: "Send a new link" }),
  );

  await translateText(page);
  await button.click();

  await expect(button.locator(".animate-spin")).toBeVisible();
  resend.release();
  await expect(
    page.getByRole("button", { name: "New link sent" }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test("a translated settings page opens the delivery log", async ({ page }) => {
  const errors = collectDomErrors(page);
  await page.goto("/settings");
  const toggle = await hydrated(
    page.getByRole("button", { name: "Recent deliveries" }).last(),
  );

  await translateText(page);
  await toggle.click();

  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await expect(
    page.getByText("Success", { exact: true }).first(),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test("a translated alert dialog changes its rating threshold", async ({
  page,
}) => {
  const errors = collectDomErrors(page);
  await page.goto("/settings");
  const dialog = await openSettledDialog(page, "Add webhook");

  await translateText(page);
  await dialog.getByRole("switch", { name: /rating dropped/i }).click();
  const threshold = dialog.getByRole("combobox", {
    name: /rating drop threshold/i,
  });
  await expect(threshold).toBeVisible();
  await translateText(page);
  await threshold.click();
  await page.getByRole("option", { name: /0\.3 stars/i }).click();
  await translateText(page);
  await threshold.click();
  await page.getByRole("option", { name: /0\.5 stars/i }).click();

  await expect(threshold).toHaveText(/0\.5 stars/i);
  expect(errors).toEqual([]);
});

test("a translated settings page edits the essential alert", async ({
  page,
  context,
}) => {
  const errors = collectDomErrors(page);
  await context.addCookies([
    { name: "e2e-essential-alert", value: "1", url: "http://localhost:3000" },
  ]);
  await page.goto("/settings");
  const row = page
    .getByRole("listitem")
    .filter({ hasText: "owner@example.com" })
    .first();
  await expect(row.getByText("Essential alerts")).toBeVisible();

  await translateText(page);
  await row.getByRole("button", { name: /edit rules/i }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("switch", { name: /new review/i }).click();
  await expect(
    dialog.getByRole("group", { name: /new review stars/i }),
  ).toBeVisible();
  await translateText(page);
  await dialog.getByRole("switch", { name: /rank dropped/i }).click();

  await expect(
    dialog.getByRole("textbox", { name: /rank drop positions/i }),
  ).toHaveCount(0);
  expect(errors).toEqual([]);
});

const REVIEW_FILTERS = [
  "Filter by date",
  "Filter by version",
  "Filter by reply state",
  "Sort reviews",
] as const;

test("a translated reviews page opens each of its filters", async ({
  page,
}) => {
  const errors = collectDomErrors(page);
  await page.goto("/apps/app-long/reviews");
  await hydrated(page.getByRole("combobox", { name: "Filter by date" }));

  await translateText(page);
  for (const name of REVIEW_FILTERS) {
    await page.getByRole("combobox", { name }).click();
    await expect(page.getByRole("listbox")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("listbox")).toHaveCount(0);
  }
  await page.getByRole("combobox", { name: "Filter by date" }).click();
  await page.getByRole("option", { name: /last 30 days/i }).click();

  await expect(page).toHaveURL(/since=30d/);
  await expect(
    page.getByRole("combobox", { name: "Filter by date" }),
  ).toHaveText(/last 30 days/i);
  expect(errors).toEqual([]);
});

const PLAIN_LIST = "focus timer\ndeep work\n";

test.describe("a translated import dialog", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeEach(async ({ request }) => {
    await resetImportKeywords(request);
  });

  test("closes with a file loaded", async ({ page }) => {
    const errors = collectDomErrors(page);
    const dialog = await openImportDialog(page);
    await chooseImportFile(dialog, PLAIN_LIST, "plain-list.txt");
    await expect(
      dialog.getByRole("row", { name: /focus timer/ }),
    ).toBeVisible();

    await translateText(page);
    await dialog.getByRole("button", { name: /cancel/i }).click();

    await expect(dialog).toBeHidden();
    await expect(
      page.getByRole("button", { name: /import csv/i }).first(),
    ).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("changes the market for rows without a country", async ({ page }) => {
    const errors = collectDomErrors(page);
    const dialog = await openImportDialog(page);
    await chooseImportFile(dialog, PLAIN_LIST, "plain-list.txt");
    const row = dialog.getByRole("row", { name: /focus timer/i });
    await expect(row).toContainText("US");

    await translateText(page);
    await dialog
      .getByRole("combobox", { name: "Market for rows without a country" })
      .click();
    await page.getByRole("option", { name: /PL/ }).click();

    await expect(row).toContainText(/pl/i);
    await expect(dialog).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("takes another file", async ({ page }) => {
    const errors = collectDomErrors(page);
    const dialog = await openImportDialog(page);
    await chooseImportFile(dialog, PLAIN_LIST, "plain-list.txt");
    await expect(
      dialog.getByRole("row", { name: /focus timer/ }),
    ).toBeVisible();

    await translateText(page);
    await chooseImportFile(dialog, "keyword,country\nzegar pracy,pl\n");

    await expect(
      dialog.getByRole("row", { name: /zegar pracy/ }),
    ).toBeVisible();
    expect(errors).toEqual([]);
  });
});

const flipped = (
  entry: SerpEntryItem,
  newest: readonly SerpEntryItem[],
): SerpEntryItem => {
  const rose = newest[entry.position - 1]?.movement === "up";
  const delta = rose && entry.position > 1 ? 1 : -1;
  return {
    ...entry,
    previous: entry.position - delta,
    delta,
    movement: delta < 0 ? "up" : "down",
    titleMatch: "none",
  };
};

async function rewriteEarlierDays(page: Page): Promise<void> {
  let newest: SerpEntryItem[] = [];
  await page.route("**/api/backend/keywords/kw-3/serp*", async (route) => {
    const response = await route.fetch();
    const snapshot = (await response.json()) as SerpSnapshot;
    if (!new URL(route.request().url()).searchParams.has("date")) {
      newest = snapshot.entries;
      return route.fulfill({ response, json: snapshot });
    }
    return route.fulfill({
      response,
      json: {
        ...snapshot,
        entries: snapshot.entries.map((entry) => flipped(entry, newest)),
      },
    });
  });
}

test("a translated search results sheet steps through its captured days", async ({
  page,
}) => {
  const [, YESTERDAY, DAY_BEFORE] = SERP_HISTORY_DAYS;
  const errors = collectDomErrors(page);
  await rewriteEarlierDays(page);
  await page.goto("/apps/app-1/keywords?serp=kw-3");
  const sheet = page.getByRole("dialog", { name: "Search results" });
  const summary = sheet.locator('[data-slot="serp-summary"]');
  await expect(sheet.locator("li#serp-row-1")).toBeVisible();
  await expect(summary).toContainText("7 of 10");
  const previous = await hydrated(
    sheet.getByRole("button", { name: "Previous captured day" }),
  );

  await translateText(page);
  await previous.click();
  await expect(page).toHaveURL(new RegExp(`serpDate=${YESTERDAY}`));
  await expect(sheet.locator("li#serp-row-1")).toBeVisible();
  await expect(summary).toContainText("0 of 10");
  await previous.click();
  await expect(page).toHaveURL(new RegExp(`serpDate=${DAY_BEFORE}`));
  await expect(sheet.locator("[aria-busy]")).toHaveCount(0);
  await sheet.getByRole("button", { name: "Next captured day" }).click();
  await expect(page).toHaveURL(new RegExp(`serpDate=${YESTERDAY}`));

  await expect(summary).toBeVisible();
  expect(errors).toEqual([]);
});

const shownText = (text: string) =>
  text.replace(/\s+/g, " ").trim().toLowerCase();

test("a translated search results sheet shows the apps of the day it steps to", async ({
  page,
}) => {
  const [, YESTERDAY] = SERP_HISTORY_DAYS;
  await page.goto(`/apps/app-1/keywords?serp=kw-3&serpDate=${YESTERDAY}`);
  const sheet = page.getByRole("dialog", { name: "Search results" });
  const rows = sheet.locator('[data-slot="serp-row"]');
  await expect(sheet.locator("li#serp-row-5")).toContainText(
    "Timer for Study Sessions",
  );
  const untranslated = (await rows.allInnerTexts()).map(shownText);

  const errors = collectDomErrors(page);
  await page.goto("/apps/app-1/keywords?serp=kw-3");
  await expect(sheet.locator("li#serp-row-5")).toContainText(
    "Study Timer Daily",
  );
  const previous = await hydrated(
    sheet.getByRole("button", { name: "Previous captured day" }),
  );

  await translateText(page);
  await previous.click();
  await expect(page).toHaveURL(new RegExp(`serpDate=${YESTERDAY}`));

  await expect(sheet.locator("li#serp-row-5")).toContainText(
    /timer for study sessions/i,
  );
  await expect
    .poll(async () => (await rows.allInnerTexts()).map(shownText))
    .toEqual(untranslated);
  expect(errors).toEqual([]);
});

test("a translated keywords page counts the keywords it selects", async ({
  page,
}) => {
  const errors = collectDomErrors(page);
  await page.goto("/apps/app-1/keywords");
  await (
    await hydrated(page.getByRole("checkbox", { name: "Select focus timer" }))
  ).check();
  const bar = page.getByRole("group", { name: "Bulk keyword actions" });
  await expect(bar).toContainText("1 selected");

  await translateText(page);
  await page.getByRole("checkbox", { name: "Select study timer" }).check();

  await expect(bar).toContainText(/2 selected/i);
  expect(errors).toEqual([]);
});

test("a translated keywords page filters by type and clears it", async ({
  page,
}) => {
  const errors = collectDomErrors(page);
  await page.goto("/apps/app-1/keywords");
  const typeFilter = await hydrated(
    page.getByRole("button", { name: "Filter by type" }),
  );

  await translateText(page);
  await typeFilter.click();
  await page.getByRole("option", { name: /Own brand/ }).click();
  await page.keyboard.press("Escape");
  await expect(page).toHaveURL(/type=ownBrand/);
  await page.getByRole("button", { name: /^Remove Type/ }).click();

  await expect(page).not.toHaveURL(/type=/);
  await expect(
    page.getByRole("table", { name: /Tracked keywords/i }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test("a translated keywords page brings back the badges a search hid", async ({
  page,
}) => {
  const errors = collectDomErrors(page);
  await page.goto("/apps/app-1/keywords");
  const search = await hydrated(
    page.getByRole("textbox", { name: "Search keywords" }),
  );
  const pomodoro = page.getByRole("row").filter({
    has: page.getByRole("checkbox", { name: "Select pomodoro", exact: true }),
  });
  await expect(
    pomodoro.getByRole("group", { name: "Insights", exact: true }),
  ).toBeVisible();

  await translateText(page);
  await search.fill("focus");
  await expect(pomodoro).toHaveCount(0);
  await search.fill("");

  await expect(
    pomodoro
      .getByRole("group", { name: "Insights", exact: true })
      .getByRole("button", { name: /^Dropping/ }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test("a translated keywords page totals the keywords a search keeps", async ({
  page,
}) => {
  const errors = collectDomErrors(page);
  await page.goto("/apps/app-1/keywords");
  const search = await hydrated(
    page.getByRole("textbox", { name: "Search keywords" }),
  );
  const footer = page.locator("tfoot");
  await expect(footer).toContainText("5 keywords");

  await translateText(page);
  await search.fill("timer");

  await expect(footer).toContainText(/2 keywords/i);
  await expect(footer).toContainText(/2 ranked, 0 not found/i);
  expect(errors).toEqual([]);
});

test("a translated keywords table keeps drawing its listing marks", async ({
  page,
}) => {
  const errors = collectDomErrors(page);
  await page.goto("/apps/app-marks/keywords");
  const table = page.getByRole("table", { name: /tracked keywords/i });
  const sort = await hydrated(
    table.getByRole("button", { name: /^keyword$/i }),
  );
  await expect(table.locator("mark").first()).toBeVisible();

  await translateText(page);
  await sort.click();
  await sort.click();

  await expect(table.locator("mark").first()).toBeVisible();
  await expect(table.locator("mark")).toHaveCount(8);

  await page.getByRole("button", { name: /^columns$/i }).click();
  const marks = page.getByRole("menuitemcheckbox", {
    name: /^listing marks$/i,
  });
  await marks.click();
  await expect(table.locator("mark")).toHaveCount(0);
  await marks.click();
  await page.keyboard.press("Escape");

  await expect(table.locator("mark")).toHaveCount(8);
  expect(errors).toEqual([]);
});

test("a translated keywords table keeps the last position of a lost keyword", async ({
  page,
}) => {
  const errors = collectDomErrors(page);
  await page.goto("/apps/app-marks/keywords");
  const table = page.getByRole("table", { name: /tracked keywords/i });
  const sort = await hydrated(
    table.getByRole("button", { name: /^position$/i }),
  );
  await expect(table.getByText(">200 (was #14)")).toBeVisible();

  await translateText(page);
  await sort.click();
  await sort.click();

  await expect(table.getByText(/>200 \(was #14\)/i)).toBeVisible();
  await expect(table.getByText(/>200 \(was #9\)/i)).toBeVisible();
  expect(errors).toEqual([]);
});

test("a translated metadata page counts what is typed into a field", async ({
  page,
}) => {
  const errors = collectDomErrors(page);
  await page.goto("/apps/app-1/metadata");
  const field = await hydrated(
    page.getByRole("textbox", { name: "Keyword field" }),
  );
  await typeInto(field, "focus,timer");
  const countId = await field.getAttribute("aria-describedby");
  const count = page.locator(`[id="${countId}"]`);
  await expect(count).toHaveText("11/100");

  await translateText(page);
  await typeInto(field, "ą".repeat(101));

  await expect(count).toHaveText("101/100 · 1 over");
  expect(errors).toEqual([]);
});

test("a translated overview names the market it switched to", async ({
  page,
}) => {
  const errors = collectDomErrors(page);
  await page.goto("/apps/app-1");
  const card = page
    .locator('[data-slot="card"]')
    .filter({ hasText: /in top 10/i });
  await expect(card).toContainText("Tracked keywords · All markets");
  const switcher = await hydrated(
    page.getByRole("combobox", { name: "Market" }),
  );

  await translateText(page);
  await switcher.click();
  await page.getByRole("option", { name: /PL · Poland/i }).click();

  await expect(page).toHaveURL(/market=pl/);
  await expect(card).toContainText(/tracked keywords · pl/i);
  expect(errors).toEqual([]);
});

test("a translated overview keeps working when a trend gets its data", async ({
  page,
}) => {
  const errors = collectDomErrors(page);
  await page.goto("/apps/app-1?market=pl");
  const visibility = page
    .locator('[data-slot="card"]')
    .filter({ has: page.getByText(/^visibility · (pl|us)$/i) });
  await expect(visibility).toContainText("no 30d data");
  const switcher = await hydrated(
    page.getByRole("combobox", { name: "Market" }),
  );

  await translateText(page);
  await switcher.click();
  await page.getByRole("option", { name: /US · United States/i }).click();

  await expect(page).toHaveURL(/market=us/);
  await expect(visibility).toContainText(/visibility · us/i);
  await expect(visibility).toContainText("-1 30d");
  await expect(visibility).not.toContainText(/no 30d data/i);
  expect(errors).toEqual([]);
});

test("a translated action sheet shows the status it changed to", async ({
  page,
}) => {
  const errors = collectDomErrors(page);
  let done = false;
  await page.route("**/api/backend/actions/act-uncovered", async (route) => {
    if (route.request().method() === "PATCH") {
      done = true;
      const current = await route.fetch({ method: "GET" });
      return route.fulfill({
        response: current,
        json: { ...(await current.json()), status: "DONE" },
      });
    }
    const response = await route.fetch();
    const item = await response.json();
    return route.fulfill({
      response,
      json: done ? { ...item, status: "DONE" } : item,
    });
  });
  await page.goto("/actions?action=act-uncovered");
  const sheet = page.getByRole("dialog");
  const markDone = await hydrated(
    sheet.getByRole("button", { name: /^done$/i }),
  );
  const status = sheet
    .locator('[data-slot="badge"]')
    .filter({ hasText: /^(open|done)$/i });
  await expect(status).toHaveText("Open");

  await translateText(page);
  await markDone.click();

  await expect(status).toHaveText("Done");
  expect(errors).toEqual([]);
});

test("a translated play dialog shows the description of the method it switches to", async ({
  page,
}) => {
  const errors = collectDomErrors(page);
  await page.context().addCookies([
    {
      name: GOOGLE_SIGN_IN_COOKIE,
      value: "1",
      domain: "localhost",
      path: "/",
    },
  ]);
  await page.goto("/integrations#store-connections");
  const dialog = await openSettledDialog(
    page,
    "Connect Google Play",
    page.getByRole("region", { name: "Store connections" }),
  );
  const keyTab = await hydrated(
    dialog.getByRole("tab", { name: "Service account key" }),
  );

  await translateText(page);
  await keyTab.click();

  await expect(dialog).toContainText(
    "Use a Google Cloud service account invited in Play Console",
  );
  expect(errors).toEqual([]);
});

test("a translated sidebar opens what's new and clears its dot", async ({
  page,
}) => {
  const errors = collectDomErrors(page);
  await page.addInitScript(() => {
    if (!window.sessionStorage.getItem("seeded")) {
      window.localStorage.setItem("asobeast.whatsNew.seen", "1.0.0");
      window.sessionStorage.setItem("seeded", "1");
    }
  });
  await page.goto("/");
  const item = await hydrated(
    page
      .getByRole("navigation", { name: "Main" })
      .getByRole("link", { name: /^What's New/ }),
  );
  await expect(item).toHaveAttribute("data-unread", "true");

  await translateText(page);
  await item.click();

  await expect(page).toHaveURL("/whats-new");
  await expect(item).toHaveAttribute("data-unread", "false");
  expect(errors).toEqual([]);
});

test.describe("a translated opportunity map", () => {
  const MAP = "/apps/app-map/keywords?view=map";
  const toggle = (page: Page, name: string) =>
    page
      .getByRole("list", { name: "Zones" })
      .getByRole("button", { name: new RegExp(`^${name} \\d+ keyword`) });
  const mapRegion = (page: Page) =>
    page.getByRole("region", { name: "Keyword opportunity map" });
  const openTranslated = async (page: Page) => {
    await page.goto(MAP);
    await hydrated(toggle(page, "Quick wins"));
    await translateText(page);
  };

  test("keeps working when a zone is pressed", async ({ page }) => {
    const errors = collectDomErrors(page);
    await openTranslated(page);

    await toggle(page, "Quick wins").click();

    await expect(page).toHaveURL(/zone=quickWins/);
    await expect(toggle(page, "Quick wins")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(
      page.getByRole("checkbox", { name: /^Select (?!all keywords)/ }),
    ).toHaveCount(8);
    expect(errors).toEqual([]);
  });

  test("follows a threshold", async ({ page }) => {
    const errors = collectDomErrors(page);
    await openTranslated(page);

    await page.getByRole("button", { name: "Thresholds" }).click();
    const dialog = page.getByRole("dialog", { name: "Zone thresholds" });
    await dialog
      .getByRole("spinbutton", { name: "Popularity at least" })
      .fill("30");

    await expect(toggle(page, "Quick wins")).toHaveAccessibleName(
      "Quick wins 6 keywords",
    );
    await expect(mapRegion(page)).toContainText("Popularity 30");
    await expect(dialog).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("switches view", async ({ page }) => {
    const errors = collectDomErrors(page);
    await openTranslated(page);

    await page.getByRole("tab", { name: "Table" }).click();
    await expect(mapRegion(page)).toHaveCount(0);
    await page.getByRole("tab", { name: "Map" }).click();

    await expect(mapRegion(page)).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("follows a filter", async ({ page }) => {
    const errors = collectDomErrors(page);
    await openTranslated(page);

    await page.getByRole("button", { name: "Filter by tags" }).click();
    await page.getByRole("option", { name: /^core/ }).click();
    await page.keyboard.press("Escape");

    await expect(page.locator("[data-map-keyword]")).toHaveCount(4);
    await expect(toggle(page, "Quick wins")).toHaveAccessibleName(
      "Quick wins 3 keywords",
    );
    await expect(toggle(page, "Low priority")).toHaveAccessibleName(
      "Low priority 0 keywords",
    );
    expect(errors).toEqual([]);
  });

  test("shows the overlay of a hovered dot while another has focus", async ({
    page,
  }) => {
    const errors = collectDomErrors(page);
    await openTranslated(page);

    await page.locator('[data-map-keyword="kw-map-1"]').focus();
    await page.locator('[data-map-keyword="kw-map-2"]').hover();

    await expect(page.locator('[data-slot="map-overlay"]')).toContainText(
      "pomodoro app",
    );
    expect(errors).toEqual([]);
  });
});

test("a translated alerts page loads more, filters and searches", async ({
  page,
}) => {
  const errors = collectDomErrors(page);
  await page.goto("/alerts");
  await hydrated(page.getByRole("button", { name: "Load more" }));

  await translateText(page);
  await page.getByRole("button", { name: "Load more" }).click();
  await expect(page.locator('[data-slot="feed-end"]')).toHaveText(
    /every event of the last 30 days/i,
  );
  await page.getByRole("button", { name: /^Filter by event type/ }).click();
  await page.getByRole("option", { name: /Rank dropped/ }).click();
  await page.keyboard.press("Escape");
  await expect(page).toHaveURL(/type=rank\.dropped/);
  await page.getByRole("textbox", { name: "Search alerts" }).fill("germany");
  await expect(page).toHaveURL(/q=germany/);
  await page.getByRole("button", { name: /^Remove Search/ }).click();

  await expect(page).not.toHaveURL(/q=germany/);
  expect(errors).toEqual([]);
});

test("a translated gap analysis switches its tabs and market", async ({
  page,
}) => {
  const errors = collectDomErrors(page);
  await page.goto("/apps/app-1/competitors");
  const section = page.getByRole("region", {
    name: /where competitors beat you/i,
  });
  const winnable = await hydrated(
    section.getByRole("tab", { name: "Winnable now (2)" }),
  );

  await translateText(page);
  await winnable.click();
  await section.getByRole("tab", { name: /^threats/i }).click();
  await section.getByRole("combobox", { name: "Filter by gap market" }).click();
  await page.getByRole("option", { name: /germany/i }).click();

  await expect(page).toHaveURL(/gapCountry=de/);
  await expect(section.getByRole("tab", { name: /\(1\)$/ })).toBeVisible();
  expect(errors).toEqual([]);
});

test("a translated keywords page switches to its discoveries and their states", async ({
  page,
}) => {
  await page.request.post(
    `${MOCK_API_URL}/__reset/keyword-discoveries/${APP_TRANSLATED_DISCOVERY_STATES_ID}`,
  );
  const errors = collectDomErrors(page);
  await page.goto(`/apps/${APP_TRANSLATED_DISCOVERY_STATES_ID}/keywords`);
  const discovered = await hydrated(
    page
      .getByRole("tablist", { name: "Keyword lists" })
      .getByRole("tab", { name: /^Discovered 9/ }),
  );

  await translateText(page);
  await discovered.click();
  const states = page.getByRole("tablist", {
    name: "Discovered keyword states",
  });
  await states.getByRole("tab", { name: /^ranked/i }).click();
  await states.getByRole("tab", { name: /^opportunities/i }).click();
  await page
    .getByRole("tablist", { name: "Keyword lists" })
    .getByRole("tab", { name: /^tracked/i })
    .click();

  await expect(page).not.toHaveURL(/tab=/);
  await expect(
    page.getByRole("table", { name: /tracked keywords/i }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test("a translated discovered list tracks, auto tracks and refreshes", async ({
  page,
}) => {
  await page.request.post(
    `${MOCK_API_URL}/__reset/keyword-discoveries/${APP_TRANSLATED_DISCOVERY_TRACK_ID}`,
  );
  const errors = collectDomErrors(page);
  await page.goto(
    `/apps/${APP_TRANSLATED_DISCOVERY_TRACK_ID}/keywords?tab=discovered`,
  );
  const track = await hydrated(
    page.getByRole("button", { name: "Track work sprint", exact: true }),
  );

  await translateText(page);
  await track.click();
  await expect(
    page.getByRole("rowheader", { name: /^work sprint/i }),
  ).toHaveCount(0);
  const toggle = page.getByRole("switch", { name: /auto-track ranked/i });
  await toggle.click();
  await expect(toggle).toBeChecked();
  await page.getByRole("button", { name: /^refresh discoveries$/i }).click();
  await page.waitForLoadState("networkidle");

  await expect(
    page.getByRole("heading", { name: /discovered keywords/i }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test("a translated checklist pill opens, shrinks, cancels a hide and follows a step", async ({
  page,
  context,
}) => {
  const errors = collectDomErrors(page);
  await seedChecklist(context, "partial");
  await page.goto("/apps/app-1");
  const pill = await hydrated(
    page.getByRole("button", { name: /done in the setup checklist$/i }),
  );

  await translateText(page);
  await pill.click();
  const popover = page.getByRole("dialog");
  await popover.getByRole("button", { name: /shrink the pill/i }).click();
  await popover.getByRole("button", { name: /hide checklist/i }).click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Cancel" })
    .click();
  await pill.click();
  await page
    .getByRole("dialog")
    .getByRole("link", { name: /add a market/i })
    .click();

  await expect(page).toHaveURL(/\/apps\/app-1\/keywords$/);
  await expect(page.getByRole("button", { name: "Try again" })).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("a translated setup page chooses a goal", async ({ page, context }) => {
  const errors = collectDomErrors(page);
  await startedSetup(context, "app-1");
  await seedChecklist(context, "partial");
  await page.goto("/apps/app-1/setup");
  const research = await hydrated(
    page.getByRole("button", { name: /^Research an idea/i }),
  );

  await translateText(page);
  await research.click();
  await expect(research).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: /^Improve my rankings/i }).click();

  await expect(
    page.getByRole("button", { name: /^Improve my rankings/i }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "Try again" })).toHaveCount(0);
  expect(errors).toEqual([]);
});
