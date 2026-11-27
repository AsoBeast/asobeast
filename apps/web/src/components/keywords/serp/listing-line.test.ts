import { describe, expect, it } from "vitest";
import { listingLineOf, secondTextOf } from "./listing-line";

const SEGMENTS = [{ text: "Plan your day", match: "none" as const }];

describe("listingLineOf", () => {
  it("prefers the short description when the entry has one", () => {
    expect(
      listingLineOf({
        shortDescription: "Plan your day",
        shortDescriptionSegments: SEGMENTS,
      }),
    ).toEqual({
      text: "Plan your day",
      segments: SEGMENTS,
      surface: "shortDescription",
    });
  });

  it("falls back to the subtitle of a followed app", () => {
    expect(
      listingLineOf({
        subtitle: "Timer for deep work",
        subtitleSegments: SEGMENTS,
      }),
    ).toEqual({
      text: "Timer for deep work",
      segments: SEGMENTS,
      surface: "subtitle",
    });
  });

  it("draws no line for an unknown or empty second text", () => {
    expect(listingLineOf({})).toBeNull();
    expect(listingLineOf({ subtitle: null })).toBeNull();
    expect(listingLineOf({ subtitle: "" })).toBeNull();
  });
});

describe("secondTextOf", () => {
  it("reads the second text of the store", () => {
    const both = { subtitle: "S", shortDescription: "D" };

    expect(secondTextOf(both, "APP_STORE")).toBe("S");
    expect(secondTextOf(both, "GOOGLE_PLAY")).toBe("D");
    expect(
      secondTextOf({ shortDescription: "D" }, "APP_STORE"),
    ).toBeUndefined();
    expect(secondTextOf({ subtitle: "S" }, "GOOGLE_PLAY")).toBeUndefined();
  });
});
