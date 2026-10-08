import { test as base } from "@playwright/test";
import { APP_2_ICON_URL, APP_LONG_ICON_URL } from "./fixtures.mts";

export const ICON_PIXEL = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

export function optimizedIcon(iconUrl: string) {
  return (url: URL) =>
    url.pathname === "/_next/image" && url.searchParams.get("url") === iconUrl;
}

const E2E_SCREENSHOT = "https://is1-ssl.mzstatic.com/image/thumb/e2e-focus/";

function optimizedScreenshot(url: URL) {
  return (
    url.pathname === "/_next/image" &&
    (url.searchParams.get("url") ?? "").startsWith(E2E_SCREENSHOT)
  );
}

export const test = base.extend<{ storeIcons: void }>({
  storeIcons: [
    async ({ context }, use) => {
      for (const iconUrl of [APP_2_ICON_URL, APP_LONG_ICON_URL]) {
        await context.route(optimizedIcon(iconUrl), (route) =>
          route.fulfill({ contentType: "image/png", body: ICON_PIXEL }),
        );
      }
      await context.route(optimizedScreenshot, (route) =>
        route.fulfill({ contentType: "image/png", body: ICON_PIXEL }),
      );
      await use();
    },
    { auto: true },
  ],
});

export { expect } from "@playwright/test";
