import type { ApiErrorEnvelope, StoreSearchResult } from "@asobeast/shared";
import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api";
import {
  classifyInput,
  enterAction,
  isSearchable,
  isStoreAddress,
  searchErrorText,
} from "./store-search";

const result = (storeAppId: string): StoreSearchResult => ({
  storeAppId,
  title: `App ${storeAppId}`,
  developer: null,
  ratingAvg: null,
  ratingCount: null,
  iconUrl: null,
});

const apiError = (statusCode: number, message = "refused") =>
  new ApiError({
    statusCode,
    error: "Error",
    message,
    path: "/store/search",
    timestamp: "2026-10-14T00:00:00.000Z",
  } satisfies ApiErrorEnvelope);

describe("classifyInput", () => {
  it("reads blank text as empty", () => {
    expect(classifyInput("   ")).toEqual({ kind: "empty" });
  });

  it.each([
    [
      "a store url",
      "https://apps.apple.com/us/app/focus/id123456789",
      "APP_STORE",
    ],
    ["a bare app store id", "570060128", "APP_STORE"],
    ["a package name", "com.duolingo", "GOOGLE_PLAY"],
  ])("reads %s as a url", (_label, value, store) => {
    const input = classifyInput(value);

    expect(input.kind).toBe("url");
    expect(input.kind === "url" && input.parsed.store).toBe(store);
  });

  it("reads an address that is not a listing as invalid rather than a name", () => {
    const value = "https://apps.apple.com/us/developer/focus/id123456789";

    expect(classifyInput(value)).toEqual({
      kind: "invalid",
      message: `Unrecognized store URL or id: ${value}`,
    });
  });

  it.each(["focus timer", "Duolingo", "f"])("reads %s as a name", (value) => {
    expect(classifyInput(` ${value} `)).toEqual({ kind: "name", q: value });
  });
});

describe("isStoreAddress", () => {
  it("tells a store address apart from a bare id or package name", () => {
    expect(isStoreAddress("apps.apple.com/de/app/focus/id123456789")).toBe(
      true,
    );
    expect(isStoreAddress("https://play.google.com/store/apps")).toBe(true);
    expect(isStoreAddress("570060128")).toBe(false);
    expect(isStoreAddress("com.duolingo")).toBe(false);
    expect(isStoreAddress("2 Player Games")).toBe(false);
  });
});

describe("isSearchable", () => {
  it("searches a name of two characters or more", () => {
    expect(isSearchable(classifyInput("fo"))).toBe(true);
    expect(isSearchable(classifyInput("f"))).toBe(false);
    expect(isSearchable(classifyInput("com.duolingo"))).toBe(false);
  });
});

describe("enterAction", () => {
  it("does nothing while the search is still running or found nothing", () => {
    expect(enterAction([result("1")], false)).toEqual({ kind: "none" });
    expect(enterAction(undefined, true)).toEqual({ kind: "none" });
    expect(enterAction([], true)).toEqual({ kind: "none" });
  });

  it("picks the only result", () => {
    expect(enterAction([result("1")], true)).toEqual({
      kind: "pick",
      result: result("1"),
    });
  });

  it("moves to the list when there is a choice to make", () => {
    expect(enterAction([result("1"), result("2")], true)).toEqual({
      kind: "focus",
    });
  });
});

describe("searchErrorText", () => {
  it("passes a spent allowance through, because it names the wait", () => {
    const message =
      "Store lookup limit reached: the indie plan allows 60 requests per hour.";

    expect(searchErrorText(apiError(429, message))).toBe(message);
  });

  it("says the store did not answer on a bad gateway", () => {
    expect(searchErrorText(apiError(502))).toBe(
      "The store did not answer. Try again in a moment.",
    );
  });

  it("falls back to a plain sentence for anything else", () => {
    expect(searchErrorText(apiError(500))).toBe("Could not search the store.");
    expect(searchErrorText(new Error("offline"))).toBe(
      "Could not search the store.",
    );
  });
});
