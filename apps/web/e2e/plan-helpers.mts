import { type Page } from "@playwright/test";
import { SESSION_COOKIE, type AccountPlan } from "@asobeast/shared";

export function fulfillJson(status: number, body: unknown) {
  return {
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  };
}

export async function seedSession(page: Page) {
  await page
    .context()
    .addCookies([
      { name: SESSION_COOKIE, value: "e2e", domain: "localhost", path: "/" },
    ]);
}

export async function seedPlan(page: Page, plan: AccountPlan) {
  await page.context().addCookies([
    {
      name: "e2e_plan",
      value: Buffer.from(JSON.stringify(plan)).toString("base64url"),
      domain: "localhost",
      path: "/",
    },
  ]);
}

export async function routePlan(page: Page, plan: AccountPlan) {
  await seedPlan(page, plan);
  await page.route("**/api/backend/auth/plan", (route) =>
    route.fulfill(fulfillJson(200, plan)),
  );
}
