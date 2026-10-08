import { describe, expect, it } from "vitest";
import { signedInDestination } from "./auth-routes";

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

  it.each(["/login", "/login?next=%2Flogin", "/register", "/upgrade"])(
    "refuses the public route %s so a signed in viewer cannot loop on it",
    (next) => {
      expect(signedInDestination(next)).toBe("/");
    },
  );
});
