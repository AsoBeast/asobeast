import type { ApiErrorEnvelope } from "@asobeast/shared";
import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api";
import { retryDelayFor, shouldRetry } from "./query-retry";

function apiError(statusCode: number, retryAfterSeconds?: number): ApiError {
  const envelope: ApiErrorEnvelope = {
    statusCode,
    error: "Error",
    message: "boom",
    path: "/portfolio",
    timestamp: "2026-08-25T10:30:26.118Z",
    ...(retryAfterSeconds === undefined ? {} : { retryAfterSeconds }),
  };
  return new ApiError(envelope);
}

describe("shouldRetry", () => {
  it("never spends more budget on a refusal the API already decided", () => {
    for (const statusCode of [401, 402, 403, 404, 429]) {
      expect(shouldRetry(0, apiError(statusCode))).toBe(false);
    }
  });

  it("retries a server failure up to three times", () => {
    expect(shouldRetry(0, apiError(500))).toBe(true);
    expect(shouldRetry(2, apiError(500))).toBe(true);
    expect(shouldRetry(3, apiError(500))).toBe(false);
  });

  it("retries a transport failure that carries no envelope", () => {
    expect(shouldRetry(0, new TypeError("fetch failed"))).toBe(true);
    expect(shouldRetry(3, new TypeError("fetch failed"))).toBe(false);
  });
});

describe("retryDelayFor", () => {
  it("waits the seconds the refusal asked for", () => {
    expect(retryDelayFor(0, apiError(503, 4))).toBe(4_000);
  });

  it("backs off exponentially when no wait was given", () => {
    expect(retryDelayFor(0, apiError(500))).toBe(1_000);
    expect(retryDelayFor(1, apiError(500))).toBe(2_000);
    expect(retryDelayFor(2, new Error("offline"))).toBe(4_000);
  });

  it("caps its own backoff at thirty seconds", () => {
    expect(retryDelayFor(20, new Error("offline"))).toBe(30_000);
  });

  it("backs off itself rather than trust a wait it cannot use", () => {
    expect(retryDelayFor(0, apiError(503, 0))).toBe(1_000);
    expect(retryDelayFor(0, apiError(503, -4))).toBe(1_000);
  });
});
