import type { Locator, Page } from "@playwright/test";
import type { ApiTokenItem, AuthStatus, AuthUser } from "@asobeast/shared";
import { expect, test } from "./session.mts";

const SHORT_VIEWPORTS = [
  { width: 1280, height: 560 },
  { width: 375, height: 480 },
] as const;

const USER: AuthUser = {
  id: "u1",
  email: "owner@example.com",
  emailVerified: true,
  name: "Owner",
  role: "owner",
  plan: "premium",
  trialEndsAt: null,
  planExpiresAt: null,
  entitled: true,
  platformOperator: false,
};

const STATUS: AuthStatus = {
  billing: false,
  registrationOpen: false,
  setupRequired: false,
  authenticated: true,
};

const TOKEN = `asob_${"a".repeat(48)}`;

function fulfillJson(status: number, body: unknown) {
  return {
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  };
}

async function routeAuthenticatedSettings(page: Page) {
  await page.route("**/api/backend/auth/status", (route) =>
    route.fulfill(fulfillJson(200, STATUS)),
  );
  await page.route("**/api/backend/auth/me", (route) =>
    route.fulfill(fulfillJson(200, USER)),
  );

  let tokens: ApiTokenItem[] = [];
  await page.route("**/api/backend/auth/tokens", (route) => {
    if (route.request().method() === "POST") {
      const item: ApiTokenItem = {
        id: "t1",
        name: "Claude Desktop",
        prefix: "asob_aaaaaaa",
        scope: "read",
        expiresAt: null,
        expired: false,
        lastUsedAt: null,
        usageCount: 0,
        createdAt: new Date().toISOString(),
      };
      tokens = [item];
      return route.fulfill(fulfillJson(201, { ...item, token: TOKEN }));
    }
    return route.fulfill(fulfillJson(200, tokens));
  });
}

async function expectFitsViewport(page: Page, dialog: Locator) {
  const viewport = page.viewportSize();
  if (viewport === null) throw new Error("viewport size is unavailable");

  const box = await dialog.boundingBox();
  if (box === null) throw new Error("the dialog has no layout box");

  expect(
    box.y,
    "the dialog must not extend above the viewport",
  ).toBeGreaterThan(-1);
  expect(
    box.y + box.height,
    "the dialog must not extend below the viewport",
  ).toBeLessThan(viewport.height + 1);
  expect(
    box.x,
    "the dialog must not extend past the left edge",
  ).toBeGreaterThan(-1);
  expect(
    box.x + box.width,
    "the dialog must not extend past the right edge",
  ).toBeLessThan(viewport.width + 1);
}

async function expectContains(outer: Locator, inner: Locator) {
  const outerBox = await outer.boundingBox();
  const innerBox = await inner.boundingBox();
  if (outerBox === null || innerBox === null) {
    throw new Error("an element has no layout box");
  }

  expect(innerBox.y, "content must start inside the dialog").toBeGreaterThan(
    outerBox.y - 1,
  );
  expect(
    innerBox.y + innerBox.height,
    "content must end inside the dialog",
  ).toBeLessThan(outerBox.y + outerBox.height + 1);
  expect(
    innerBox.x,
    "content must stay inside the left edge of the dialog",
  ).toBeGreaterThan(outerBox.x - 1);
  expect(
    innerBox.x + innerBox.width,
    "content must stay inside the right edge of the dialog",
  ).toBeLessThan(outerBox.x + outerBox.width + 1);
}

for (const viewport of SHORT_VIEWPORTS) {
  test(`the mcp connect snippets stay inside the modal at ${viewport.width}x${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await routeAuthenticatedSettings(page);
    await page.goto("/settings");

    await page.getByRole("button", { name: "Connect an agent" }).click();
    await page.getByLabel("Token name").fill("Claude Desktop");
    await page.getByRole("button", { name: "Mint token" }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("button", { name: "Done" })).toBeVisible();
    await expectFitsViewport(page, dialog);

    const snippet = dialog.getByText(
      `--header "Authorization: Bearer ${TOKEN}"`,
    );
    await snippet.scrollIntoViewIfNeeded();
    await expectContains(dialog, snippet);

    const config = dialog.getByText(
      '"url": "http://localhost:3000/api/backend/mcp"',
    );
    await config.scrollIntoViewIfNeeded();
    await expectContains(dialog, config);
    await expectFitsViewport(page, dialog);
  });

  test(`the token form keeps its actions reachable at ${viewport.width}x${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await routeAuthenticatedSettings(page);
    await page.goto("/settings");

    await page.getByRole("button", { name: "New token" }).click();

    const dialog = page.getByRole("dialog");
    await expect(
      dialog.getByRole("button", { name: "Create token" }),
    ).toBeInViewport();
    await expectFitsViewport(page, dialog);
  });
}
