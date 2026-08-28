import { SESSION_COOKIE } from "@asobeast/shared";
import { test as base } from "./reporting.mts";

export const test = base.extend<{ session: void }>({
  session: [
    async ({ context }, use) => {
      await context.addCookies([
        { name: SESSION_COOKIE, value: "e2e", domain: "localhost", path: "/" },
      ]);
      await use();
    },
    { auto: true },
  ],
});

export { expect } from "@playwright/test";
