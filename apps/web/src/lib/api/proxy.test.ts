import {
  REQUEST_BODY_LIMIT_BYTES,
  type ApiErrorEnvelope,
} from "@asobeast/shared";
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

const CHUNK_BYTES = 16 * 1024;
const CHUNK_COUNT = 1000;
const STREAM_PREFETCH_PULLS = 1;

function countedStream(): {
  stream: ReadableStream<Uint8Array>;
  pulls: () => number;
  cancelled: () => boolean;
} {
  let pulled = 0;
  let wasCancelled = false;
  const chunk = new Uint8Array(CHUNK_BYTES).fill(0x78);
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      pulled += 1;
      if (pulled > CHUNK_COUNT) {
        controller.close();
        return;
      }
      controller.enqueue(chunk);
    },
    cancel() {
      wasCancelled = true;
    },
  });
  return { stream, pulls: () => pulled, cancelled: () => wasCancelled };
}

function streamedRequest(
  stream: ReadableStream<Uint8Array>,
  headers: Record<string, string> = {},
): NextRequest {
  return request("/api/backend/apps", {
    method: "POST",
    headers,
    body: stream,
    duplex: "half",
  } as NextRequestInit);
}

function sentBody(): Uint8Array {
  return fetchMock().mock.calls[0][1].body as Uint8Array;
}

function stubFetch(implementation: typeof fetch): void {
  vi.stubGlobal("fetch", vi.fn(implementation));
}

function stubFetchUntilAborted(): void {
  stubFetch(
    (_input, init) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener(
          "abort",
          () => reject(init.signal?.reason),
          { once: true },
        );
      }),
  );
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
    vi.useRealTimers();
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

  it("returns the wait and the rate limit window to the caller", async () => {
    stubFetch(async () =>
      Response.json(
        { statusCode: 429 },
        {
          status: 429,
          headers: {
            "retry-after": "34",
            "ratelimit-limit": "60",
            "ratelimit-remaining": "0",
            "ratelimit-reset": "34",
          },
        },
      ),
    );
    const { proxyToApi } = await loadProxy();

    const response = await proxyToApi(request(), ["apps"]);

    expect(response.headers.get("retry-after")).toBe("34");
    expect(response.headers.get("ratelimit-limit")).toBe("60");
    expect(response.headers.get("ratelimit-remaining")).toBe("0");
    expect(response.headers.get("ratelimit-reset")).toBe("34");
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

  it("keeps a decoded segment inside the path it was sent in", async () => {
    stubFetch(async () => Response.json({}));
    const { proxyToApi } = await loadProxy();

    await proxyToApi(request("/api/backend/email-alerts", { method: "POST" }), [
      "email-alerts",
      "../../auth/logout#",
      "unsubscribe",
    ]);

    expect(fetchMock()).toHaveBeenCalledWith(
      `${API_BASE}/email-alerts/..%2F..%2Fauth%2Flogout%23/unsubscribe`,
      expect.anything(),
    );
  });

  it.each([["."], [".."]])(
    "refuses a %s segment instead of letting it climb the path",
    async (segment) => {
      stubFetch(async () => Response.json({}));
      const { proxyToApi } = await loadProxy();

      const response = await proxyToApi(
        request("/api/backend/email-alerts", { method: "POST" }),
        ["email-alerts", segment, "auth", "logout"],
      );

      expect(response.status).toBe(404);
      expect(fetchMock()).not.toHaveBeenCalled();
    },
  );

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

  it.each([
    ["allow", "POST", 405],
    ["www-authenticate", 'Bearer realm="asobeast"', 401],
  ])(
    "returns the %s header the api answered with",
    async (name, value, status) => {
      stubFetch(async () =>
        Response.json({}, { status, headers: { [name]: value } }),
      );
      const { proxyToApi } = await loadProxy();

      const response = await proxyToApi(request("/api/backend/mcp"), ["mcp"]);

      expect(response.headers.get(name)).toBe(value);
    },
  );

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

    expect(new TextDecoder().decode(sentBody())).toBe(
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

  it("answers an api that never responds within the configured deadline with a 504", async () => {
    stubFetchUntilAborted();
    const { proxyToApi } = await loadProxy({ API_PROXY_TIMEOUT_MS: "20" });

    const response = await proxyToApi(request("/api/backend/apps"), ["apps"]);

    expect(response.status).toBe(504);
    await expect(response.json()).resolves.toMatchObject({
      error: "Gateway Timeout",
      path: "/api/backend/apps",
    });
  });

  it("streams a response body that outlives the header deadline", async () => {
    stubFetch(async (_input, init) => {
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          const encoder = new TextEncoder();
          controller.enqueue(encoder.encode(": open\n\n"));
          const finish = setTimeout(() => {
            controller.enqueue(encoder.encode("event: message\ndata: {}\n\n"));
            controller.close();
          }, 60);
          init?.signal?.addEventListener("abort", () => {
            clearTimeout(finish);
            controller.error(init.signal?.reason);
          });
        },
      });
      return new Response(body, {
        headers: { "content-type": "text/event-stream" },
      });
    });
    const { proxyToApi } = await loadProxy({ API_PROXY_TIMEOUT_MS: "20" });

    const response = await proxyToApi(
      request("/api/backend/mcp", { method: "POST", body: "{}" }),
      ["mcp"],
    );

    expect(response.headers.get("content-type")).toBe("text/event-stream");
    await expect(response.text()).resolves.toContain("event: message");
  });

  it("aborts the upstream request when the client goes away", async () => {
    let upstreamSignal: AbortSignal | undefined;
    stubFetch(async (_input, init) => {
      upstreamSignal = init?.signal ?? undefined;
      return new Response(new ReadableStream(), {
        headers: { "content-type": "text/event-stream" },
      });
    });
    const { proxyToApi } = await loadProxy();
    const client = new AbortController();

    await proxyToApi(
      request("/api/backend/mcp", {
        method: "POST",
        body: "{}",
        signal: client.signal,
      }),
      ["mcp"],
    );
    client.abort();

    expect(upstreamSignal?.aborted).toBe(true);
  });

  it("clears the header deadline once the api answers", async () => {
    vi.useFakeTimers();
    stubFetch(async () => Response.json({}));
    const { proxyToApi } = await loadProxy();

    await proxyToApi(request(), ["apps"]);

    expect(vi.getTimerCount()).toBe(0);
  });

  it("waits the documented 30 seconds for the api by default", async () => {
    vi.useFakeTimers();
    stubFetchUntilAborted();
    const { proxyToApi } = await loadProxy();
    let settled = false;

    const pending = proxyToApi(request(), ["apps"]).finally(() => {
      settled = true;
    });
    await vi.advanceTimersByTimeAsync(29_999);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);

    await expect(pending).resolves.toHaveProperty("status", 504);
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

    expect(sentBody()).toEqual(new TextEncoder().encode(payload));
  });

  it("forwards bytes that are not valid text unchanged", async () => {
    stubFetch(async () => Response.json({ received: true }));
    const { proxyToApi } = await loadProxy();
    const payload = new Uint8Array([0xef, 0xbb, 0xbf, 0x7b, 0xff, 0x7d]);

    await proxyToApi(
      request("/api/backend/billing/webhook", {
        method: "POST",
        body: payload,
      }),
      ["billing", "webhook"],
    );

    expect(sentBody()).toEqual(payload);
  });
});

describe("proxyToApi request body limit", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("refuses a declared body over the limit without reading any of it", async () => {
    stubFetch(async () => Response.json({}));
    const { proxyToApi } = await loadProxy();
    const { stream, pulls } = countedStream();

    const response = await proxyToApi(
      streamedRequest(stream, {
        "content-length": String(REQUEST_BODY_LIMIT_BYTES + 1),
      }),
      ["apps"],
    );

    expect(response.status).toBe(413);
    const envelope = (await response.json()) as ApiErrorEnvelope;
    expect(envelope).toMatchObject({
      statusCode: 413,
      error: "Payload Too Large",
      path: "/api/backend/apps",
    });
    expect(pulls()).toBeLessThanOrEqual(STREAM_PREFETCH_PULLS);
    expect(fetchMock()).not.toHaveBeenCalled();
  });

  it("stops reading a chunked body once it passes the limit", async () => {
    stubFetch(async () => Response.json({}));
    const { proxyToApi } = await loadProxy();
    const { stream, pulls } = countedStream();

    const response = await proxyToApi(streamedRequest(stream), ["apps"]);

    expect(response.status).toBe(413);
    expect(pulls()).toBeLessThan(
      Math.ceil(REQUEST_BODY_LIMIT_BYTES / CHUNK_BYTES) + 4,
    );
    expect(fetchMock()).not.toHaveBeenCalled();
  });

  it("cancels the rest of a chunked body it refuses", async () => {
    stubFetch(async () => Response.json({}));
    const { proxyToApi } = await loadProxy();
    const { stream, cancelled } = countedStream();

    await proxyToApi(streamedRequest(stream), ["apps"]);

    expect(cancelled()).toBe(true);
  });

  it("still refuses a chunked body whose source fails to cancel", async () => {
    stubFetch(async () => Response.json({}));
    const { proxyToApi } = await loadProxy();
    const chunk = new Uint8Array(REQUEST_BODY_LIMIT_BYTES + 1);
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        controller.enqueue(chunk);
      },
      cancel() {
        throw new Error("source refused to cancel");
      },
    });

    const response = await proxyToApi(streamedRequest(stream), ["apps"]);

    expect(response.status).toBe(413);
  });

  it("closes the connection after refusing a body it did not read", async () => {
    stubFetch(async () => Response.json({}));
    const { proxyToApi } = await loadProxy();

    const response = await proxyToApi(streamedRequest(countedStream().stream), [
      "apps",
    ]);

    expect(response.headers.get("connection")).toBe("close");
  });

  it("forwards a body of exactly the limit", async () => {
    stubFetch(async () => Response.json({}));
    const { proxyToApi } = await loadProxy();

    const response = await proxyToApi(
      request("/api/backend/apps", {
        method: "POST",
        body: "x".repeat(REQUEST_BODY_LIMIT_BYTES),
      }),
      ["apps"],
    );

    expect(response.status).toBe(200);
    expect(sentBody().byteLength).toBe(REQUEST_BODY_LIMIT_BYTES);
  });

  it("forwards a chunked body of exactly the limit", async () => {
    stubFetch(async () => Response.json({}));
    const { proxyToApi } = await loadProxy();
    const remaining = [
      ...Array.from(
        { length: Math.floor(REQUEST_BODY_LIMIT_BYTES / CHUNK_BYTES) },
        () => CHUNK_BYTES,
      ),
      REQUEST_BODY_LIMIT_BYTES % CHUNK_BYTES,
    ].filter((size) => size > 0);
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        const size = remaining.shift();
        if (size === undefined) controller.close();
        else controller.enqueue(new Uint8Array(size));
      },
    });

    const response = await proxyToApi(streamedRequest(stream), ["apps"]);

    expect(response.status).toBe(200);
    expect(sentBody().byteLength).toBe(REQUEST_BODY_LIMIT_BYTES);
  });

  it("forwards nothing when the body fails mid stream", async () => {
    stubFetch(async () => Response.json({}));
    const { proxyToApi } = await loadProxy();
    const failure = new Error("client hung up");
    let pulled = 0;
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulled += 1;
        if (pulled > 1) controller.error(failure);
        else controller.enqueue(new Uint8Array(CHUNK_BYTES));
      },
    });

    await expect(proxyToApi(streamedRequest(stream), ["apps"])).rejects.toBe(
      failure,
    );
    expect(fetchMock()).not.toHaveBeenCalled();
  });

  it("refuses a body one byte over the limit", async () => {
    stubFetch(async () => Response.json({}));
    const { proxyToApi } = await loadProxy();

    const response = await proxyToApi(
      request("/api/backend/apps", {
        method: "POST",
        body: "x".repeat(REQUEST_BODY_LIMIT_BYTES + 1),
      }),
      ["apps"],
    );

    expect(response.status).toBe(413);
    expect(fetchMock()).not.toHaveBeenCalled();
  });

  it("sends an empty body for a mutating request that carries none", async () => {
    stubFetch(async () => Response.json({}));
    const { proxyToApi } = await loadProxy();

    await proxyToApi(request("/api/backend/apps", { method: "POST" }), [
      "apps",
    ]);

    expect(sentBody().byteLength).toBe(0);
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
