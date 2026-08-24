import type { ApiErrorEnvelope } from "@asobeast/shared";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, apiFetch, loginUrl, withQuery } from "./client";

function stubFetch(implementation: typeof fetch): void {
  vi.stubGlobal("fetch", vi.fn(implementation));
}

const ENVELOPE: ApiErrorEnvelope = {
  statusCode: 404,
  error: "Not Found",
  message: "App not found",
  path: "/apps/missing",
  timestamp: "2026-01-01T00:00:00.000Z",
};

describe("loginUrl", () => {
  it("keeps the requested path and query as an encoded next parameter", () => {
    expect(loginUrl("/apps/app-1/keywords", "?sort=position")).toBe(
      "/login?next=%2Fapps%2Fapp-1%2Fkeywords%3Fsort%3Dposition",
    );
  });

  it("keeps a path without a query string", () => {
    expect(loginUrl("/settings", "")).toBe("/login?next=%2Fsettings");
  });

  it("omits next for the root path", () => {
    expect(loginUrl("/", "")).toBe("/login");
  });
});

describe("withQuery", () => {
  it("omits the separator when no parameter is set", () => {
    expect(withQuery("/apps", new URLSearchParams())).toBe("/apps");
  });

  it("appends the parameters that are set", () => {
    const params = new URLSearchParams();
    params.set("sort", "traffic");
    params.set("country", "us");
    expect(withQuery("/apps/app-1/keywords", params)).toBe(
      "/apps/app-1/keywords?sort=traffic&country=us",
    );
  });

  it("encodes a value that needs escaping", () => {
    const params = new URLSearchParams();
    params.set("term", "fitness & health");
    expect(withQuery("/spider", params)).toBe(
      "/spider?term=fitness+%26+health",
    );
  });

  it("keeps repeated parameters rather than collapsing them", () => {
    const params = new URLSearchParams();
    params.append("keywordIds", "kw-1");
    params.append("keywordIds", "kw-2");
    expect(withQuery("/rankings", params)).toBe(
      "/rankings?keywordIds=kw-1&keywordIds=kw-2",
    );
  });
});

describe("apiFetch", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("resolves the parsed body of a successful response", async () => {
    stubFetch(async () => Response.json({ id: "app-1" }));
    await expect(apiFetch<{ id: string }>("/apps/app-1")).resolves.toEqual({
      id: "app-1",
    });
  });

  it("resolves without parsing a 204 body", async () => {
    stubFetch(async () => new Response(null, { status: 204 }));
    await expect(apiFetch("/apps/app-1")).resolves.toBeUndefined();
  });

  it("throws an ApiError carrying the status and the envelope", async () => {
    stubFetch(async () => Response.json(ENVELOPE, { status: 404 }));

    const error = await apiFetch("/apps/missing").catch(
      (thrown: unknown) => thrown,
    );

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).envelope).toEqual(ENVELOPE);
    expect((error as ApiError).envelope.statusCode).toBe(404);
    expect((error as ApiError).message).toBe("App not found");
    expect((error as ApiError).name).toBe("ApiError");
  });

  it("throws an ApiError when a gateway answers with a non-json body", async () => {
    stubFetch(
      async () =>
        new Response("<html><body>502 Bad Gateway</body></html>", {
          status: 502,
          headers: { "content-type": "text/html" },
        }),
    );

    const error = await apiFetch("/apps").catch((thrown: unknown) => thrown);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).envelope.statusCode).toBe(502);
    expect((error as ApiError).envelope.path).toBe("/apps");
  });

  it.each([
    ["a json null body", null],
    ["a json array body", ["nope"]],
    ["a json string body", "gateway error"],
    ["a partial envelope", { message: "nope" }],
    [
      "an envelope with a non-numeric status",
      { ...ENVELOPE, statusCode: "404" },
    ],
  ])("falls back to a typed envelope for %s", async (_name, body) => {
    stubFetch(async () => Response.json(body, { status: 502 }));

    const error = await apiFetch("/apps").catch((thrown: unknown) => thrown);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).envelope.statusCode).toBe(502);
    expect((error as ApiError).envelope.path).toBe("/apps");
    expect((error as ApiError).message).toBeTruthy();
  });

  it.each(["/register", "/login", "/upgrade"])(
    "does not navigate away from %s when a query is rejected",
    async (pathname) => {
      const assign = vi.fn();
      vi.stubGlobal("window", {
        location: { pathname, search: "", assign },
      });
      stubFetch(async () => Response.json(ENVELOPE, { status: 401 }));

      await apiFetch("/actions/summary").catch(() => undefined);

      expect(assign).not.toHaveBeenCalled();
    },
  );

  it.each([401, 402])(
    "sends a guarded page to the right destination for %i",
    async (status) => {
      const assign = vi.fn();
      vi.stubGlobal("window", {
        location: { pathname: "/settings", search: "", assign },
      });
      stubFetch(async () => Response.json(ENVELOPE, { status }));

      await apiFetch("/actions/summary").catch(() => undefined);

      expect(assign).toHaveBeenCalledWith(
        status === 401 ? "/login?next=%2Fsettings" : "/upgrade",
      );
    },
  );

  it("sends json by default", async () => {
    stubFetch(async () => Response.json({}));
    await apiFetch("/apps");

    const [, init] = (globalThis.fetch as unknown as ReturnType<typeof vi.fn>)
      .mock.calls[0];
    expect((init.headers as Headers).get("content-type")).toBe(
      "application/json",
    );
    expect(init.cache).toBe("no-store");
  });

  it("lets a caller override a default header", async () => {
    stubFetch(async () => Response.json({}));
    await apiFetch("/apps", { headers: { "content-type": "text/csv" } });

    const [, init] = (globalThis.fetch as unknown as ReturnType<typeof vi.fn>)
      .mock.calls[0];
    expect((init.headers as Headers).get("content-type")).toBe("text/csv");
  });
});

describe("ApiError", () => {
  it("keeps the envelope reachable from a caught error", () => {
    const error = new ApiError(ENVELOPE);
    expect(error).toBeInstanceOf(Error);
    expect(error.envelope.path).toBe("/apps/missing");
  });
});
