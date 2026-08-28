import { test as base } from "@playwright/test";
import type { WebHealth } from "../src/lib/api/web";

const UNREPORTED_HEALTH: WebHealth = {
  status: "ok",
  statusPageUrl: null,
  errorReportingDsn: null,
};

export const test = base.extend<{ errorReporting: void }>({
  errorReporting: [
    async ({ context }, use) => {
      await context.route("**/api/health", (route) =>
        route.fulfill({ json: UNREPORTED_HEALTH }),
      );
      await use();
    },
    { auto: true },
  ],
});

export { expect } from "@playwright/test";
