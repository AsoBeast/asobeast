import type { BrowserContext, Locator, Page } from "@playwright/test";
import type {
  ApiTokenItem,
  CompetitorItem,
  WebhookItem,
} from "@asobeast/shared";
import { holdRender } from "./chart-image.mts";
import { openEmbedded } from "./embedded-checkout.mts";
import {
  APP_GP_DETAIL,
  APP_GP_SERP_MOVERS,
  APP_CLASS_FOCUS_ID,
  APP_IMPORT_FOCUS_ID,
  AWAITING_ALERT_COOKIE,
  CROWDED_COMPETITORS_COOKIE,
  TOP_CHART_DATES,
  WEBHOOK_PAIR,
  WEBHOOK_PAIR_COOKIE,
} from "./fixtures.mts";
import {
  expectFocusKeptWhileHeld,
  holdRequest,
  pressFromKeyboard,
} from "./held-request.mts";
import { DISCOVERY_FOCUS_APP } from "./keyword-discoveries.mts";
import { MOCK_API_URL, seedLocalizations } from "./localizations.mts";
import { fulfillJson } from "./plan-helpers.mts";
import { activateTwiceInOneTask, hydrated } from "./hydrated.mts";
import {
  answerTrack,
  SERP_TRACK_PATH,
  showTrackedAfterAdd,
} from "./serp-track.mts";
import { expect, test } from "./session.mts";
import { STORE_CONNECTION_COOKIE } from "./store-connections.mts";
import { startedSetup } from "./setup-session.mts";
import { seedChecklist } from "./workspace-checklist.mts";

const seedCookie = (context: BrowserContext, name: string, value = "1") =>
  context.addCookies([{ name, value, domain: "localhost", path: "/" }]);

const confirmIn = (page: Page, name: string) =>
  page
    .getByRole("alertdialog")
    .getByRole("button", { name, exact: true })
    .press("Enter");

const becameInert = (control: Locator) =>
  expect
    .poll(() =>
      control.evaluate(
        (element) =>
          element.hasAttribute("disabled") ||
          element.getAttribute("aria-disabled") === "true",
      ),
    )
    .toBe(true);

const storeConnections = (page: Page) =>
  page.getByRole("region", { name: "Store connections" });

test("choosing a keyword type from the keyboard returns focus to the row menu", async ({
  page,
}) => {
  await page.goto(`/apps/${APP_CLASS_FOCUS_ID}/keywords`);
  const actions = page
    .getByRole("row")
    .filter({
      has: page.getByRole("checkbox", { name: "Select pomodoro", exact: true }),
    })
    .getByRole("button", { name: "Keyword actions" });
  const held = await holdRequest(
    page,
    new RegExp(`/api/backend/apps/${APP_CLASS_FOCUS_ID}/keywords/[^/?]+$`),
    "PATCH",
  );

  await pressFromKeyboard(actions);
  await page.getByRole("menuitem", { name: "Keyword type" }).focus();
  await page.keyboard.press("ArrowRight");
  await page
    .getByRole("menuitemradio", { name: "Detected automatically" })
    .focus();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");

  await expect(actions).toBeFocused();
  held.release();
  await page.waitForLoadState("networkidle");
  await expect(actions).toBeFocused();
  expect(
    await page.evaluate(() => document.activeElement === document.body),
  ).toBe(false);
});

test.describe("store connection controls keep focus", () => {
  test.beforeEach(({ context }) =>
    seedCookie(context, STORE_CONNECTION_COOKIE, "active"),
  );

  for (const [name, path] of [
    ["Verify", /\/api\/backend\/store-connections\/APP_STORE\/verify$/],
    ["Sync now", /\/api\/backend\/store-connections\/APP_STORE\/sync$/],
  ] as const) {
    test(`${name} keeps focus while its request runs`, async ({ page }) => {
      const held = await holdRequest(page, path, "POST");
      await page.goto("/integrations#store-connections");
      const control = storeConnections(page).getByRole("button", {
        name,
        exact: true,
      });

      await pressFromKeyboard(control);

      await expectFocusKeptWhileHeld(control, held);
    });
  }

  test("closing the disconnect dialog returns focus to its opener", async ({
    page,
  }) => {
    await page.goto("/integrations#store-connections");
    const opener = storeConnections(page).getByRole("button", {
      name: "Disconnect",
    });

    await pressFromKeyboard(opener);
    await expect(page.getByRole("alertdialog")).toBeVisible();
    await page.keyboard.press("Escape");

    await expect(page.getByRole("alertdialog")).toBeHidden();
    await expect(opener).toBeFocused();
  });

  test("a confirmed disconnect hands focus to the connect button", async ({
    page,
  }) => {
    await page.goto("/integrations#store-connections");

    await pressFromKeyboard(
      storeConnections(page).getByRole("button", { name: "Disconnect" }),
    );
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: "Disconnect" })
      .press("Enter");

    await expect(
      storeConnections(page).getByRole("button", {
        name: "Connect App Store Connect",
      }),
    ).toBeFocused();
  });
});

test.describe("the keyword field import controls keep focus", () => {
  test.describe.configure({ mode: "serial" });
  const localizations = (page: Page) =>
    page.getByRole("region", { name: "App Store localizations" });
  const metadata = `/apps/${APP_IMPORT_FOCUS_ID}/metadata`;

  test("cancelling the import dialog returns focus to its opener", async ({
    page,
  }) => {
    await page.goto(metadata);
    const opener = localizations(page).getByRole("button", {
      name: "Import from App Store Connect",
    });

    await pressFromKeyboard(opener);
    await expect(page.getByRole("alertdialog")).toBeVisible();
    await page.keyboard.press("Escape");

    await expect(page.getByRole("alertdialog")).toBeHidden();
    await expect(opener).toBeFocused();
  });

  test("the confirm button keeps focus while the import runs", async ({
    page,
  }) => {
    const held = await holdRequest(
      page,
      /\/api\/backend\/apps\/[^/]+\/keyword-fields\/import$/,
      "POST",
      (route) =>
        route.fulfill({
          status: 500,
          json: {
            statusCode: 500,
            error: "Server Error",
            message: "down",
            path: "/api/backend/apps/app-import-focus/keyword-fields/import",
            timestamp: new Date().toISOString(),
          },
        }),
    );
    await page.goto(metadata);
    await pressFromKeyboard(
      localizations(page).getByRole("button", {
        name: "Import from App Store Connect",
      }),
    );
    const confirm = page
      .getByRole("alertdialog")
      .getByRole("button", { name: /^(Import|Importing…)$/ });

    await pressFromKeyboard(confirm);

    await expectFocusKeptWhileHeld(confirm, held);
    await expect(page.getByRole("alertdialog")).toBeVisible();
    held.release();
    await expect(page.getByRole("alertdialog").getByText("down")).toBeVisible();
  });

  test("a confirmed import hands focus to Stop importing", async ({ page }) => {
    await page.goto(metadata);

    await pressFromKeyboard(
      localizations(page).getByRole("button", {
        name: "Import from App Store Connect",
      }),
    );
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: "Import", exact: true })
      .press("Enter");

    await expect(
      localizations(page).getByRole("button", { name: "Stop importing" }),
    ).toBeFocused();
  });

  test("Stop importing keeps focus while the request runs", async ({
    page,
  }) => {
    const held = await holdRequest(
      page,
      /\/api\/backend\/apps\/[^/]+\/keyword-fields\/import$/,
      "DELETE",
      (route) =>
        route.fulfill({
          status: 500,
          json: {
            statusCode: 500,
            error: "Server Error",
            message: "down",
            path: "/api/backend/apps/app-import-focus/keyword-fields/import",
            timestamp: new Date().toISOString(),
          },
        }),
    );
    await seedLocalizations(page.request, APP_IMPORT_FOCUS_ID, {
      markets: ["us"],
      fields: { "en-US": ["focus", "timer"] },
      storeManaged: true,
    });
    await page.goto(metadata);
    const stop = localizations(page).getByRole("button", {
      name: "Stop importing",
    });

    await pressFromKeyboard(stop);

    await expectFocusKeptWhileHeld(stop, held);
    held.release();
  });

  test("a confirmed stop hands focus to Import from App Store Connect", async ({
    page,
  }) => {
    await seedLocalizations(page.request, APP_IMPORT_FOCUS_ID, {
      markets: ["us"],
      fields: { "en-US": ["focus", "timer"] },
      storeManaged: true,
    });
    await page.goto(metadata);
    const stop = localizations(page).getByRole("button", {
      name: "Stop importing",
    });

    await pressFromKeyboard(stop);

    await expect(
      localizations(page).getByRole("button", {
        name: "Import from App Store Connect",
      }),
    ).toBeFocused();
  });
});

test.describe("the annotation remove dialog returns focus", () => {
  for (const close of ["Escape", "Cancel"] as const) {
    test(`to its trash button after ${close}`, async ({ page }) => {
      await page.goto("/apps/app-1/rankings");
      const remove = page.getByRole("button", {
        name: "Remove Autumn campaign",
      });

      await pressFromKeyboard(remove);
      const dialog = page.getByRole("alertdialog");
      await expect(dialog).toBeVisible();
      if (close === "Escape") await page.keyboard.press("Escape");
      else await dialog.getByRole("button", { name: "Cancel" }).press("Enter");

      await expect(dialog).toBeHidden();
      await expect(remove).toBeFocused();
    });
  }
});

const webhookList = (page: Page) =>
  page.getByRole("list", { name: /alert webhooks/ });

const countPosts = (page: Page, path: RegExp) => {
  const seen: string[] = [];
  page.on("request", (request) => {
    if (request.method() === "POST" && path.test(request.url())) {
      seen.push(request.url());
    }
  });
  return seen;
};

async function deleteWebhooksInBrowser(page: Page, rows: WebhookItem[]) {
  let listed = rows;
  await page.route(/\/api\/backend\/webhooks(\/[^/]+)?$/, (route) => {
    const request = route.request();
    const id = /\/webhooks\/([^/]+)$/.exec(request.url())?.[1];
    if (request.method() === "DELETE" && id) {
      listed = listed.filter((row) => row.id !== id);
      return route.fulfill({ status: 204 });
    }
    if (request.method() === "GET" && !id) {
      return route.fulfill({ json: listed });
    }
    return route.fallback();
  });
}

test.describe("the edit events dialog keeps focus", () => {
  test("Save events keeps focus while the save runs", async ({ page }) => {
    await page.goto("/settings");
    const row = webhookList(page).getByRole("listitem").first();
    const edit = row.getByRole("button", { name: "Edit rules" });
    await pressFromKeyboard(edit);
    const dialog = page.getByRole("dialog", { name: "Edit rules" });
    await dialog
      .getByRole("switch", { name: "SERP entrant", exact: true })
      .click();
    const held = await holdRequest(
      page,
      /\/api\/backend\/webhooks\/[^/]+$/,
      "PATCH",
    );
    const save = dialog.getByRole("button", { name: "Save rules" });

    await pressFromKeyboard(save);

    await expect(save).toHaveAttribute("aria-disabled", "true");
    await expect(save).not.toHaveAttribute("disabled");
    await expect(save).toBeFocused();
    held.release();
    await expect(dialog).toBeHidden();
    await expect(edit).toBeFocused();
  });
});

test("Save rules keeps focus while a save with a rank threshold runs", async ({
  page,
}) => {
  await page.goto("/settings");
  const row = webhookList(page).getByRole("listitem").first();
  await pressFromKeyboard(row.getByRole("button", { name: "Edit rules" }));
  const dialog = page.getByRole("dialog", { name: "Edit rules" });
  const rankDropped = dialog.getByRole("switch", {
    name: "Rank dropped",
    exact: true,
  });
  if ((await rankDropped.getAttribute("aria-checked")) !== "true") {
    await rankDropped.click();
  }
  await dialog.getByRole("textbox", { name: "Rank drop positions" }).fill("12");
  const held = await holdRequest(
    page,
    /\/api\/backend\/webhooks\/[^/]+$/,
    "PATCH",
  );
  const save = dialog.getByRole("button", { name: "Save rules" });
  const patch = page.waitForRequest((request) => request.method() === "PATCH");

  await pressFromKeyboard(save);

  await expect(save).toHaveAttribute("aria-disabled", "true");
  await expect(save).toBeFocused();
  expect((await patch).postDataJSON()).toMatchObject({
    rankDropThreshold: 12,
  });
  held.release();
  await expect(dialog).toBeHidden();
});

test.describe("alert rows keep focus", () => {
  test.beforeEach(({ context }) => seedCookie(context, WEBHOOK_PAIR_COOKIE));

  test("Send test keeps focus while the test runs", async ({ page }) => {
    const held = await holdRequest(
      page,
      /\/api\/backend\/webhooks\/[^/]+\/test$/,
      "POST",
    );
    await page.goto("/settings");
    const send = webhookList(page)
      .getByRole("button", { name: "Send test" })
      .first();

    await pressFromKeyboard(send);

    await expectFocusKeptWhileHeld(send, held);
  });

  test("two activations of Send test in one task send one test", async ({
    page,
  }) => {
    const posts = countPosts(page, /\/webhooks\/[^/]+\/test$/);
    await page.goto("/settings");

    const send = webhookList(page)
      .getByRole("button", { name: "Send test" })
      .first();

    await activateTwiceInOneTask(send);

    await expect.poll(() => posts.length).toBe(1);
    await expect(send).not.toHaveAttribute("aria-disabled", "true");
    expect(posts).toHaveLength(1);
  });

  test("the channel switch keeps focus while it saves", async ({ page }) => {
    const held = await holdRequest(
      page,
      /\/api\/backend\/webhooks\/[^/]+$/,
      "PATCH",
    );
    await page.goto("/settings");
    const toggle = webhookList(page)
      .getByRole("switch", { name: `Toggle ${WEBHOOK_PAIR[0].url}` })
      .first();

    await (await hydrated(toggle)).focus();
    await page.keyboard.press("Space");

    await expectFocusKeptWhileHeld(toggle, held);
  });

  test("two activations of the channel switch in one task send one save", async ({
    page,
  }) => {
    const patches: string[] = [];
    page.on("request", (request) => {
      if (request.method() === "PATCH" && /\/webhooks\//.test(request.url())) {
        patches.push(request.url());
      }
    });
    await page.goto("/settings");
    const toggle = webhookList(page)
      .getByRole("switch", { name: `Toggle ${WEBHOOK_PAIR[0].url}` })
      .first();

    await activateTwiceInOneTask(toggle);

    await expect.poll(() => patches.length).toBe(1);
    await expect(toggle).not.toHaveAttribute("aria-disabled", "true");
    expect(patches).toHaveLength(1);
  });

  test("Resend confirmation keeps focus while it sends", async ({ page }) => {
    await seedCookie(page.context(), AWAITING_ALERT_COOKIE);
    const held = await holdRequest(
      page,
      /\/api\/backend\/email-alerts\/[^/]+\/resend-confirmation$/,
      "POST",
    );
    await page.goto("/settings");
    const resend = page.getByRole("button", { name: "Resend confirmation" });

    await pressFromKeyboard(resend);

    await expectFocusKeptWhileHeld(resend, held);
  });

  test("cancelling a delete returns focus to its trash button", async ({
    page,
  }) => {
    await page.goto("/settings");
    const trash = webhookList(page)
      .getByRole("button", { name: /^Delete / })
      .first();

    await pressFromKeyboard(trash);
    await expect(page.getByRole("alertdialog")).toBeVisible();
    await page.keyboard.press("Escape");

    await expect(page.getByRole("alertdialog")).toBeHidden();
    await expect(trash).toBeFocused();
  });

  test("the confirm button keeps focus while the delete runs", async ({
    page,
  }) => {
    const held = await holdRequest(
      page,
      /\/api\/backend\/webhooks\/[^/]+$/,
      "DELETE",
      (route) =>
        route.fulfill({
          status: 500,
          json: { statusCode: 500, message: "down", error: "Server Error" },
        }),
    );
    await page.goto("/settings");
    await pressFromKeyboard(
      webhookList(page)
        .getByRole("button", { name: /^Delete / })
        .first(),
    );
    const confirm = page
      .getByRole("alertdialog")
      .getByRole("button", { name: /^(Delete|Removing…)$/ });

    await pressFromKeyboard(confirm);
    await expect(confirm).toHaveText("Removing…");

    await expectFocusKeptWhileHeld(confirm, held);
    await expect(page.getByRole("alertdialog")).toBeVisible();
  });

  test("a confirmed delete hands focus to the next row", async ({ page }) => {
    await deleteWebhooksInBrowser(page, WEBHOOK_PAIR);
    await page.goto("/settings");
    const rows = webhookList(page).getByRole("listitem");
    await expect(rows).toHaveCount(2);

    await pressFromKeyboard(
      rows.first().getByRole("button", { name: /^Delete / }),
    );
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: "Delete" })
      .press("Enter");

    await expect(rows).toHaveCount(1);
    await expect(
      rows.first().getByRole("button", { name: /^Delete / }),
    ).toBeFocused();
  });

  test("Escape keeps the delete dialog open until the delete lands", async ({
    page,
  }) => {
    await deleteWebhooksInBrowser(page, WEBHOOK_PAIR);
    const held = await holdRequest(
      page,
      /\/api\/backend\/webhooks\/[^/]+$/,
      "DELETE",
    );
    await page.goto("/settings");
    const rows = webhookList(page).getByRole("listitem");

    await pressFromKeyboard(
      rows.first().getByRole("button", { name: /^Delete / }),
    );
    await confirmIn(page, "Delete");
    await expect(page.getByRole("alertdialog")).toContainText("Removing…");
    await page.keyboard.press("Escape");
    await expect(page.getByRole("alertdialog")).toHaveAttribute(
      "data-state",
      "open",
    );
    await expect(page.getByRole("alertdialog")).not.toHaveAttribute(
      "data-state",
      "closed",
      { timeout: 1000 },
    );
    held.release();

    await expect(rows).toHaveCount(1);
    await expect(
      rows.first().getByRole("button", { name: /^Delete / }),
    ).toBeFocused();
  });

  test("deleting the last webhook hands focus to Add webhook", async ({
    page,
  }) => {
    await deleteWebhooksInBrowser(page, WEBHOOK_PAIR);
    await page.goto("/settings");
    const trash = webhookList(page).getByRole("button", { name: /^Delete / });

    for (const remaining of [1, 0]) {
      await pressFromKeyboard(trash.first());
      await page
        .getByRole("alertdialog")
        .getByRole("button", { name: "Delete" })
        .press("Enter");
      await expect(trash).toHaveCount(remaining);
    }

    await expect(
      page.getByRole("button", { name: "Add webhook" }),
    ).toBeFocused();
  });
});

const appHeader = (page: Page) => page.getByRole("banner");

test.describe("app actions keep focus", () => {
  test("Refresh keeps focus while it refreshes and gets it back from the diff", async ({
    page,
  }) => {
    const held = await holdRequest(
      page,
      /\/api\/backend\/apps\/app-1\/refresh(\?|$)/,
      "POST",
    );
    await page.goto("/apps/app-1/metadata");
    const refresh = appHeader(page).getByRole("button", {
      name: "Refresh",
      exact: true,
    });

    await pressFromKeyboard(refresh);
    await expect(refresh).toHaveAttribute("aria-disabled", "true");
    await expect(refresh).toBeFocused();
    held.release();
    const diff = page.getByRole("dialog", { name: "Snapshot refreshed" });
    await expect(diff).toBeVisible();
    await page.keyboard.press("Escape");

    await expect(diff).toBeHidden();
    await expect(refresh).toBeFocused();
  });

  test("Run daily keeps focus while it queues", async ({ page }) => {
    const held = await holdRequest(
      page,
      /\/api\/backend\/apps\/app-1\/run-daily$/,
      "POST",
    );
    await page.goto("/apps/app-1");
    const run = appHeader(page).getByRole("button", { name: "Run daily" });

    await pressFromKeyboard(run);

    await expectFocusKeptWhileHeld(run, held);
  });

  test("Refresh is inert and keeps focus while Run daily runs", async ({
    page,
  }) => {
    const refreshes = countPosts(page, /\/apps\/app-1\/refresh(\?|$)/);
    const held = await holdRequest(
      page,
      /\/api\/backend\/apps\/app-1\/run-daily$/,
      "POST",
    );
    await page.goto("/apps/app-1/metadata");
    await pressFromKeyboard(
      appHeader(page).getByRole("button", { name: "Run daily" }),
    );
    const refresh = appHeader(page).getByRole("button", {
      name: "Refresh",
      exact: true,
    });

    await refresh.focus();
    await expect(refresh).toHaveAttribute("aria-disabled", "true");
    await page.keyboard.press("Enter");
    held.release();

    await expect(refresh).not.toHaveAttribute("aria-disabled", "true");
    await expect(refresh).toBeFocused();
    expect(refreshes).toHaveLength(0);
  });
});

test.describe("generate now", () => {
  const generate = (page: Page) =>
    page.getByRole("button", { name: /^(Generate now|Generating…)$/ });

  test("keeps focus while it queues and while it follows the run", async ({
    page,
  }) => {
    const held = await holdRequest(
      page,
      /\/api\/backend\/actions\/run$/,
      "POST",
    );
    await page.goto("/actions");

    await pressFromKeyboard(generate(page));
    await expect(generate(page)).toHaveAttribute("aria-disabled", "true");
    await expect(generate(page)).toBeFocused();
    held.release();

    await expect(generate(page)).toHaveText("Generate now");
    await expect(generate(page)).toBeFocused();
  });

  test("two activations in one task send one request", async ({ page }) => {
    const posts = countPosts(page, /\/actions\/run$/);
    await page.goto("/actions");

    await activateTwiceInOneTask(generate(page));

    await expect.poll(() => posts.length).toBe(1);
    await expect(generate(page)).toHaveText("Generate now");
    expect(posts).toHaveLength(1);
  });
});

test.describe("add competitor", () => {
  const COMPETITOR_URL = "https://apps.apple.com/us/app/sample/id987654321";
  const addButton = (page: Page) =>
    page.getByRole("button", { name: /^(Add competitor|Adding…)$/ });

  test("keeps focus while it adds and after the field clears", async ({
    page,
  }) => {
    const held = await holdRequest(
      page,
      /\/api\/backend\/apps\/app-1\/competitors$/,
      "POST",
      (route) =>
        route.fulfill({
          status: 201,
          json: { id: "comp-focus", name: "Sample" },
        }),
    );
    await page.goto("/apps/app-1/competitors");
    const field = page.getByRole("textbox", {
      name: "Competitor name or App Store URL",
    });
    await field.fill(COMPETITOR_URL);

    await pressFromKeyboard(addButton(page));
    await expect(addButton(page)).toHaveAttribute("aria-disabled", "true");
    await expect(addButton(page)).toBeFocused();
    held.release();

    await expect(field).toHaveValue("");
    await expect(addButton(page)).toHaveText("Add competitor");
    await expect(addButton(page)).toHaveAttribute("aria-disabled", "true");
    await expect(addButton(page)).toBeFocused();
  });

  test("does nothing while the field is empty", async ({ page }) => {
    const posts = countPosts(page, /\/apps\/app-1\/competitors$/);
    await page.goto("/apps/app-1/competitors");

    const submitted = page.evaluate(
      () =>
        new Promise<void>((resolve) => {
          document
            .getElementById("competitor-search")
            ?.closest("form")
            ?.addEventListener("submit", () => resolve(), { once: true });
        }),
    );

    await pressFromKeyboard(addButton(page));
    await submitted;
    await page.evaluate(
      () => new Promise((resolve) => requestAnimationFrame(resolve)),
    );

    await expect(addButton(page)).toBeFocused();
    await expect(addButton(page)).toHaveText("Add competitor");
    expect(posts).toHaveLength(0);
  });
});

async function removeCompetitorsInBrowser(page: Page) {
  const removed = new Set<string>();
  await page.route(
    /\/api\/backend\/apps\/app-1\/competitors(\/[^/]+)?$/,
    async (route) => {
      const request = route.request();
      const id = /\/competitors\/([^/]+)$/.exec(request.url())?.[1];
      if (request.method() === "DELETE" && id) {
        removed.add(id);
        return route.fulfill({ status: 204 });
      }
      if (request.method() !== "GET" || id) return route.fallback();
      const response = await route.fetch();
      const rows = (await response.json()) as CompetitorItem[];
      return route.fulfill({
        response,
        json: rows.filter((row) => !removed.has(row.id)),
      });
    },
  );
}

const token = (id: string, name: string): ApiTokenItem => ({
  id,
  name,
  prefix: `asob_${id}`,
  scope: "read",
  expiresAt: null,
  expired: false,
  lastUsedAt: null,
  usageCount: 0,
  createdAt: "2026-10-01T00:00:00.000Z",
});

async function serveTokens(page: Page, rows: ApiTokenItem[]) {
  let listed = rows;
  await page.route(/\/api\/backend\/auth\/tokens(\/[^/]+)?$/, (route) => {
    const request = route.request();
    const id = /\/tokens\/([^/]+)$/.exec(request.url())?.[1];
    if (request.method() === "DELETE" && id) {
      listed = listed.filter((row) => row.id !== id);
      return route.fulfill({ status: 204 });
    }
    if (request.method() === "GET" && !id) {
      return route.fulfill({ json: listed });
    }
    return route.fallback();
  });
}

test.describe("removal dialogs return or hand on focus", () => {
  const competitorRemoves = (page: Page) =>
    page.getByRole("button", { name: /^Remove / });

  test("cancelling a competitor removal returns focus to its button", async ({
    page,
  }) => {
    await page.goto("/apps/app-1/competitors");
    const remove = competitorRemoves(page).first();

    await pressFromKeyboard(remove);
    await expect(page.getByRole("alertdialog")).toBeVisible();
    await page.keyboard.press("Escape");

    await expect(page.getByRole("alertdialog")).toBeHidden();
    await expect(remove).toBeFocused();
  });

  test("a confirmed competitor removal hands focus to the next card", async ({
    page,
  }) => {
    await seedCookie(page.context(), CROWDED_COMPETITORS_COOKIE);
    await removeCompetitorsInBrowser(page);
    await page.goto("/apps/app-1/competitors");
    const first = competitorRemoves(page).first();
    const removedName = (await first.getAttribute("aria-label")) ?? "";
    const nextName =
      (await competitorRemoves(page).nth(1).getAttribute("aria-label")) ?? "";

    await pressFromKeyboard(first);
    await confirmIn(page, "Remove");

    await expect(page.getByRole("button", { name: removedName })).toHaveCount(
      0,
    );
    await expect(page.getByRole("button", { name: nextName })).toBeFocused();
  });

  test("removing the last competitor hands focus to the competitor field", async ({
    page,
  }) => {
    await removeCompetitorsInBrowser(page);
    await page.goto("/apps/app-1/competitors");
    await expect(competitorRemoves(page)).toHaveCount(1);

    await pressFromKeyboard(competitorRemoves(page));
    await confirmIn(page, "Remove");

    await expect(competitorRemoves(page)).toHaveCount(0);
    await expect(
      page.getByRole("textbox", { name: "Competitor name or App Store URL" }),
    ).toBeFocused();
  });

  test("cancelling a token revoke returns focus to its button", async ({
    page,
  }) => {
    await serveTokens(page, [token("t1", "ci")]);
    await page.goto("/integrations");
    const revoke = page.getByRole("button", { name: "Revoke ci" });

    await pressFromKeyboard(revoke);
    await expect(page.getByRole("alertdialog")).toBeVisible();
    await page.keyboard.press("Escape");

    await expect(page.getByRole("alertdialog")).toBeHidden();
    await expect(revoke).toBeFocused();
  });

  test("Escape keeps the revoke dialog open until the revoke lands", async ({
    page,
  }) => {
    await serveTokens(page, [token("t1", "ci"), token("t2", "deploy")]);
    const held = await holdRequest(
      page,
      /\/api\/backend\/auth\/tokens\/[^/]+$/,
      "DELETE",
    );
    await page.goto("/integrations");

    await pressFromKeyboard(page.getByRole("button", { name: "Revoke ci" }));
    await confirmIn(page, "Revoke");
    await expect(page.getByRole("alertdialog")).toContainText("Revoking…");
    await page.keyboard.press("Escape");
    await expect(page.getByRole("alertdialog")).toHaveAttribute(
      "data-state",
      "open",
    );
    await expect(page.getByRole("alertdialog")).not.toHaveAttribute(
      "data-state",
      "closed",
      { timeout: 1000 },
    );
    held.release();

    await expect(page.getByRole("button", { name: "Revoke ci" })).toHaveCount(
      0,
    );
    await expect(
      page.getByRole("button", { name: "Revoke deploy" }),
    ).toBeFocused();
  });

  test("a revoke hands focus to the next token, then to New token", async ({
    page,
  }) => {
    await serveTokens(page, [token("t1", "ci"), token("t2", "deploy")]);
    await page.goto("/integrations");

    await pressFromKeyboard(page.getByRole("button", { name: "Revoke ci" }));
    await confirmIn(page, "Revoke");
    await expect(page.getByRole("button", { name: "Revoke ci" })).toHaveCount(
      0,
    );
    await expect(
      page.getByRole("button", { name: "Revoke deploy" }),
    ).toBeFocused();

    await pressFromKeyboard(
      page.getByRole("button", { name: "Revoke deploy" }),
    );
    await confirmIn(page, "Revoke");

    await expect(page.getByRole("button", { name: "New token" })).toBeFocused();
  });
});

test.describe("import app openers get focus back", () => {
  const importDialog = (page: Page) =>
    page.getByRole("dialog", { name: "Import an app" });

  test("the sidebar entry of a workspace with no app", async ({ page }) => {
    await page.route(/\/api\/backend\/apps$/, (route) =>
      route.request().method() === "GET"
        ? route.fulfill({ json: [] })
        : route.fallback(),
    );
    await page.goto("/settings");
    const entry = page
      .locator('[data-sidebar="sidebar"]')
      .getByRole("button", { name: "Import app" });

    await pressFromKeyboard(entry);
    await expect(importDialog(page)).toBeVisible();
    await page.keyboard.press("Escape");

    await expect(importDialog(page)).toBeHidden();
    await expect(entry).toBeFocused();
  });

  test("the switcher popover entry", async ({ page }) => {
    await page.goto("/apps/app-1");
    const switcher = page.getByRole("button", {
      name: /^Switch app, currently/,
    });

    await pressFromKeyboard(switcher);
    await page.getByRole("option", { name: "Import app", exact: true }).click();
    await expect(importDialog(page)).toBeVisible();
    await page.keyboard.press("Escape");

    await expect(importDialog(page)).toBeHidden();
    await expect(switcher).toBeFocused();
  });
});

test.describe("Track keeps focus", () => {
  const [, PLAY_MOVER] = APP_GP_SERP_MOVERS.items;
  const competitorsPath = `/api/backend/apps/${APP_GP_DETAIL.id}/competitors`;
  const moverTrack = (page: Page) =>
    page
      .getByRole("listitem")
      .filter({ hasText: PLAY_MOVER.title })
      .getByRole("button", { name: "Track" });

  test.beforeEach(({ request }) =>
    request.post(
      `http://localhost:4100/__reset/competitors/${APP_GP_DETAIL.id}`,
    ),
  );

  test("Track keeps focus while it adds a competitor", async ({ page }) => {
    const held = await holdRequest(
      page,
      new RegExp(`${competitorsPath}$`),
      "POST",
    );
    await page.goto(`/apps/${APP_GP_DETAIL.id}/rankings`);
    const track = moverTrack(page);

    await pressFromKeyboard(track);
    await becameInert(track);

    await expect(track).toBeFocused();
    await expectFocusKeptWhileHeld(track, held);
  });

  test("two activations of Track in one task send one add", async ({
    page,
  }) => {
    const adds: string[] = [];
    page.on("request", (request) => {
      if (
        request.method() === "POST" &&
        new URL(request.url()).pathname === competitorsPath
      ) {
        adds.push(request.url());
      }
    });
    await page.goto(`/apps/${APP_GP_DETAIL.id}/rankings`);

    await activateTwiceInOneTask(moverTrack(page));

    await expect(
      page.getByText(`Now tracking ${PLAY_MOVER.title}`).first(),
    ).toBeVisible();
    expect(adds).toHaveLength(1);
  });
});

test("the search results Track keeps focus while it adds and hands it to the store link", async ({
  page,
}) => {
  const held = await holdRequest(page, SERP_TRACK_PATH, "POST", answerTrack);
  await showTrackedAfterAdd(page);
  await page.goto("/apps/app-1/keywords?serp=kw-3");
  const row = page.locator("li#serp-row-12");
  const track = row.getByRole("button", { name: /^Track / });

  await pressFromKeyboard(track);
  await becameInert(track);
  await expect(track).toBeFocused();
  held.release();

  await expect(
    row.getByRole("link", { name: /^Open .* in the store$/ }),
  ).toBeFocused();
});

test.describe("captured day buttons", () => {
  const chartReads = (page: Page) => {
    const urls: string[] = [];
    page.on("request", (request) => {
      if (/\/api\/backend\/charts\?/.test(request.url())) {
        urls.push(request.url());
      }
    });
    return urls;
  };

  for (const { name, from, to } of [
    {
      name: "Previous captured day",
      from: TOP_CHART_DATES.at(-2) ?? "",
      to: TOP_CHART_DATES.at(-1) ?? "",
    },
    {
      name: "Next captured day",
      from: TOP_CHART_DATES[1],
      to: TOP_CHART_DATES[0],
    },
  ]) {
    test(`${name} keeps focus once it reaches the last captured day`, async ({
      page,
    }) => {
      await page.goto(`/charts?view=table&date=${from}`);
      const button = page.getByRole("button", { name, exact: true });

      await pressFromKeyboard(button);
      await expect(page).toHaveURL(new RegExp(`date=${to}`));
      await becameInert(button);
      await expect(button).toBeFocused();
      await expect(button).toHaveAttribute("aria-disabled", "true");

      const reads = chartReads(page);
      await page.keyboard.press("Enter");
      await expect(button).toBeFocused();
      await expect(page).toHaveURL(new RegExp(`date=${to}`));
      expect(reads).toEqual([]);
    });
  }
});

test("closing the search results sheet returns focus to the row that opened it", async ({
  page,
}) => {
  await page.goto("/apps/app-1/keywords");
  const opener = page.getByRole("button", {
    name: "View search results for focus timer",
    exact: true,
  });

  await pressFromKeyboard(opener);
  const sheet = page.getByRole("dialog", { name: "Search results" });
  await expect(sheet).toBeVisible();
  await page.keyboard.press("Escape");

  await expect(sheet).toBeHidden();
  await expect(opener).toBeFocused();
});

test("keyword import keeps focus on its button from one part to the next", async ({
  page,
}) => {
  const held = await holdRequest(
    page,
    /\/api\/backend\/apps\/app-import\/keywords\/import$/,
    "POST",
    (route) => route.continue({ url: `${route.request().url()}/preview` }),
  );
  await page.goto("/apps/app-import/keywords");
  await (
    await hydrated(page.getByRole("button", { name: "Import CSV" }).first())
  ).click();
  const dialog = page.getByRole("dialog", { name: "Import keywords from CSV" });
  const rows = Array.from({ length: 501 }, (_, index) => `focus part ${index}`);
  await dialog.getByLabel("Keyword file").setInputFiles({
    name: "parts.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(["keyword", ...rows].join("\n")),
  });
  const submit = dialog.getByRole("button", { name: /^Import(ing…| \d)/ });
  await expect(submit).toHaveAttribute("aria-disabled", "false");

  await pressFromKeyboard(submit);

  await expect(dialog.getByLabel("Keyword file")).toBeDisabled();
  await expect(
    dialog.getByRole("combobox", { name: "Keyword column" }),
  ).toBeDisabled();
  await expect(
    dialog.getByRole("switch", { name: "First row is a header" }),
  ).toBeDisabled();
  await expectFocusKeptWhileHeld(submit, held);
  await expect(dialog.getByLabel("Keyword file")).toBeEnabled();
  await expect(
    dialog.getByText("Part 2 holds lines 502 to 502."),
  ).toBeVisible();
  await expect(submit).toBeFocused();
});

test.describe("keyword bulk actions keep focus", () => {
  test.describe.configure({ mode: "serial" });

  const BULK = /\/api\/backend\/apps\/app-bulk-focus\/keywords\/bulk$/;
  const KEYWORDS = "/apps/app-bulk-focus/keywords";
  const bar = (page: Page) =>
    page.getByRole("group", { name: "Bulk keyword actions" });
  const selectAll = (page: Page) =>
    page.getByRole("checkbox", { name: "Select all keywords" });

  test.beforeEach(async ({ request }) => {
    await request.post(
      `http://localhost:${process.env.MOCK_API_PORT ?? 4100}/__reset/keywords/app-bulk-focus`,
      { failOnStatusCode: true },
    );
  });

  test("Pause keeps focus while it runs and hands it to the table", async ({
    page,
  }) => {
    const held = await holdRequest(page, BULK, "POST");
    await page.goto(KEYWORDS);
    await selectAll(page).check();
    const pause = bar(page).getByRole("button", { name: "Pause" });

    await pressFromKeyboard(pause);

    await expect(pause).toHaveAttribute("aria-disabled", "true");
    await expect(pause).not.toHaveAttribute("disabled");
    await expect(pause).toBeFocused();
    held.release();
    await expect(bar(page)).toHaveCount(0);
    await expect(selectAll(page)).toBeFocused();
  });

  test("a refused Activate keeps focus on its button", async ({
    page,
    context,
  }) => {
    await seedCookie(context, "e2e-bulk-over-quota");
    const held = await holdRequest(page, BULK, "POST");
    await page.goto(KEYWORDS);
    await selectAll(page).check();
    const activate = bar(page).getByRole("button", { name: "Activate" });

    await pressFromKeyboard(activate);
    await expect(activate).toHaveAttribute("aria-disabled", "true");
    await expect(activate).toBeFocused();
    held.release();

    await expect(activate).not.toHaveAttribute("aria-disabled", "true");
    await expect(activate).toBeFocused();
    await expect(bar(page)).toContainText("3 selected");
  });

  test("two activations of Pause in one task send one request", async ({
    page,
  }) => {
    let sent = 0;
    await page.route(BULK, (route) => {
      sent += 1;
      return route.fallback();
    });
    await page.goto(KEYWORDS);
    await selectAll(page).check();

    await activateTwiceInOneTask(
      bar(page).getByRole("button", { name: "Pause" }),
    );

    await expect(page.getByText("Paused 3 keywords")).toBeVisible();
    expect(sent).toBe(1);
  });

  test("the confirm button keeps focus while the removal runs", async ({
    page,
  }) => {
    const held = await holdRequest(page, BULK, "POST", (route) =>
      route.fulfill({
        status: 500,
        json: { statusCode: 500, message: "down", error: "Server Error" },
      }),
    );
    await page.goto(KEYWORDS);
    await selectAll(page).check();
    await pressFromKeyboard(
      bar(page).getByRole("button", { name: "Remove", exact: true }),
    );
    const confirm = page
      .getByRole("alertdialog")
      .getByRole("button", { name: /^(Stop tracking|Removing…)$/ });

    await pressFromKeyboard(confirm);
    await expect(confirm).toHaveText("Removing…");

    await expectFocusKeptWhileHeld(confirm, held);
    await expect(page.getByRole("alertdialog")).toBeVisible();
  });

  test("Escape keeps the removal dialog open until the request lands", async ({
    page,
  }) => {
    const held = await holdRequest(page, BULK, "POST");
    await page.goto(KEYWORDS);
    await page.getByRole("checkbox", { name: "Select focus timer" }).check();
    await pressFromKeyboard(
      bar(page).getByRole("button", { name: "Remove", exact: true }),
    );
    const confirm = page
      .getByRole("alertdialog")
      .getByRole("button", { name: /^(Stop tracking|Removing…)$/ });
    await pressFromKeyboard(confirm);
    await expect(confirm).toHaveText("Removing…");

    await page.keyboard.press("Escape");
    await expect(page.getByRole("alertdialog")).toBeVisible();

    held.release();
    await expect(page.getByRole("alertdialog")).toHaveCount(0);
    await expect(selectAll(page)).toBeFocused();
  });

  test("Tag stays focusable and does not open while a bulk request runs", async ({
    page,
  }) => {
    const held = await holdRequest(page, BULK, "POST");
    await page.goto(KEYWORDS);
    await selectAll(page).check();
    await pressFromKeyboard(bar(page).getByRole("button", { name: "Pause" }));
    const tag = bar(page).getByRole("button", { name: "Tag", exact: true });
    await expect(tag).toHaveAttribute("aria-disabled", "true");

    await pressFromKeyboard(tag);

    await expect(tag).toBeFocused();
    await expect(
      page.getByRole("dialog", { name: "Tag keywords" }),
    ).toHaveCount(0);
    held.release();
  });
});

test.describe("chart image controls keep focus", () => {
  const rankingsChart = (page: Page) =>
    page.getByRole("region", { name: "Keyword rank positions" });

  for (const name of [
    "Copy image of the rankings chart",
    "Download PNG of the rankings chart",
  ]) {
    test(`${name} keeps focus while the picture is drawn`, async ({ page }) => {
      const held = await holdRender(page);
      await page.goto("/apps/app-1/rankings");
      await expect(rankingsChart(page)).toBeVisible();
      const control = page.getByRole("button", { name, exact: true });

      await pressFromKeyboard(control);

      await expectFocusKeptWhileHeld(control, held);
    });
  }

  test("two activations of Download PNG in one task save one picture", async ({
    page,
  }) => {
    const saved: string[] = [];
    page.on("download", (file) => saved.push(file.suggestedFilename()));
    await page.goto("/apps/app-1/rankings");
    const control = page.getByRole("button", {
      name: "Download PNG of the rankings chart",
      exact: true,
    });

    await activateTwiceInOneTask(control);

    await expect.poll(() => saved.length).toBe(1);
    await expect(control).not.toHaveAttribute("aria-disabled", "true");
    expect(saved).toHaveLength(1);
  });

  test("the position history icon keeps focus while the picture is drawn", async ({
    page,
  }) => {
    const held = await holdRender(page);
    await page.goto("/apps/app-1/keywords");
    await (
      await hydrated(
        page.getByRole("button", { name: /^Position history: focus timer/ }),
      )
    ).click();
    const control = page.getByRole("button", {
      name: "Copy image of the position history of focus timer",
      exact: true,
    });

    await pressFromKeyboard(control);

    await expectFocusKeptWhileHeld(control, held);
  });
});

test.describe("the embedded checkout retry keeps focus", () => {
  test("keeps Try again focused while a retry runs and hands focus to the form", async ({
    page,
  }) => {
    await openEmbedded(page);
    await page.unroute("**/api/backend/billing/checkout");
    const refused = fulfillJson(409, {
      statusCode: 409,
      error: "Conflict",
      message: "A checkout is already being opened. Try again.",
      path: "/billing/checkout",
      timestamp: new Date().toISOString(),
    });
    const answers = [
      refused,
      refused,
      fulfillJson(200, {
        url: "http://localhost:3000/?checkout=complete",
        clientSecret: "cs_after_retry",
      }),
    ];
    const held: { release: () => void }[] = [];
    await page.route("**/api/backend/billing/checkout", async (route) => {
      const answer = answers.shift() ?? refused;
      if (answers.length < 2) {
        await new Promise<void>((resolve) => held.push({ release: resolve }));
      }
      await route.fulfill(answer);
    });

    await page.goto("/upgrade");
    const retry = page.getByRole("button", { name: "Try again" });
    await pressFromKeyboard(retry);
    await expect(retry).toHaveAttribute("aria-disabled", "true");
    await expect(retry).toBeFocused();
    const payment = page.getByRole("region", { name: "Payment" });
    await expect(payment.getByRole("status")).toHaveText("Opening checkout…");
    await expect(payment.getByRole("alert")).toHaveCount(0);
    await expect.poll(() => held.length).toBe(1);
    held[0].release();
    await expect(retry).not.toHaveAttribute("aria-disabled", "true");
    await expect(retry).toBeFocused();
    await expect(payment.getByRole("alert")).toHaveText(
      "A checkout is already being opened. Try again.",
    );

    await page.keyboard.press("Enter");
    await expect(retry).toHaveAttribute("aria-disabled", "true");
    await expect.poll(() => held.length).toBe(2);
    held[1].release();
    const form = page.getByRole("region", {
      name: "Stripe checkout for Indie, monthly",
    });
    await expect(form).toHaveAttribute("data-mounted", "cs_after_retry");
    await expect(form).toBeFocused();
  });
});

test("Load more keeps focus while the next alerts load and hands it to the end", async ({
  page,
}) => {
  const held = await holdRequest(
    page,
    /\/api\/backend\/alerts\/events\?.*cursor=/,
    "GET",
  );
  await page.goto("/alerts");
  const loadMore = page.getByRole("button", { name: "Load more" });

  await pressFromKeyboard(loadMore);

  await expect(loadMore).toHaveAttribute("aria-disabled", "true");
  await expect(loadMore).not.toHaveAttribute("disabled");
  await expect(loadMore).toBeFocused();
  held.release();
  await expect(page.locator('[data-slot="feed-end"]')).toBeFocused();
});

test.describe("the keyword breakdown returns focus to the button that opened it", () => {
  const openerOf = (page: Page, table: RegExp) =>
    page
      .getByRole("table", { name: table })
      .getByRole("button", { name: "pomodoro, why apps rank" })
      .first();

  for (const [where, table] of [
    ["a gap row", /^Keyword/],
    ["the matrix", /compared with each tracked competitor/],
  ] as const) {
    test(`from ${where}`, async ({ page }) => {
      await page.goto("/apps/app-1/competitors?gaps=threats");
      await page.waitForLoadState("networkidle");
      const opener = openerOf(page, table);

      await opener.focus();
      await page.keyboard.press("Enter");
      await expect(
        page.getByRole("dialog", { name: "Why apps rank for this keyword" }),
      ).toBeVisible();
      await page.keyboard.press("Escape");

      await expect(opener).toBeFocused();
    });
  }
});

test("hiding the checklist keeps focus on the confirm action while it saves", async ({
  page,
  context,
}) => {
  await seedChecklist(context, "partial");
  await page.goto("/apps/app-1");
  await (
    await hydrated(
      page.getByRole("button", { name: /done in the setup checklist$/ }),
    )
  ).click();
  await page
    .getByRole("dialog", { name: "Setup checklist" })
    .getByRole("button", { name: "Hide checklist" })
    .click();
  const confirm = page
    .getByRole("alertdialog")
    .getByRole("button", { name: /^(Hide checklist|Hiding…)$/ });
  const held = await holdRequest(page, /\/workspace\/checklist$/, "PATCH");

  await pressFromKeyboard(confirm);
  await expect(confirm).toHaveAttribute("aria-disabled", "true");
  await expect(confirm).toBeFocused();
  held.release();

  await expect(page.locator("#main-content")).toBeFocused();
});

test("the checklist switch keeps focus while it saves", async ({
  page,
  context,
}) => {
  await seedChecklist(context, "partial");
  await page.goto("/settings");
  const toggle = page.getByRole("switch", { name: "Show the setup checklist" });
  const held = await holdRequest(page, /\/workspace\/checklist$/, "PATCH");

  await (await hydrated(toggle)).focus();
  await page.keyboard.press("Space");

  await expectFocusKeptWhileHeld(toggle, held);
});

test("a goal keeps focus while its save runs", async ({ page, context }) => {
  await startedSetup(context, "app-1");
  await seedChecklist(context, "partial");
  await page.goto("/apps/app-1/setup");
  const research = page
    .getByRole("group", { name: "What would you like to get done?" })
    .getByRole("button", { name: /^Research an idea/ });
  const held = await holdRequest(page, /\/workspace\/checklist$/, "PATCH");

  await pressFromKeyboard(research);

  await expectFocusKeptWhileHeld(research, held);
});

test.describe("keyword discovery controls keep focus", () => {
  test.describe.configure({ mode: "serial" });

  const discovered = (state = "") =>
    `/apps/${DISCOVERY_FOCUS_APP}/keywords?tab=discovered${state}`;
  const write = (action: string) =>
    new RegExp(
      `/api/backend/apps/${DISCOVERY_FOCUS_APP}/keyword-discoveries/${action}$`,
    );

  test.beforeEach(({ request }) =>
    request.post(
      `${MOCK_API_URL}/__reset/keyword-discoveries/${DISCOVERY_FOCUS_APP}`,
      { failOnStatusCode: true },
    ),
  );

  test("Refresh keeps focus while its request runs", async ({ page }) => {
    const held = await holdRequest(page, write("refresh"), "POST");
    await page.goto(discovered());
    const refresh = page.getByRole("button", {
      name: "Refresh discoveries",
    });

    await pressFromKeyboard(refresh);

    await expectFocusKeptWhileHeld(refresh, held);
  });

  test("Auto-track ranked keeps focus while its request runs", async ({
    page,
  }) => {
    const held = await holdRequest(page, write("settings"), "PATCH");
    await page.goto(discovered());
    const toggle = page.getByRole("switch", { name: "Auto-track ranked" });

    await pressFromKeyboard(toggle);

    await expectFocusKeptWhileHeld(toggle, held);
  });

  for (const name of ["Track recommended", "Track all ranked"]) {
    test(`${name} keeps focus while its request runs`, async ({ page }) => {
      const held = await holdRequest(page, write("track"), "POST");
      await page.goto(discovered());
      const bulk = page.getByRole("button", { name: new RegExp(`^${name}`) });

      await pressFromKeyboard(bulk);

      await expect(bulk).toHaveAttribute("aria-disabled", "true");
      await expect(bulk).toBeFocused();
      held.release();
      await page.waitForLoadState("networkidle");
      await expect(bulk).toBeFocused();
    });
  }

  for (const action of ["Track", "Dismiss"]) {
    test(`${action} hands focus to the next row once its row leaves`, async ({
      page,
    }) => {
      const held = await holdRequest(
        page,
        write(action === "Track" ? "track" : "dismiss"),
        "POST",
      );
      await page.goto(discovered());
      const leaving = page.getByRole("button", {
        name: `${action} pomodoro clock`,
        exact: true,
      });

      await pressFromKeyboard(leaving);

      await expect(leaving).toHaveAttribute("aria-disabled", "true");
      await expect(leaving).toBeFocused();
      held.release();
      await expect(
        page.getByRole("button", { name: `${action} deep work`, exact: true }),
      ).toBeFocused();
    });
  }

  test("the last row hands focus to the panel heading", async ({ page }) => {
    await page.goto(discovered("&state=opportunity"));

    await pressFromKeyboard(
      page.getByRole("button", { name: "Dismiss study planner", exact: true }),
    );

    await expect(
      page.getByRole("heading", { name: "Discovered keywords" }),
    ).toBeFocused();
  });
});
