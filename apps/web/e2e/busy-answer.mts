import type { Page } from "@playwright/test";
import type { ApiErrorEnvelope } from "@asobeast/shared";

export const BUSY_LINE = "The server is busy. Trying again in a few seconds.";
export const BUSY_SENTENCE =
  "This server is busy reaching Google Play. Try again in 1 seconds.";

export function busyEnvelope(path: string): ApiErrorEnvelope {
  return {
    statusCode: 503,
    error: "Service Unavailable",
    message: BUSY_SENTENCE,
    path,
    timestamp: "2026-11-18T12:00:00.000Z",
    retryAfterSeconds: 1,
  };
}

export async function answerBusy(
  page: Page,
  url: string,
  path: string,
  times: number,
): Promise<void> {
  let answered = 0;
  await page.route(url, async (route) => {
    if (route.request().method() !== "POST" || answered >= times) {
      return route.fallback();
    }
    answered += 1;
    await route.fulfill({ status: 503, json: busyEnvelope(path) });
  });
}

export function countPosts(page: Page, path: RegExp): string[] {
  const seen: string[] = [];
  page.on("request", (request) => {
    if (request.method() === "POST" && path.test(request.url())) {
      seen.push(request.url());
    }
  });
  return seen;
}
