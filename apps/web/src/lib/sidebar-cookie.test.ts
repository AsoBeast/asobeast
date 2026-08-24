import { describe, expect, it } from "vitest";
import { SIDEBAR_COOKIE_NAME, sidebarOpenFromCookie } from "./sidebar-cookie";
import { SESSION_COOKIE } from "@asobeast/shared";

describe("sidebarOpenFromCookie", () => {
  it("collapses the sidebar when the stored state is false", () => {
    expect(sidebarOpenFromCookie("false")).toBe(false);
  });

  it("expands the sidebar for a stored true and for a first visit", () => {
    expect(sidebarOpenFromCookie("true")).toBe(true);
    expect(sidebarOpenFromCookie(undefined)).toBe(true);
  });
});

describe("SIDEBAR_COOKIE_NAME", () => {
  it("does not collide with the session cookie", () => {
    expect(SIDEBAR_COOKIE_NAME).not.toBe(SESSION_COOKIE);
  });
});
