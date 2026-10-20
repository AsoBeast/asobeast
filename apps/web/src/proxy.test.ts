import type { ApiErrorEnvelope } from "@asobeast/shared";
import { SESSION_COOKIE } from "@asobeast/shared";
import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { config, proxy } from "./proxy";

function matched(pathname: string): boolean {
  return unstable_doesMiddlewareMatch({
    config,
    url: `http://web.local${pathname}`,
  });
}

function request(path: string, withSession = false): NextRequest {
  return new NextRequest(`http://web.local${path}`, {
    headers: withSession ? { cookie: `${SESSION_COOKIE}=x` } : {},
  });
}

describe("the proxy matcher", () => {
  it.each([
    "/apps/abc",
    "/apps/%zz",
    "/settings",
    "/api/backend/x%zz",
    "/api/backend/%",
    "/api/backend/%E0%A4%A",
    "/api/backend/%C0%AF",
    "/api/backend/%ed%a0%80",
    "/docs/%zz",
    "/admin/queues/%zz",
    "/.well-known/%zz",
  ])("runs for %s", (pathname) => {
    expect(matched(pathname)).toBe(true);
  });

  it.each([
    "/api/backend/apps",
    "/api/backend/mcp",
    "/api/backend/a%20b",
    "/api/backend/apps/a%2Fb",
    "/api/backend/%2e%2e/admin",
    "/docs",
    "/docs/swagger-ui.css",
    "/docs-json/%zz",
    "/admin/queues/api/queues",
    "/.well-known/oauth-protected-resource",
    "/metrics",
    "/login",
    "/login/%zz",
    "/_next/static/%zz",
  ])("does not run for %s", (pathname) => {
    expect(matched(pathname)).toBe(false);
  });
});

describe("a path that cannot be decoded", () => {
  it.each([false, true])(
    "answers the api envelope under /api/backend, session %s",
    async (withSession) => {
      const response = proxy(
        request("/api/backend/apps/%zz?token=secret", withSession),
      );

      expect(response.status).toBe(400);
      const envelope = (await response.json()) as ApiErrorEnvelope;
      expect(envelope).toMatchObject({
        statusCode: 400,
        error: "Bad Request",
        message: "Failed to decode param '%zz'",
        path: "/api/backend/apps/%zz",
      });
      expect(JSON.stringify(envelope)).not.toContain("secret");
    },
  );

  it.each(["/docs/%zz", "/admin/queues/%zz", "/.well-known/%zz"])(
    "answers the hidden not found at %s",
    async (path) => {
      const response = proxy(request(path));

      expect(response.status).toBe(404);
      expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow");
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(await response.json()).toMatchObject({
        message: `Cannot GET ${path}`,
        path,
      });
    },
  );

  it.each([false, true])(
    "rewrites a page to the not found page, session %s",
    (withSession) => {
      const response = proxy(request("/apps/x%zz/keywords", withSession));

      expect(response.headers.get("x-middleware-rewrite")).toBe(
        "http://web.local/malformed-path",
      );
      expect(response.headers.get("location")).toBeNull();
    },
  );
});

describe("a path that can be decoded", () => {
  it("lets a valid escape on a proxied surface through without a sign in", () => {
    const response = proxy(request("/api/backend/apps/a%20b"));

    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(response.headers.get("location")).toBeNull();
  });

  it("still sends a visitor without a session to sign in", () => {
    const response = proxy(request("/apps/abc"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "http://web.local/login?next=%2Fapps%2Fabc",
    );
  });

  it("still forwards the requested path for a visitor with a session", () => {
    const response = proxy(request("/apps/abc?sort=position", true));

    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(response.headers.get("x-middleware-override-headers")).toContain(
      "x-asobeast-requested-path",
    );
  });
});
