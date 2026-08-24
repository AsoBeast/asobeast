import { afterEach, describe, expect, it } from "vitest";
import { PLAN_LIMITS } from "@asobeast/shared";
import { loadConfig } from "./config.js";
import { preflight } from "./preflight.js";
import { stubFetch } from "./tools/harness.js";

const realFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = realFetch;
});

function user(entitled: boolean) {
  return {
    id: "u1",
    email: "owner@example.com",
    emailVerified: true,
    name: "Owner",
    role: "owner",
    plan: "free",
    trialEndsAt: null,
    planExpiresAt: null,
    entitled,
  };
}

function accountPlan(displayName = "Indie") {
  return {
    plan: "indie",
    displayName,
    billing: true,
    entitled: true,
    trialEndsAt: null,
    renewsAt: null,
    upgradeTo: "ultimate",
    upgradePath: "/upgrade",
    limits: PLAN_LIMITS.indie,
    usage: {
      apps: { used: 1, limit: PLAN_LIMITS.indie.apps },
      keywordMarkets: { used: 2, limit: PLAN_LIMITS.indie.keywordMarkets },
    },
  };
}

describe("preflight", () => {
  it("requires an api token in configuration", () => {
    expect(() => loadConfig({})).toThrowError(/ASOBEAST_API_TOKEN/);
  });

  it("passes for an entitled account and reports its own limits", async () => {
    const { client } = stubFetch((url) =>
      url.endsWith("/auth/plan")
        ? { status: 200, body: accountPlan() }
        : { status: 200, body: user(true) },
    );

    await expect(preflight(client)).resolves.toEqual({
      ok: true,
      limits: `Indie plan, ${PLAN_LIMITS.indie.mcpRequestsPerMinute} requests/minute`,
    });
  });

  it("connects without limits when the plan endpoint is unavailable", async () => {
    const { client } = stubFetch((url) =>
      url.endsWith("/auth/plan")
        ? { status: 404, body: {} }
        : { status: 200, body: user(true) },
    );

    await expect(preflight(client)).resolves.toEqual({
      ok: true,
      limits: "plan unknown",
    });
  });

  it("refuses a 200 /auth/me that reports entitled false", async () => {
    const { client } = stubFetch(() => ({ status: 200, body: user(false) }));
    const result = await preflight(client);
    expect(result.ok).toBe(false);
    expect(result).toHaveProperty(
      "message",
      expect.stringContaining("not entitled"),
    );
  });

  it("refuses a rejected token", async () => {
    const { client } = stubFetch(() => ({
      status: 401,
      body: {
        statusCode: 401,
        error: "Unauthorized",
        message: "Invalid token",
        path: "/auth/me",
        timestamp: "2026-07-24T00:00:00.000Z",
      },
    }));
    const result = await preflight(client);
    expect(result.ok).toBe(false);
    expect(result).toHaveProperty("message", expect.stringContaining("401"));
  });

  it("refuses an expired entitlement", async () => {
    const { client } = stubFetch(() => ({
      status: 402,
      body: {
        statusCode: 402,
        error: "Payment Required",
        message: "Trial expired",
        path: "/auth/me",
        timestamp: "2026-07-24T00:00:00.000Z",
      },
    }));
    const result = await preflight(client);
    expect(result.ok).toBe(false);
    expect(result).toHaveProperty(
      "message",
      expect.stringContaining("not entitled"),
    );
  });

  it("reports a transport failure", async () => {
    const { client } = stubFetch(() => "throw");
    const result = await preflight(client);
    expect(result.ok).toBe(false);
    expect(result).toHaveProperty(
      "message",
      expect.stringContaining("Could not reach"),
    );
  });
});
