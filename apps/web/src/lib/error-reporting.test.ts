import type { RateLimitDetail } from "@asobeast/shared";
import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api";
import { worthReporting } from "./error-reporting";

const RATE_LIMIT: RateLimitDetail = {
  window: "minute",
  rateClass: "read",
  plan: "trial",
  limit: 300,
  resetSeconds: 4,
  upgradeTo: "indie",
};

function apiError(statusCode: number, rateLimit?: RateLimitDetail): ApiError {
  return new ApiError({
    statusCode,
    error: "Error",
    message: "boom",
    path: "/apps",
    timestamp: new Date().toISOString(),
    ...(rateLimit ? { rateLimit } : {}),
  });
}

describe("worthReporting", () => {
  it("reports a render failure the browser cannot explain", () => {
    expect(worthReporting(new Error("cannot read properties"))).toBe(true);
  });

  it.each([
    ["an expired session", () => apiError(401)],
    ["a spent request budget", () => apiError(429, RATE_LIMIT)],
    ["a missing record", () => apiError(404)],
    ["a failure the api reported itself", () => apiError(500)],
    ["a refusal the api explained", () => apiError(409)],
  ])("stays silent for %s", (_case, build) => {
    expect(worthReporting(build())).toBe(false);
  });

  it("stays silent for a server rendered failure, which onRequestError already sent", () => {
    const crossed = Object.assign(new Error("An error occurred"), {
      digest: "abc123",
    });

    expect(worthReporting(crossed)).toBe(false);
  });
});
