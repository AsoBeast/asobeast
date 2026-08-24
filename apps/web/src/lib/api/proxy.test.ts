import type { ApiErrorEnvelope } from "@asobeast/shared";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const API_BASE = "http://api.internal:4000";

type NextRequestInit = NonNullable<
  ConstructorParameters<typeof NextRequest>[1]
>;

function request(
  path = "/api/backend/apps",
  init?: NextRequestInit & { search?: string },
): NextRequest {
  const { search = "", ...requestInit } = init ?? {};
  return new NextRequest(`http://web.local${path}${search}`, requestInit);
}

async function loadProxy(env: Record<string, string> = {}) {
  vi.resetModules();
  vi.stubEnv("API_INTERNAL_URL", API_BASE);
  for (const [name, value] of Object.entries(env)) {
    vi.stubEnv(name, value);
  }
  return import("./proxy");
}

function stubFetch(implementation: typeof fetch): void {
  vi.stubGlobal("fetch", vi.fn(implementation));
}

function fetchMock(): ReturnType<typeof vi.fn> {
  return globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
}

describe("proxyToApi", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("passes an upstream response through with its status and body", async () => {
    stubFetch(async () =>
      Response.json(
        { items: [] },
        { status: 201, headers: { "cache-control": "no-store" } },
      ),
    );
    const { proxyToApi } = await loadProxy();

    const response = await proxyToApi(request(), ["apps"]);

    expect(response.status).toBe(201);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({ items: [] });
  });

  it("keeps the filename the api named an export download with", async () => {
    stubFetch(
      async () =>
        new Response("{}\n", {
          status: 200,
          headers: {
            "content-type": "application/x-ndjson; charset=utf-8",
            "content-disposition":
              'attachment; filename="asobeast-export.ndjson"',
          },
        }),
    );
    const { proxyToApi } = await loadProxy();

    const response = await proxyToApi(request(), ["account", "export"]);

    expect(response.headers.get("content-disposition")).toBe(
      'attachment; filename="asobeast-export.ndjson"',
    );
    expect(response.headers.get("content-type")).toBe(
      "application/x-ndjson; charset=utf-8",
    );
  });

  it("passes an upstream error status through untouched", async () => {
    stubFetch(async () => Response.json({ statusCode: 404 }, { status: 404 }));
    const { proxyToApi } = await loadProxy();

    const response = await proxyToApi(request(), ["apps", "missing"]);

    expect(response.status).toBe(404);
  });

  it("targets the internal api with the path segments and the original query", async () => {
    stubFetch(async () => Response.json({}));
    const { proxyToApi } = await loadProxy();

    await proxyToApi(
      request("/api/backend/apps", { search: "?sort=traffic" }),
      ["apps", "app-1", "keywords"],
    );

    expect(fetchMock()).toHaveBeenCalledWith(
      `${API_BASE}/apps/app-1/keywords?sort=traffic`,
      expect.objectContaining({ cache: "no-store", redirect: "manual" }),
    );
  });

  it("forwards the credential headers the api authenticates with", async () => {
    stubFetch(async () => Response.json({}));
    const { proxyToApi } = await loadProxy();

    await proxyToApi(
      request("/api/backend/apps", {
        headers: { cookie: "asob_session=abc", authorization: "Bearer asob_x" },
      }),
      ["apps"],
    );

    const headers = fetchMock().mock.calls[0][1].headers as Headers;
    expect(headers.get("cookie")).toBe("asob_session=abc");
    expect(headers.get("authorization")).toBe("Bearer asob_x");
  });

  it("forwards the content types the mcp streamable transport requires", async () => {
    stubFetch(async () => Response.json({}));
    const { proxyToApi } = await loadProxy();

    await proxyToApi(
      request("/api/backend/mcp", {
        method: "POST",
        headers: { accept: "application/json, text/event-stream" },
        body: '{"jsonrpc":"2.0","id":1,"method":"tools/list"}',
      }),
      ["mcp"],
    );

    const headers = fetchMock().mock.calls[0][1].headers as Headers;
    expect(headers.get("accept")).toBe("application/json, text/event-stream");
  });

  it("forwards the protocol revision an mcp client negotiated", async () => {
    stubFetch(async () => Response.json({}));
    const { proxyToApi } = await loadProxy();

    await proxyToApi(
      request("/api/backend/mcp", {
        method: "POST",
        headers: {
          accept: "application/json, text/event-stream",
          "mcp-protocol-version": "2025-11-25",
          "mcp-session-id": "session-1",
        },
        body: '{"jsonrpc":"2.0","id":1,"method":"tools/list"}',
      }),
      ["mcp"],
    );

    const headers = fetchMock().mock.calls[0][1].headers as Headers;
    expect(headers.get("mcp-protocol-version")).toBe("2025-11-25");
    expect(headers.get("mcp-session-id")).toBe("session-1");
  });

  it("returns the directive the api streams an mcp response with", async () => {
    stubFetch(
      async () =>
        new Response("event: message\ndata: {}\n\n", {
          status: 200,
          headers: {
            "content-type": "text/event-stream",
            "x-accel-buffering": "no",
          },
        }),
    );
    const { proxyToApi } = await loadProxy();

    const response = await proxyToApi(request("/api/backend/mcp"), ["mcp"]);

    expect(response.headers.get("content-type")).toBe("text/event-stream");
    expect(response.headers.get("x-accel-buffering")).toBe("no");
  });

  it("forwards a caller supplied correlation id so its logs share the key", async () => {
    stubFetch(async () => Response.json({ ok: true }));
    const { proxyToApi } = await loadProxy();

    await proxyToApi(
      request("/api/backend/apps", {
        headers: { "x-correlation-id": "support-4821" },
      }),
      ["apps"],
    );

    const headers = fetchMock().mock.calls[0][1].headers as Headers;
    expect(headers.get("x-correlation-id")).toBe("support-4821");
  });

  it("returns every upstream set-cookie header so sessions survive the hop", async () => {
    stubFetch(async () => {
      const headers = new Headers();
      headers.append("set-cookie", "asob_session=abc; Path=/");
      headers.append("set-cookie", "asob_refresh=def; Path=/");
      return new Response(null, { status: 204, headers });
    });
    const { proxyToApi } = await loadProxy();

    const response = await proxyToApi(request(), ["auth", "login"]);

    expect(response.headers.getSetCookie()).toEqual([
      "asob_session=abc; Path=/",
      "asob_refresh=def; Path=/",
    ]);
  });

  it.each(["GET", "HEAD"])("sends no body for a %s request", async (method) => {
    stubFetch(async () => Response.json({}));
    const { proxyToApi } = await loadProxy();

    await proxyToApi(request("/api/backend/apps", { method }), ["apps"]);

    expect(fetchMock().mock.calls[0][1].body).toBeUndefined();
  });

  it("forwards the body of a mutating request", async () => {
    stubFetch(async () => Response.json({}));
    const { proxyToApi } = await loadProxy();

    await proxyToApi(
      request("/api/backend/apps", {
        method: "POST",
        body: JSON.stringify({ url: "https://apps.apple.com/us/app/id1" }),
      }),
      ["apps"],
    );

    expect(fetchMock().mock.calls[0][1].body).toBe(
      '{"url":"https://apps.apple.com/us/app/id1"}',
    );
  });

  it("answers an upstream timeout with a 504 envelope", async () => {
    const timeout = new Error("The operation was aborted due to timeout");
    timeout.name = "TimeoutError";
    stubFetch(async () => {
      throw timeout;
    });
    const { proxyToApi } = await loadProxy();

    const response = await proxyToApi(request("/api/backend/apps"), ["apps"]);
    const envelope = (await response.json()) as ApiErrorEnvelope;

    expect(response.status).toBe(504);
    expect(envelope).toMatchObject({
      statusCode: 504,
      error: "Gateway Timeout",
      path: "/api/backend/apps",
    });
    expect(envelope.message).toBeTruthy();
    expect(Date.parse(envelope.timestamp)).not.toBeNaN();
  });

  it("answers an unreachable api with a 502 envelope", async () => {
    stubFetch(async () => {
      throw new TypeError("fetch failed");
    });
    const { proxyToApi } = await loadProxy();

    const response = await proxyToApi(request("/api/backend/health"), [
      "health",
    ]);
    const envelope = (await response.json()) as ApiErrorEnvelope;

    expect(response.status).toBe(502);
    expect(envelope).toMatchObject({
      statusCode: 502,
      error: "Bad Gateway",
      path: "/api/backend/health",
    });
  });

  it("bounds the upstream request with the configured timeout", async () => {
    const timeout = vi.spyOn(AbortSignal, "timeout");
    stubFetch(async () => Response.json({}));
    const { proxyToApi } = await loadProxy({ API_PROXY_TIMEOUT_MS: "1234" });

    await proxyToApi(request(), ["apps"]);

    expect(timeout).toHaveBeenCalledWith(1234);
  });

  it("bounds the upstream request with the documented default timeout", async () => {
    const timeout = vi.spyOn(AbortSignal, "timeout");
    stubFetch(async () => Response.json({}));
    const { proxyToApi } = await loadProxy();

    await proxyToApi(request(), ["apps"]);

    expect(timeout).toHaveBeenCalledWith(30_000);
  });
});

describe("proxyToApi webhook delivery", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("forwards the signature a webhook delivery is verified by", async () => {
    stubFetch(async () => Response.json({ received: true }));
    const { proxyToApi } = await loadProxy();

    await proxyToApi(
      request("/api/backend/billing/webhook", {
        method: "POST",
        headers: { "stripe-signature": "t=1610000000,v1=5257a869e7b" },
        body: '{"id":"evt_1","type":"invoice.paid"}',
      }),
      ["billing", "webhook"],
    );

    const headers = fetchMock().mock.calls[0][1].headers as Headers;
    expect(headers.get("stripe-signature")).toBe("t=1610000000,v1=5257a869e7b");
  });

  it("forwards a signed body byte for byte, because the signature covers it", async () => {
    stubFetch(async () => Response.json({ received: true }));
    const { proxyToApi } = await loadProxy();
    const payload = '{"id":"evt_1","data":{"name":"Kraków café 🎉"}}';

    await proxyToApi(
      request("/api/backend/billing/webhook", {
        method: "POST",
        headers: { "stripe-signature": "t=1610000000,v1=5257a869e7b" },
        body: payload,
      }),
      ["billing", "webhook"],
    );

    const body = fetchMock().mock.calls[0][1].body as string;
    const encoder = new TextEncoder();
    expect(encoder.encode(body)).toEqual(encoder.encode(payload));
  });
});

describe("proxyToApi client address", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("never forwards a client supplied client address", async () => {
    stubFetch(async () => Response.json({}));
    const { proxyToApi } = await loadProxy();

    await proxyToApi(
      request("/api/backend/apps", {
        headers: {
          "x-forwarded-for": "203.0.113.9",
          "x-real-ip": "203.0.113.9",
        },
      }),
      ["apps"],
    );

    const headers = fetchMock().mock.calls[0][1].headers as Headers;
    expect(headers.get("x-real-ip")).toBeNull();
    expect(headers.get("x-forwarded-for")).toBeNull();
  });

  it("appends only the address a trusted proxy observed", async () => {
    stubFetch(async () => Response.json({}));
    const { proxyToApi } = await loadProxy({ TRUST_PROXY: "1" });

    await proxyToApi(
      request("/api/backend/apps", {
        headers: { "x-forwarded-for": "203.0.113.9, 198.51.100.20" },
      }),
      ["apps"],
    );

    const headers = fetchMock().mock.calls[0][1].headers as Headers;
    expect(headers.get("x-forwarded-for")).toBe("198.51.100.20");
  });
});

describe("apiRoute", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("serves the metrics surface from the web origin at the same path", async () => {
    stubFetch(
      async () => new Response("# HELP asobeast_up\n", { status: 200 }),
    );
    const { apiRoute } = await loadProxy();

    const response = await apiRoute("metrics")(request("/metrics"));

    expect(fetchMock()).toHaveBeenCalledWith(
      `${API_BASE}/metrics`,
      expect.anything(),
    );
    expect(response.status).toBe(200);
  });

  it("binds the segments a route handler proxies to", async () => {
    stubFetch(async () => Response.json({ ok: true }));
    const { apiRoute } = await loadProxy();

    const response = await apiRoute("jobs", "budget")(request());

    expect(fetchMock()).toHaveBeenCalledWith(
      `${API_BASE}/jobs/budget`,
      expect.anything(),
    );
    await expect(response.json()).resolves.toEqual({ ok: true });
  });
});
