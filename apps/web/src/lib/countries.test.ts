import { DEFAULT_COUNTRY, isStorefront, STORES } from "@asobeast/shared";
import { describe, expect, it } from "vitest";
import { COUNTRY_OPTIONS, marketError, OTHER } from "./countries";

describe("COUNTRY_OPTIONS", () => {
  it.each(
    STORES.flatMap((store) =>
      COUNTRY_OPTIONS.map((code) => [store, code] as const),
    ),
  )("offers only storefronts of %s, including %s", (store, code) => {
    expect(isStorefront(store, code)).toBe(true);
  });

  it("lists the default storefront", () => {
    expect(COUNTRY_OPTIONS).toContain(DEFAULT_COUNTRY);
  });

  it("lists every storefront once", () => {
    expect(new Set(COUNTRY_OPTIONS).size).toBe(COUNTRY_OPTIONS.length);
  });
});

describe("OTHER", () => {
  it.each(STORES)("cannot collide with a storefront of %s", (store) => {
    expect(isStorefront(store, OTHER)).toBe(false);
  });

  it("is not offered as a storefront", () => {
    expect(COUNTRY_OPTIONS).not.toContain(OTHER);
  });
});

describe("marketError", () => {
  it.each([
    ["APP_STORE", "us"],
    ["APP_STORE", "pw"],
    ["APP_STORE", "xk"],
    ["GOOGLE_PLAY", "ad"],
  ] as const)("accepts the %s storefront %s", (store, code) => {
    expect(marketError(store, code)).toBeNull();
  });

  it.each(["US", "usa", "u", "", " us", "u1"])(
    "asks for a two letter code instead of %j",
    (code) => {
      expect(marketError("APP_STORE", code)).toBe(
        "Market must be a two letter code, e.g. us",
      );
    },
  );

  it.each([
    ["APP_STORE", "zz", "zz is not an App Store storefront"],
    ["APP_STORE", "ad", "ad is not an App Store storefront"],
    ["GOOGLE_PLAY", "pw", "pw is not a Google Play location"],
  ] as const)("refuses the %s market %s", (store, code, message) => {
    expect(marketError(store, code)).toBe(message);
  });
});
