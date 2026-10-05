import { type Page } from "@playwright/test";
import {
  PLAN_LIMITS,
  SELF_HOSTED_LIMITS,
  UPGRADE_PATH,
  type AccountPlan,
  type ActionExplanation,
  type AiCallUsage,
  type ApiErrorEnvelope,
} from "@asobeast/shared";
import { fulfillJson, routePlan, seedSession } from "./plan-helpers.mts";
import { expect, test } from "./reporting.mts";

const RESETS_AT = "2026-11-01T00:00:00.000Z";

const indiePlan = (aiCalls: AiCallUsage): AccountPlan => ({
  plan: "indie",
  displayName: "Indie",
  billing: true,
  entitled: true,
  hasBillingAccount: true,
  subscribed: false,
  cancelAtPeriodEnd: false,
  trialEndsAt: null,
  renewsAt: "2026-11-09T00:00:00.000Z",
  upgradeTo: "ultimate",
  upgradePath: UPGRADE_PATH,
  limits: PLAN_LIMITS.indie,
  usage: {
    apps: { used: 3, limit: PLAN_LIMITS.indie.apps },
    keywordMarkets: { used: 240, limit: PLAN_LIMITS.indie.keywordMarkets },
    aiCalls,
  },
});

async function openWithBilling(page: Page, plan: AccountPlan) {
  await seedSession(page);
  await page
    .context()
    .addCookies([
      { name: "e2e_billing", value: "1", domain: "localhost", path: "/" },
    ]);
  await routePlan(page, plan);
}

test("shows the month's ai calls and their renewal on the plan card", async ({
  page,
}) => {
  await openWithBilling(
    page,
    indiePlan({ used: 37, limit: 200, resetsAt: RESETS_AT }),
  );

  await page.goto("/settings");

  const plan = page.getByRole("region", { name: "Plan" });
  await expect(plan.getByText("AI calls this month")).toBeVisible();
  await expect(plan.getByText("37 of 200")).toBeVisible();
  await expect(plan.getByText("Renews Nov 1, 2026")).toBeVisible();
  await expect(plan.locator('[data-slot="meter"]')).toHaveCount(3);
});

test("promises no renewal on the plan card when no ai calls are included", async ({
  page,
}) => {
  await openWithBilling(
    page,
    indiePlan({ used: 4, limit: 0, resetsAt: RESETS_AT }),
  );

  await page.goto("/settings");

  const plan = page.getByRole("region", { name: "Plan" });
  await expect(plan.getByText("AI calls this month")).toBeVisible();
  await expect(plan.getByText("Renews Nov 1, 2026")).toHaveCount(0);
});

test("lists the ai calls of each plan on the upgrade page", async ({
  page,
}) => {
  await openWithBilling(
    page,
    indiePlan({ used: 37, limit: 200, resetsAt: RESETS_AT }),
  );

  await page.goto("/upgrade");

  const rows = page
    .getByRole("term")
    .filter({ hasText: "AI calls per month" })
    .locator("xpath=..")
    .getByRole("definition");
  await expect(rows).toHaveText(["200", "2,000"]);
});

const ACTION_TITLE = 'Add "habit tracker" to your metadata';
const SPENT_HINT = "AI calls used up. Renews Nov 1, 2026";

const EXPLANATION: ActionExplanation = {
  explanation: "Your title is missing the keyword.",
  model: "gpt-test",
  generatedAt: "2026-10-17T10:00:00.000Z",
};

const REFUSAL: ApiErrorEnvelope = {
  statusCode: 429,
  error: "Too Many Requests",
  message: "The monthly AI allowance is spent.",
  path: "/actions/act-uncovered/explain",
  timestamp: "2026-10-17T10:00:00.000Z",
  aiAllowance: {
    plan: "indie",
    limit: 200,
    used: 200,
    resetsAt: RESETS_AT,
    upgradeTo: "ultimate",
  },
  retryAfterSeconds: 1_260_000,
};

const selfHostedPlan: AccountPlan = {
  ...indiePlan({ used: 4, limit: null, resetsAt: RESETS_AT }),
  billing: false,
  limits: SELF_HOSTED_LIMITS,
};

async function enableAi(page: Page) {
  await page
    .context()
    .addCookies([
      { name: "e2e_metadata_ai", value: "1", domain: "localhost", path: "/" },
    ]);
  await page.route("**/api/backend/actions/ai-status", (route) =>
    route.fulfill(fulfillJson(200, { configured: true, model: "gpt-test" })),
  );
}

async function routeExplain(page: Page, status: number, body: unknown) {
  const requests: string[] = [];
  await page.route("**/api/backend/actions/*/explain", async (route) => {
    requests.push(route.request().url());
    await route.fulfill(fulfillJson(status, body));
  });
  return requests;
}

async function openAction(page: Page) {
  await page.goto("/actions");
  await page.getByRole("link", { name: ACTION_TITLE }).first().click();
  return page.getByRole("dialog");
}

async function openWithPlan(page: Page, plan: AccountPlan) {
  await seedSession(page);
  await enableAi(page);
  await routePlan(page, plan);
}

test("explains a refused explanation and offers the plans without leaving the page", async ({
  page,
}) => {
  await openWithPlan(
    page,
    indiePlan({ used: 199, limit: 200, resetsAt: RESETS_AT }),
  );
  const requests = await routeExplain(page, 429, REFUSAL);

  const sheet = await openAction(page);
  const url = page.url();
  await sheet.getByRole("button", { name: "Explain" }).click();

  await expect(
    page.getByText(
      "This workspace has used the 200 AI calls its plan includes this month. Renews Nov 1, 2026.",
    ),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "See plans" })).toBeVisible();
  expect(page.url()).toBe(url);
  expect(requests).toHaveLength(1);

  await page.getByRole("button", { name: "See plans" }).click();
  await expect(page).toHaveURL(/\/upgrade$/);
});

test("disables every ai button once the allowance is spent", async ({
  page,
}) => {
  await openWithPlan(
    page,
    indiePlan({ used: 200, limit: 200, resetsAt: RESETS_AT }),
  );

  const sheet = await openAction(page);
  await expect(sheet.getByRole("button", { name: "Explain" })).toBeDisabled();
  await expect(sheet.getByText(SPENT_HINT)).toBeVisible();

  await page.goto("/apps/app-1/metadata");
  await expect(
    page.getByRole("button", { name: "Generate drafts" }),
  ).toBeDisabled();
  await expect(page.getByText(SPENT_HINT)).toBeVisible();

  await page.goto("/apps/app-gp/audit");
  const panel = page.getByRole("region", { name: "AI creative analysis" });
  await expect(
    panel.getByRole("button", { name: "Analyze creative" }),
  ).toBeDisabled();
  await expect(panel.getByText(SPENT_HINT)).toBeVisible();
});

test("shows the calls left beside ai buttons only when a limit applies", async ({
  page,
}) => {
  const left = "163 of 200 AI calls left this month";
  await openWithPlan(
    page,
    indiePlan({ used: 37, limit: 200, resetsAt: RESETS_AT }),
  );

  const sheet = await openAction(page);
  await expect(sheet.getByText(left)).toBeVisible();
  await page.goto("/apps/app-1/metadata");
  await expect(page.getByText(left)).toBeVisible();
  await page.goto("/apps/app-gp/audit");
  await expect(
    page.getByRole("region", { name: "AI creative analysis" }).getByText(left),
  ).toBeVisible();

  await page.unroute("**/api/backend/auth/plan");
  await routePlan(page, selfHostedPlan);
  await page.goto("/apps/app-1/metadata");
  await expect(
    page.getByRole("button", { name: "Generate drafts" }),
  ).toBeEnabled();
  await expect(page.getByText(/AI calls left this month/)).toHaveCount(0);
});

test("refreshes the meter after an ai call", async ({ page }) => {
  await openWithPlan(
    page,
    indiePlan({ used: 37, limit: 200, resetsAt: RESETS_AT }),
  );
  await routeExplain(page, 200, EXPLANATION);
  const sheet = await openAction(page);
  await expect(
    sheet.getByText("163 of 200 AI calls left this month"),
  ).toBeVisible();

  let planRequests = 0;
  page.on("request", (request) => {
    if (request.url().endsWith("/api/backend/auth/plan")) planRequests += 1;
  });
  await sheet.getByRole("button", { name: "Explain" }).click();

  await expect(sheet.getByText(EXPLANATION.explanation)).toBeVisible();
  await expect.poll(() => planRequests).toBeGreaterThan(0);
});
