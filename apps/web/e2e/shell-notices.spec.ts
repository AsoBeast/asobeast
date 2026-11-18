import type { Page } from "@playwright/test";
import type { AuthUser } from "@asobeast/shared";
import { hydrated } from "./hydrated.mts";
import { fulfillJson } from "./plan-helpers.mts";
import { expect, test } from "./session.mts";
import {
  CHECKLIST_FAIL_COOKIE,
  seedChecklist,
} from "./workspace-checklist.mts";

const DAY_MS = 24 * 60 * 60 * 1000;

const daysFromNow = (days: number) =>
  new Date(Date.now() + days * DAY_MS - 60_000).toISOString();

const OWNER: AuthUser = {
  id: "u1",
  email: "owner@example.com",
  emailVerified: true,
  name: "Owner",
  role: "owner",
  plan: "indie",
  trialEndsAt: null,
  planExpiresAt: null,
  entitled: true,
  platformOperator: false,
};

async function openAs(page: Page, user: AuthUser) {
  await page.route("**/api/backend/auth/status", (route) =>
    route.fulfill(
      fulfillJson(200, {
        billing: true,
        registrationOpen: false,
        setupRequired: false,
        authenticated: true,
      }),
    ),
  );
  await page.route("**/api/backend/auth/me", (route) =>
    route.fulfill(fulfillJson(200, user)),
  );
  await page.goto("/");
}

const accountBar = (page: Page, text: RegExp) =>
  page.locator('[data-slot="account-bar"]').filter({ hasText: text });

const transparent = "rgba(0, 0, 0, 0)";

async function surfaceOf(page: Page): Promise<string> {
  return page.evaluate(() => {
    const probe = document.createElement("div");
    probe.className = "bg-card";
    document.body.append(probe);
    const colour = getComputedStyle(probe).backgroundColor;
    probe.remove();
    return colour;
  });
}

test.describe("account bars", () => {
  test("a trial with days to spare is a neutral bar with its action after the sentence", async ({
    page,
  }) => {
    await openAs(page, { ...OWNER, plan: "free", trialEndsAt: daysFromNow(5) });

    const bar = accountBar(page, /Trial ends in 5 days/);
    await expect(bar).toBeVisible();
    await expect(bar).toHaveAttribute("data-tone", "neutral");
    await expect(bar).toHaveCSS("background-color", await surfaceOf(page));
    const sentence = bar.getByText(/Trial ends in 5 days/);
    const action = bar.getByRole("link", { name: "Upgrade" });
    await expect(action).toHaveAttribute("href", "/upgrade");
    const [text, link] = await Promise.all([
      sentence.boundingBox(),
      action.boundingBox(),
    ]);
    expect(link!.x - (text!.x + text!.width)).toBeLessThan(16);
  });

  test("a trial in its last three days turns to the warning tone", async ({
    page,
  }) => {
    await openAs(page, { ...OWNER, plan: "free", trialEndsAt: daysFromNow(3) });

    await expect(accountBar(page, /Trial ends in 3 days/)).toHaveAttribute(
      "data-tone",
      "warning",
    );
  });

  test("a paused workspace is a warning bar that offers the plans", async ({
    page,
  }) => {
    await openAs(page, { ...OWNER, plan: "free", entitled: false });

    const bar = accountBar(page, /Collection is paused/);
    await expect(bar).toHaveAttribute("data-tone", "warning");
    await expect(
      bar.getByRole("link", { name: "Choose a plan" }),
    ).toBeVisible();
  });

  test("a suspended workspace is a critical bar on the surface, with ink text", async ({
    page,
  }) => {
    await openAs(page, {
      ...OWNER,
      suspendedAt: "2026-10-01T10:00:00.000Z",
      suspendedReason: "scraping the service",
    });

    const bar = accountBar(page, /This workspace is suspended/);
    await expect(bar).toHaveAttribute("data-tone", "critical");
    await expect(bar).toHaveCSS("background-color", await surfaceOf(page));
    const ink = await page.evaluate(
      () => getComputedStyle(document.body).color,
    );
    await expect(bar.getByText(/This workspace is suspended/)).toHaveCSS(
      "color",
      ink,
    );
  });
});

test("a store breakage is announced as an alert on the surface with its link", async ({
  page,
  context,
}) => {
  await context.addCookies([
    { name: "e2e_store_broken", value: "1", domain: "localhost", path: "/" },
  ]);
  await page.goto("/");

  const notice = page
    .getByRole("alert")
    .filter({ hasText: "parsing looks broken" });
  await expect(notice).toBeVisible();
  await expect(notice).toHaveAttribute("data-tone", "critical");
  await expect(notice).toHaveCSS("background-color", await surfaceOf(page));
  expect(await surfaceOf(page)).not.toBe(transparent);
  await expect(
    notice.getByRole("link", { name: "What happens next" }),
  ).toHaveAttribute("target", "_blank");
});

test("the page that is not found keeps the header and the theme control", async ({
  page,
}) => {
  await page.goto("/nonexistent-route");

  const header = page.getByRole("banner");
  await expect(header.getByRole("link", { name: "AsoBeast" })).toHaveAttribute(
    "href",
    "/",
  );
  await expect(header.getByRole("button")).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 1, name: "Page not found" }),
  ).toBeVisible();
});

test("the account menu names the plan as text under the email", async ({
  page,
}) => {
  await page.goto("/");
  await (
    await hydrated(page.getByRole("button", { name: "Account menu" }))
  ).click();

  const menu = page.getByRole("menu");
  await expect(menu.getByText("owner@example.com")).toBeVisible();
  await expect(menu.locator('[data-slot="account-plan"]')).toHaveText(
    /^\S.* plan$/,
  );
  await expect(menu.locator('[data-slot="badge"]')).toHaveCount(0);
});

test.describe("toasts", () => {
  const pill = (page: Page) =>
    page.getByRole("button", { name: /done in the setup checklist$/ });
  const toast = (page: Page, text: string) =>
    page.locator("[data-sonner-toast]").filter({ hasText: text });

  async function hideChecklist(page: Page) {
    await page.goto("/");
    await (await hydrated(pill(page))).click();
    await page.getByRole("button", { name: "Hide checklist" }).click();
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: "Hide checklist" })
      .click();
  }

  test("an error toast sits above the checklist pill and can be dismissed", async ({
    page,
    context,
  }) => {
    await seedChecklist(context, "partial");
    await context.addCookies([
      {
        name: CHECKLIST_FAIL_COOKIE,
        value: "1",
        domain: "localhost",
        path: "/",
      },
    ]);
    await hideChecklist(page);

    const failed = toast(page, "Could not hide the setup checklist");
    await expect(failed).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("alertdialog")).toBeHidden();
    await expect(pill(page)).toBeVisible();
    await expect
      .poll(async () => {
        const [toastBox, pillBox] = await Promise.all([
          failed.boundingBox(),
          pill(page).boundingBox(),
        ]);
        return toastBox && pillBox
          ? toastBox.y + toastBox.height <= pillBox.y
          : false;
      })
      .toBe(true);

    await failed.getByRole("button", { name: "Dismiss" }).click();
    await expect(failed).toHaveCount(0);
  });

  test("a success toast carries no dismiss control", async ({
    page,
    context,
  }) => {
    await seedChecklist(context, "partial");
    await hideChecklist(page);

    const hidden = toast(page, "Setup checklist hidden");
    await expect(hidden).toBeVisible();
    await expect(hidden.getByRole("button", { name: "Dismiss" })).toBeHidden();
  });
});
