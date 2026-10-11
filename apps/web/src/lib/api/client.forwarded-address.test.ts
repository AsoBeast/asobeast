import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const CLIENT_ADDRESS = "198.51.100.20";
const SPOOFED_ADDRESS = "203.0.113.9";

function stubIncomingHeaders(headers: Record<string, string>): void {
  vi.doMock("next/headers", () => ({
    headers: async () => new Headers(headers),
  }));
}

async function sentHeaders(trustProxy: string): Promise<Headers> {
  vi.resetModules();
  vi.stubEnv("TRUST_PROXY", trustProxy);
  const fetchMock = vi.fn<typeof fetch>(async () => Response.json({}));
  vi.stubGlobal("fetch", fetchMock);
  const { apiFetch } = await import("./client");

  await apiFetch("/apps");

  return fetchMock.mock.calls[0][1]?.headers as Headers;
}

describe("apiFetch on the server", () => {
  beforeEach(() => {
    stubIncomingHeaders({
      cookie: "asobeast_session=abc",
      "x-forwarded-for": `${SPOOFED_ADDRESS}, ${CLIENT_ADDRESS}`,
    });
  });

  afterEach(() => {
    vi.doUnmock("next/headers");
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("tells the api which client the page is rendered for", async () => {
    const headers = await sentHeaders("1");

    expect(headers.get("x-forwarded-for")).toBe(CLIENT_ADDRESS);
    expect(headers.get("cookie")).toBe("asobeast_session=abc");
  });

  it("never passes on an address it has no proxy to vouch for", async () => {
    const headers = await sentHeaders("0");

    expect(headers.get("x-forwarded-for")).toBeNull();
    expect(headers.get("cookie")).toBe("asobeast_session=abc");
  });
});
