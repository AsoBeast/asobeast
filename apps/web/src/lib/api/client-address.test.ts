import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

async function loadClientAddress(
  trustProxy?: string,
  nodeEnv?: string,
  phase?: string,
) {
  vi.resetModules();
  vi.unstubAllEnvs();
  if (trustProxy !== undefined) vi.stubEnv("TRUST_PROXY", trustProxy);
  else vi.stubEnv("TRUST_PROXY", "");
  if (nodeEnv !== undefined) vi.stubEnv("NODE_ENV", nodeEnv);
  vi.stubEnv("NEXT_PHASE", phase ?? "");
  return import("./client-address");
}

function requestWith(headers: Record<string, string>): NextRequest {
  return new NextRequest("http://web.local/api/backend/apps", { headers });
}

describe("trustedClientAddress", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("trusts nothing when no proxy hop is configured", async () => {
    const { trustedClientAddress } = await loadClientAddress();

    expect(
      trustedClientAddress(requestWith({ "x-forwarded-for": "203.0.113.9" })),
    ).toBeNull();
  });

  it("takes the entry the single trusted proxy appended", async () => {
    const { trustedClientAddress } = await loadClientAddress("1");

    expect(
      trustedClientAddress(
        requestWith({ "x-forwarded-for": "203.0.113.9, 198.51.100.20" }),
      ),
    ).toBe("198.51.100.20");
  });

  it("counts hops from the right for a longer trusted chain", async () => {
    const { trustedClientAddress } = await loadClientAddress("2");

    expect(
      trustedClientAddress(
        requestWith({
          "x-forwarded-for": "203.0.113.9, 198.51.100.20, 192.0.2.5",
        }),
      ),
    ).toBe("198.51.100.20");
  });

  it("reads the boolean spelling as a single hop", async () => {
    const { trustedClientAddress } = await loadClientAddress("true");

    expect(
      trustedClientAddress(
        requestWith({ "x-forwarded-for": "203.0.113.9, 198.51.100.20" }),
      ),
    ).toBe("198.51.100.20");
  });

  it("refuses to guess when the chain is shorter than the trusted hop count", async () => {
    const { trustedClientAddress } = await loadClientAddress("2");

    expect(
      trustedClientAddress(requestWith({ "x-forwarded-for": "198.51.100.20" })),
    ).toBeNull();
  });

  it("refuses to guess when the header is absent or empty", async () => {
    const { trustedClientAddress } = await loadClientAddress("1");

    expect(trustedClientAddress(requestWith({}))).toBeNull();
    expect(
      trustedClientAddress(requestWith({ "x-forwarded-for": " , " })),
    ).toBeNull();
  });

  it("refuses to interpret a hop count it cannot parse", async () => {
    await expect(loadClientAddress("yes")).rejects.toThrow("TRUST_PROXY");
  });
});

describe("the warning a deployment behind a proxy needs to see", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("warns in production when no hop is counted", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    await loadClientAddress("0", "production");

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls.flat().join(" ")).toContain("TRUST_PROXY");
  });

  it("warns in production when the hop count was never set", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    await loadClientAddress(undefined, "production");

    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("stays quiet in production once a hop is counted", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    await loadClientAddress("1", "production");

    expect(warn).not.toHaveBeenCalled();
  });

  it("stays quiet outside production, where no proxy is expected", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    await loadClientAddress("0", "development");

    expect(warn).not.toHaveBeenCalled();
  });

  it("stays quiet during the production build, which serves nobody", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    await loadClientAddress("0", "production", "phase-production-build");

    expect(warn).not.toHaveBeenCalled();
  });
});
