import { DEFAULT_COUNTRY } from "@asobeast/shared";
import { describe, expect, it } from "vitest";
import { COUNTRY_CODE, COUNTRY_OPTIONS, OTHER } from "./countries";

describe("COUNTRY_CODE", () => {
  it.each(["us", "gb", "jp"])("accepts the storefront %s", (code) => {
    expect(COUNTRY_CODE.test(code)).toBe(true);
  });

  it.each(["US", "Us", "usa", "u", "", "u1", "u-", " us", "us "])(
    "rejects %s",
    (code) => {
      expect(COUNTRY_CODE.test(code)).toBe(false);
    },
  );

  it("is anchored so it cannot match inside a longer string", () => {
    expect(COUNTRY_CODE.test("aus\nus")).toBe(false);
  });
});

describe("COUNTRY_OPTIONS", () => {
  it.each(COUNTRY_OPTIONS)("offers %s as a valid storefront", (code) => {
    expect(COUNTRY_CODE.test(code)).toBe(true);
  });

  it("lists the default storefront", () => {
    expect(COUNTRY_OPTIONS).toContain(DEFAULT_COUNTRY);
  });

  it("lists every storefront once", () => {
    expect(new Set(COUNTRY_OPTIONS).size).toBe(COUNTRY_OPTIONS.length);
  });
});

describe("OTHER", () => {
  it("cannot collide with a storefront code", () => {
    expect(COUNTRY_CODE.test(OTHER)).toBe(false);
  });

  it("is not offered as a storefront", () => {
    expect(COUNTRY_OPTIONS).not.toContain(OTHER);
  });
});
