import { describe, expect, it } from "vitest";
import { localizationsNote, marketListingsNote } from "./market-listings-note";

describe("marketListingsNote", () => {
  it("says nothing when no market listing is refreshed", () => {
    expect(marketListingsNote(0)).toBeNull();
    expect(marketListingsNote(undefined)).toBeNull();
  });

  it("names one market listing", () => {
    expect(marketListingsNote(1)).toBe(
      "1 of the app requests refreshes the listing of a market you track keywords in.",
    );
  });

  it("counts several market listings", () => {
    expect(marketListingsNote(12)).toBe(
      "12 of the app requests refresh the listing of a market you track keywords in.",
    );
  });
});

describe("localizationsNote", () => {
  it("says nothing when no native localization is read", () => {
    expect(localizationsNote(0)).toBeNull();
    expect(localizationsNote(undefined)).toBeNull();
  });

  it("names one localization read", () => {
    expect(localizationsNote(1)).toBe(
      "1 of the app requests reads a native localization of a storefront whose default is English.",
    );
  });

  it("counts several localization reads", () => {
    expect(localizationsNote(3)).toBe(
      "3 of the app requests read a native localization of a storefront whose default is English.",
    );
  });
});
