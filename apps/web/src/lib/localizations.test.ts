import { describe, expect, it } from "vitest";
import {
  extraRoom,
  LOCALIZED_FIELDS_NOTE,
  storefrontRows,
} from "./localizations";

describe("storefrontRows", () => {
  it("puts the home storefront first and keeps the markets in order", () => {
    const rows = storefrontRows("us", ["us", "pl", "gb"]);

    expect(rows).toMatchObject([
      { country: "us", home: true, primary: "en-US" },
      { country: "pl", home: false, primary: "en-GB", additional: ["pl"] },
      { country: "gb", home: false, primary: "en-GB", additional: [] },
    ]);
    expect(rows[0].additional).toHaveLength(9);
  });

  it("skips a code with no storefront and lists the home first wherever it appears", () => {
    expect(
      storefrontRows("us", ["zz", "pl"]).map((row) => row.country),
    ).toEqual(["us", "pl"]);
    expect(
      storefrontRows("pl", ["us", "pl"]).map((row) => row.country),
    ).toEqual(["pl", "us"]);
  });
});

describe("extraRoom", () => {
  it("counts the extra fields of several localizations", () => {
    expect(extraRoom(9, "us")).toBe(
      "9 more localizations: 9 more titles, subtitles and keyword fields that US search reads",
    );
  });

  it("speaks of one localization in the singular", () => {
    expect(extraRoom(1, "pl")).toBe(
      "1 more localization: 1 more title, subtitle and keyword field that PL search reads",
    );
  });
});

describe("LOCALIZED_FIELDS_NOTE", () => {
  it("reads every limit from the shared field limits", () => {
    expect(LOCALIZED_FIELDS_NOTE).toBe(
      "Each localization has its own 30 character title, 30 character subtitle and 100 byte keyword field.",
    );
  });
});
