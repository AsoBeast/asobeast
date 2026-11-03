import type { Page } from "@playwright/test";
import { fulfillJson, seedSession } from "./plan-helpers.mts";
import { CATALOG, openBilling } from "./trial-plans.mts";
import { seedViewer } from "./viewer.mts";

export const STRIPE_STUB = `
  window.Stripe = function () {
    return {
      createEmbeddedCheckoutPage: async ({
        clientSecret,
        fetchClientSecret,
      }) => {
        const secret = clientSecret
          ? Promise.resolve(clientSecret)
          : fetchClientSecret();
        return {
          mount: (target) =>
            secret.then(
              (value) => target.setAttribute("data-mounted", value),
              (error) => {
                target.setAttribute("data-stripe-error", "");
                throw new Error("fetchClientSecret failed: " + error);
              },
            ),
          unmount: () => {},
          destroy: () => {},
        };
      },
    };
  };
  window.Stripe.version = "endive";
`;

export async function openEmbedded(page: Page) {
  await seedViewer(page.context(), "checkout-pending");
  await seedSession(page);
  await openBilling(page);
  await page.route("**/api/backend/billing/catalog", (route) =>
    route.fulfill(
      fulfillJson(200, { ...CATALOG, publishableKey: "pk_test_e2e" }),
    ),
  );
  await page.route("https://js.stripe.com/**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/javascript",
      body: STRIPE_STUB,
    }),
  );
  const bodies: { priceId: string; ui: string; theme: string }[] = [];
  await page.route("**/api/backend/billing/checkout", async (route) => {
    const body = route.request().postDataJSON() as {
      priceId: string;
      ui: string;
      theme: string;
    };
    bodies.push(body);
    await route.fulfill(
      fulfillJson(200, {
        url: "http://localhost:3000/?checkout=complete",
        clientSecret: `cs_${body.priceId}_${body.theme}_${bodies.length}`,
      }),
    );
  });
  return bodies;
}
