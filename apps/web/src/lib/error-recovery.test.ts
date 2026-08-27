import type { RateLimitDetail } from "@asobeast/shared";
import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api";
import { recoveryFor } from "./error-recovery";

const RATE_LIMIT: RateLimitDetail = {
  window: "minute",
  rateClass: "read",
  plan: "trial",
  limit: 300,
  resetSeconds: 4,
  upgradeTo: "indie",
};

function apiError(
  statusCode: number,
  message = "boom",
  retryAfterSeconds?: number,
): ApiError {
  return new ApiError({
    statusCode,
    error: "Error",
    message,
    path: "/health",
    timestamp: new Date().toISOString(),
    ...(retryAfterSeconds === undefined ? {} : { retryAfterSeconds }),
  });
}

function planRefusal(retryAfterSeconds?: number): ApiError {
  return new ApiError({
    statusCode: 429,
    error: "Too Many Requests",
    message: "Rate limit reached",
    path: "/portfolio",
    timestamp: new Date().toISOString(),
    rateLimit: RATE_LIMIT,
    ...(retryAfterSeconds === undefined ? {} : { retryAfterSeconds }),
  });
}

describe("recoveryFor", () => {
  it("offers a retry for an unknown error", () => {
    expect(recoveryFor(new Error("nope")).action).toEqual({ kind: "retry" });
  });

  it("sends an expired session to the login page", () => {
    expect(recoveryFor(apiError(401)).action).toEqual({
      kind: "link",
      href: "/login",
      label: "Sign in",
    });
  });

  it("sends an unentitled account to the upgrade page, not a retry", () => {
    expect(recoveryFor(apiError(402)).action).toEqual({
      kind: "link",
      href: "/upgrade",
      label: "See plans",
    });
  });

  it("names the self hosted stack when the proxy times out", () => {
    expect(recoveryFor(apiError(504)).body).toContain("api container");
  });

  it("surfaces the envelope message for a server failure", () => {
    expect(recoveryFor(apiError(500, "database down")).body).toBe(
      "database down",
    );
  });

  it("names the plan budget and the wait when the API refuses a read", () => {
    const recovery = recoveryFor(planRefusal(4));

    expect(recovery.title).toContain("plan");
    expect(recovery.body).toContain("plan allows");
    expect(recovery.body).toContain("in 4 seconds");
    expect(recovery.body).not.toContain("store rate limiter");
  });

  it("blames no plan budget for a refusal the plan did not cause", () => {
    const recovery = recoveryFor(apiError(429, "Too many refreshes", 4));

    expect(recovery.title).toBe("Too many requests");
    expect(recovery.body).not.toContain("plan");
    expect(recovery.body).toContain("in 4 seconds");
  });

  it("promises no wait the refusal did not carry", () => {
    const recovery = recoveryFor(planRefusal());

    expect(recovery.body).toContain("Try again in a moment");
    expect(recovery.body).not.toMatch(/\d+ second/);
  });

  it("states a long wait in hours rather than in thousands of seconds", () => {
    const recovery = recoveryFor(apiError(429, "Too many refreshes", 43_200));

    expect(recovery.body).toContain("in 12 hours");
    expect(recovery.body).not.toContain("43200");
  });

  it("reads the refusal off a server render that lost its message", () => {
    const crossed = Object.assign(new Error("An error occurred"), {
      digest: planRefusal(4).digest,
    });

    expect(recoveryFor(crossed)).toEqual(recoveryFor(planRefusal(4)));
  });

  it("keeps a plan refusal apart from a plain refusal across the boundary", () => {
    const crossed = Object.assign(new Error("An error occurred"), {
      digest: apiError(429, "Too many refreshes", 4).digest,
    });

    expect(recoveryFor(crossed).title).toBe("Too many requests");
  });

  it("sends a server rendered session expiry to the login page", () => {
    const crossed = Object.assign(new Error("An error occurred"), {
      digest: apiError(401).digest,
    });

    expect(recoveryFor(crossed).action).toEqual({
      kind: "link",
      href: "/login",
      label: "Sign in",
    });
  });

  it("stays generic for a server rendered failure it cannot name", () => {
    const crossed = Object.assign(new Error("An error occurred"), {
      digest: apiError(500, "database down").digest,
    });

    expect(recoveryFor(crossed).body).toBe(recoveryFor(new Error("x")).body);
  });

  it("never surfaces an internal identifier", () => {
    const error = Object.assign(new Error("kaboom"), { digest: "abc123" });
    expect(JSON.stringify(recoveryFor(error))).not.toContain("abc123");
  });

  it.each([
    ["an expired session", () => apiError(401)],
    ["a spent request budget", () => planRefusal(4)],
    ["a missing record", () => apiError(404)],
    ["a failure the api reported itself", () => apiError(500, "database down")],
    ["a refusal the api explained", () => apiError(409, "already exists")],
  ])("treats %s as expected, so it is never reported", (_case, build) => {
    expect(recoveryFor(build()).expected).toBe(true);
  });

  it.each([
    ["a client render failure", () => new Error("cannot read properties")],
    [
      "a server rendered failure it cannot name",
      () => Object.assign(new Error("An error occurred"), { digest: "abc123" }),
    ],
  ])("treats %s as unexpected, so it is reported", (_case, build) => {
    expect(recoveryFor(build()).expected).toBe(false);
  });
});
