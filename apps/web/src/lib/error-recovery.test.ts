import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api";
import { recoveryFor } from "./error-recovery";

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
    const recovery = recoveryFor(apiError(429, "Rate limit reached", 4));

    expect(recovery.title).toContain("plan");
    expect(recovery.body).toContain("plan allows");
    expect(recovery.body).toContain("Wait 4 seconds");
    expect(recovery.body).not.toContain("store rate limiter");
  });

  it("promises no wait the refusal did not carry", () => {
    const recovery = recoveryFor(apiError(429, "Too many refreshes"));

    expect(recovery.body).toContain("Wait a moment");
    expect(recovery.body).not.toMatch(/\d+ seconds/);
  });

  it("counts a one second wait in the singular", () => {
    expect(recoveryFor(apiError(429, "Rate limit reached", 1)).body).toContain(
      "Wait 1 second and",
    );
  });

  it("reads the refusal off a server render that lost its message", () => {
    const crossed = Object.assign(new Error("An error occurred"), {
      digest: apiError(429, "Rate limit reached", 4).digest,
    });

    expect(recoveryFor(crossed)).toEqual(
      recoveryFor(apiError(429, "Rate limit reached", 4)),
    );
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
});
