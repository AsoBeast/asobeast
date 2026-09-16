import type { Page } from "@playwright/test";
import type { ApiTokenItem, AuthStatus, AuthUser } from "@asobeast/shared";
import { hostedSnippets, snippetById } from "../src/lib/mcp-snippets";
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
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
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
  const agent = dialog.getByRole("combobox", { name: "Agent" });

  async function chooseAgent(name: string) {
    await agent.click();
    await page.getByRole("option", { name, exact: true }).click();
  }

  for (const label of ["Claude Code", "Claude Code JSON", "Shared .mcp.json"]) {
    await expect(
      dialog.getByRole("button", { name: `Copy ${label}`, exact: true }),
    ).toBeVisible();
  }
  await expect(
    dialog.getByText(/^claude mcp add --transport http/),
  ).toBeVisible();
  await expect(
    dialog.getByText(`--header "Authorization: Bearer ${TOKEN}"`),
  ).toBeVisible();
  await expect(
    dialog.getByText(/^\.mcp\.json in the project root/),
  ).toBeVisible();
  await expect(
    dialog.getByText(/"url": "http:\/\/localhost:3000\/api\/backend\/mcp"/),
  ).toBeVisible();

  await chooseAgent("Claude Desktop");
  await expect(
    dialog.getByText(/^claude_desktop_config\.json \(Settings/),
  ).toBeVisible();
  await expect(dialog.getByText(/"mcp-remote@0\.14\.2"/)).toBeVisible();
  await expect(
    dialog.getByText(/"Authorization:\$\{ASOBEAST_AUTH_HEADER\}"/),
  ).toBeVisible();
  await expect(dialog.getByText(/^claude mcp add/)).toHaveCount(0);

  await dialog.getByRole("button", { name: "Copy Claude Desktop" }).click();
  await expect
    .poll(() => page.evaluate(() => navigator.clipboard.readText()))
    .toBe(
      snippetById(
        hostedSnippets(TOKEN, "http://localhost:3000"),
        "claude-desktop",
      ).value,
    );

  await chooseAgent("Other");
  await expect(dialog.getByText(/Streamable HTTP/)).toBeVisible();

  await chooseAgent("Claude Code");
  await expect(
    dialog.getByText(/^claude mcp add --transport http/),
  ).toBeVisible();

  await dialog.getByRole("tab", { name: "Local server" }).click();
  await expect(
    dialog.getByText(`--env ASOBEAST_API_TOKEN=${TOKEN}`),
  ).toBeVisible();
  await expect(
    dialog.getByText("ASOBEAST_API_URL=http://localhost:3000/api/backend"),
  ).toBeVisible();
  await chooseAgent("Claude Desktop");
  await expect(
    dialog.getByText(`"ASOBEAST_API_TOKEN": "${TOKEN}"`),
  ).toBeVisible();
});
