import type { RateLimitDetail } from "@asobeast/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api";
import { getWebHealth } from "@/lib/api/web";
import { reportBrowserError, worthReporting } from "./error-reporting";

vi.mock("@/lib/api/web", () => ({ getWebHealth: vi.fn() }));

const sentry = vi.hoisted(() => ({
  isInitialized: vi.fn(),
  init: vi.fn(),
  captureException: vi.fn(),
}));

vi.mock("@sentry/nextjs", () => sentry);

const health = vi.mocked(getWebHealth);

const DSN = "https://publickey@errors.example.com/7";

function healthWith(errorReportingDsn: string | null) {
  return { status: "ok", statusPageUrl: null, errorReportingDsn };
}

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

describe("reportBrowserError", () => {
  const error = new Error("boom");

  beforeEach(() => {
    sentry.isInitialized.mockReset().mockReturnValue(false);
    sentry.init.mockReset();
    sentry.captureException.mockReset();
    health.mockReset();
  });

  it("initializes from the runtime dsn before capturing, so a root render failure is not dropped", async () => {
    health.mockResolvedValue(healthWith(DSN));

    await reportBrowserError(error);

    expect(sentry.init).toHaveBeenCalledWith(
      expect.objectContaining({ dsn: DSN }),
    );
    expect(sentry.captureException).toHaveBeenCalledWith(error);
    expect(sentry.init.mock.invocationCallOrder[0]).toBeLessThan(
      sentry.captureException.mock.invocationCallOrder[0],
    );
  });

  it("captures without initializing twice once the reporter is already on", async () => {
    sentry.isInitialized.mockReturnValue(true);

    await reportBrowserError(error);

    expect(sentry.init).not.toHaveBeenCalled();
    expect(health).not.toHaveBeenCalled();
    expect(sentry.captureException).toHaveBeenCalledWith(error);
  });

  it("stays silent on a deployment that configured no dsn", async () => {
    health.mockResolvedValue(healthWith(null));

    await reportBrowserError(error);

    expect(sentry.init).not.toHaveBeenCalled();
    expect(sentry.captureException).not.toHaveBeenCalled();
  });

  it("resolves rather than rejecting when the dsn cannot be fetched", async () => {
    health.mockRejectedValue(new Error("the web app answered 503"));

    await expect(reportBrowserError(error)).resolves.toBeUndefined();
    expect(sentry.captureException).not.toHaveBeenCalled();
  });
});
