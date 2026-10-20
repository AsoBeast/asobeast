import { describe, expect, it } from "vitest";
import { isProxiedSurface, undecodableSegment } from "./malformed-path";

describe("undecodableSegment", () => {
  it.each([
    ["/apps/ok", null],
    ["/apps/a%20b", null],
    ["/x/%F0%9F%98%80", null],
    ["/x/%2F", null],
    ["/apps/%zz", "%zz"],
    ["/x/%", "%"],
    ["/a/%E0%A4%A/b", "%E0%A4%A"],
    ["/x/%C0%AF", "%C0%AF"],
    ["/x/%ED%A0%80", "%ED%A0%80"],
    ["/ok/%41/%zz/%zy", "%zz"],
  ])("reads %s as %p", (pathname, segment) => {
    expect(undecodableSegment(pathname)).toBe(segment);
  });
});

describe("isProxiedSurface", () => {
  it.each([
    "/api/backend/apps",
    "/docs/swagger-ui.css",
    "/admin/queues/x",
    "/.well-known/a",
  ])("knows %s", (pathname) => {
    expect(isProxiedSurface(pathname)).toBe(true);
  });

  it.each(["/apps/abc", "/docs", "/docsx/a", "/api/health", "/metrics"])(
    "does not know %s",
    (pathname) => {
      expect(isProxiedSurface(pathname)).toBe(false);
    },
  );
});
