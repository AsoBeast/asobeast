import type { BrowserContext } from "@playwright/test";

export const VIEWER_COOKIE = "e2e_viewer";

export const VIEWERS = ["customer", "member"] as const;

export type Viewer = (typeof VIEWERS)[number];

export async function seedViewer(
  context: BrowserContext,
  viewer: Viewer,
): Promise<void> {
  await context.addCookies([
    { name: VIEWER_COOKIE, value: viewer, domain: "localhost", path: "/" },
  ]);
}
