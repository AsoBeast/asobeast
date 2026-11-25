import { describe, expect, it } from "vitest";
import type { ProxyEndpointHealth } from "@asobeast/shared";
import { proxyRefusals, refusalReason } from "./proxy-refusals";

const endpoint = (
  endpointId: string,
  lastRefusalStatus: number | null | undefined,
  store: ProxyEndpointHealth["store"] = "APP_STORE",
): ProxyEndpointHealth => ({
  endpointId,
  address: "192.0.2.1:8080",
  country: null,
  store,
  successes: 0,
  failures: 1,
  successRate: 0,
  consecutiveFailures: 0,
  cooldownUntil: null,
  lastOutcome: "TRANSPORT",
  lastUsedAt: null,
  lastRefusalStatus,
});

describe("refusalReason", () => {
  it.each([
    [402, "the plan or its quota is used up (HTTP 402)"],
    [407, "the provider does not accept the proxy credentials (HTTP 407)"],
    [503, "no reason beyond the status (HTTP 503)"],
  ])("explains a %s from its status alone", (status, reason) => {
    expect(refusalReason(status)).toBe(reason);
  });
});

describe("proxyRefusals", () => {
  it("counts each refused endpoint once per status, the widest first", () => {
    expect(
      proxyRefusals([
        endpoint("a", 407),
        endpoint("b", 402),
        endpoint("b", 402, "GOOGLE_PLAY"),
        endpoint("c", 402),
        endpoint("d", null),
        endpoint("e", undefined),
      ]),
    ).toEqual([
      {
        status: 402,
        endpoints: 2,
        sentence:
          "2 endpoints refused by the proxy provider: the plan or its quota is used up (HTTP 402).",
      },
      {
        status: 407,
        endpoints: 1,
        sentence:
          "1 endpoint refused by the proxy provider: the provider does not accept the proxy credentials (HTTP 407).",
      },
    ]);
  });

  it("says refused once for a status it cannot explain", () => {
    expect(proxyRefusals([endpoint("a", 503)])).toEqual([
      {
        status: 503,
        endpoints: 1,
        sentence:
          "1 endpoint refused by the proxy provider: no reason beyond the status (HTTP 503).",
      },
    ]);
  });

  it("says nothing when no endpoint was refused", () => {
    expect(proxyRefusals([endpoint("a", null)])).toEqual([]);
  });
});
