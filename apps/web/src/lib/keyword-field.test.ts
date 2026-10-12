import { describe, expect, it } from "vitest";
import {
  fieldLocalization,
  keywordFieldHref,
  keywordFieldQuery,
} from "./keyword-field";

describe("keywordFieldQuery", () => {
  it("leaves the home market and its default localization out", () => {
    expect(keywordFieldQuery("us", "us", null)).toEqual({});
    expect(keywordFieldQuery("us", "us", "en-US")).toEqual({});
  });

  it("names a localization other than the default", () => {
    expect(keywordFieldQuery("us", "us", "es-MX")).toEqual({
      localization: "es-MX",
    });
  });

  it("names a market other than home", () => {
    expect(keywordFieldQuery("us", "de", null)).toEqual({ country: "de" });
    expect(keywordFieldQuery("us", "de", "en-GB")).toEqual({
      country: "de",
      localization: "en-GB",
    });
  });

  it("falls back to the default when the market does not read the request", () => {
    expect(fieldLocalization("us", "de", "es-MX")).toBe("de");
    expect(keywordFieldQuery("us", "de", "es-MX")).toEqual({ country: "de" });
  });
});

describe("fieldLocalization", () => {
  it("keeps an english (u.k.) field for a home country that is no storefront", () => {
    expect(fieldLocalization("uk", "uk", null)).toBe("en-GB");
    expect(keywordFieldQuery("uk", "uk", null)).toEqual({});
  });

  it("offers no field in a market that is no storefront", () => {
    expect(fieldLocalization("us", "zz", null)).toBeUndefined();
  });
});

describe("keywordFieldHref", () => {
  it("opens the home default field without a query", () => {
    expect(keywordFieldHref("app-1", "us", "us", "en-US")).toBe(
      "/apps/app-1/keywords",
    );
  });

  it("opens a localized field of another market", () => {
    expect(keywordFieldHref("app-1", "us", "pl", "pl")).toBe(
      "/apps/app-1/keywords?country=pl&fieldLocale=pl",
    );
  });
});
