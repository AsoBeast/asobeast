import type { BrowserContext, Page } from "@playwright/test";
import type {
  ApiTokenItem,
  CompetitorItem,
  WebhookItem,
} from "@asobeast/shared";
import { holdRender } from "./chart-image.mts";
import {
  AWAITING_ALERT_COOKIE,
  CROWDED_COMPETITORS_COOKIE,
  WEBHOOK_PAIR,
  WEBHOOK_PAIR_COOKIE,
} from "./fixtures.mts";
import {
  expectFocusKeptWhileHeld,
  holdRequest,
  pressFromKeyboard,
} from "./held-request.mts";
import { activateTwiceInOneTask, hydrated } from "./hydrated.mts";
import { expect, test } from "./session.mts";
import { STORE_CONNECTION_COOKIE } from "./store-connections.mts";

const seedCookie = (context: BrowserContext, name: string, value = "1") =>
  context.addCookies([{ name, value, domain: "localhost", path: "/" }]);

const confirmIn = (page: Page, name: string) =>
  page
    .getByRole("alertdialog")
    .getByRole("button", { name, exact: true })
    .press("Enter");

const storeConnections = (page: Page) =>
  page.getByRole("region", { name: "Store connections" });

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

test("closing the top 10 sheet returns focus to the row that opened it", async ({
  page,
}) => {
  await page.goto("/apps/app-1/keywords");
  const opener = page.getByRole("button", {
    name: "View top 10 for focus timer",
    exact: true,
  });

  await pressFromKeyboard(opener);
  const sheet = page.getByRole("dialog", { name: "Top 10 search results" });
  await expect(sheet).toBeVisible();
  await page.keyboard.press("Escape");

  await expect(sheet).toBeHidden();
  await expect(opener).toBeFocused();
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
