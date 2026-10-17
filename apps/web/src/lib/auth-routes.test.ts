import { describe, expect, it } from "vitest";
import { loginUrl, signInTarget, signedInDestination } from "./auth-routes";

describe("signedInDestination", () => {
  it.each([null, undefined, ""])("sends %p to the dashboard", (next) => {
    expect(signedInDestination(next)).toBe("/");
  });

  it("keeps a same origin path with its query and hash", () => {
    expect(signedInDestination("/apps/a1/keywords?country=us#top")).toBe(
      "/apps/a1/keywords?country=us#top",
    );
  });

  it.each([
    "https://evil.example/apps",
    "//evil.example/apps",
    "/\\evil.example",
    "javascript:alert(1)",
    "/.//evil.example",
    "/..//evil.example",
    "/%2e//evil.example",
    "/./\\evil.example",
    "/apps/..//evil.example",
  ])("refuses the cross origin destination %s", (next) => {
    expect(signedInDestination(next)).toBe("/");
  });

  it.each(["/login", "/login?next=%2Flogin", "/register"])(
    "refuses the public route %s so a signed in viewer cannot loop on it",
    (next) => {
      expect(signedInDestination(next)).toBe("/");
    },
  );

  it("returns to the upgrade page after sign in", () => {
    expect(signedInDestination("/upgrade")).toBe("/upgrade");
  });
});

describe("signInTarget", () => {
  it("keeps the requested path and query as an encoded next parameter", () => {
    expect(signInTarget("/charts?store=APP_STORE&genre=6011")).toBe(
      "/login?next=%2Fcharts%3Fstore%3DAPP_STORE%26genre%3D6011",
    );
  });

  it("omits next for the root path", () => {
    expect(signInTarget("/")).toBe("/login");
  });

  it.each(["/login", "/login?next=%2Fsettings", "/register"])(
    "sends nobody away from the public route %s",
    (requested) => {
      expect(signInTarget(requested)).toBeNull();
    },
  );

  it.each([
    "https://evil.example/apps",
    "//evil.example/apps",
    "/\\evil.example",
    "apps",
    "",
  ])("refuses the value %p that is not a path of this site", (requested) => {
    expect(signInTarget(requested)).toBeNull();
  });
});

describe("loginUrl", () => {
  it("builds the same address from a path and a query", () => {
    expect(loginUrl("/apps/app-1/keywords", "?sort=position")).toBe(
      "/login?next=%2Fapps%2Fapp-1%2Fkeywords%3Fsort%3Dposition",
    );
  });
});
