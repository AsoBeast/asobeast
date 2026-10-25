import type { BrowserContext, Page } from "@playwright/test";
import type { WebhookItem } from "@asobeast/shared";
import {
  AWAITING_ALERT_COOKIE,
  WEBHOOK_PAIR,
  WEBHOOK_PAIR_COOKIE,
} from "./fixtures.mts";
import {
  expectFocusKeptWhileHeld,
  holdRequest,
  pressFromKeyboard,
} from "./held-request.mts";
import { activateTwiceInOneTask } from "./hydrated.mts";
import { expect, test } from "./session.mts";
import { STORE_CONNECTION_COOKIE } from "./store-connections.mts";

const seedCookie = (context: BrowserContext, name: string, value = "1") =>
  context.addCookies([{ name, value, domain: "localhost", path: "/" }]);

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

    await activateTwiceInOneTask(
      webhookList(page).getByRole("button", { name: "Send test" }).first(),
    );

    await expect.poll(() => posts.length).toBe(1);
    await page.waitForTimeout(300);
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
    await page.waitForTimeout(300);
    expect(posts).toHaveLength(1);
  });
});
