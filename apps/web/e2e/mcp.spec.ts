import type { Page } from "@playwright/test";
import type { ApiTokenItem, AuthStatus, AuthUser } from "@asobeast/shared";
import { expect, test } from "./session.mts";

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

const TOKEN = `asob_${"a".repeat(48)}`;

function fulfillJson(status: number, body: unknown) {
  return {
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  };
}

async function routeStatus(page: Page, status: AuthStatus) {
  await page.route("**/api/backend/auth/status", (route) =>
    route.fulfill(fulfillJson(200, status)),
  );
}

test("mcp card mints a token and shows both connect snippets", async ({
  page,
}) => {
  await routeStatus(page, {
    billing: false,
    registrationOpen: false,
    setupRequired: false,
    authenticated: true,
  });
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

  await page.goto("/settings");
  await expect(page.getByText("MCP server", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Connect an agent" }).click();
  await page.getByLabel("Token name").fill("Claude Desktop");
  await page.getByRole("button", { name: "Mint token" }).click();

  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("Claude Code", { exact: true })).toBeVisible();
  await expect(
    dialog.getByText("Claude Desktop config", { exact: true }),
  ).toBeVisible();
  await expect(
    dialog.getByText(`--header "Authorization: Bearer ${TOKEN}"`),
  ).toBeVisible();
  await expect(
    dialog.getByText('"url": "http://localhost:3000/api/backend/mcp"'),
  ).toBeVisible();

  await dialog.getByRole("tab", { name: "Local server" }).click();
  await expect(
    dialog.getByText(`--env ASOBEAST_API_TOKEN=${TOKEN}`),
  ).toBeVisible();
  await expect(
    dialog.getByText(`"ASOBEAST_API_TOKEN": "${TOKEN}"`),
  ).toBeVisible();
  await expect(
    dialog.getByText("ASOBEAST_API_URL=http://localhost:3000/api/backend"),
  ).toBeVisible();
});
