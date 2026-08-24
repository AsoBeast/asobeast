import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api";
import { recoveryFor } from "./error-recovery";

function apiError(statusCode: number, message = "boom"): ApiError {
  return new ApiError({
    statusCode,
    error: "Error",
    message,
    path: "/health",
    timestamp: new Date().toISOString(),
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

  it("never surfaces an internal identifier", () => {
    const error = Object.assign(new Error("kaboom"), { digest: "abc123" });
    expect(JSON.stringify(recoveryFor(error))).not.toContain("abc123");
  });
});
