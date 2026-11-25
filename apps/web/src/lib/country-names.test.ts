import {
  APP_STORE_STOREFRONTS,
  GOOGLE_PLAY_STOREFRONTS,
} from "@asobeast/shared";
import { describe, expect, it } from "vitest";
import { COUNTRY_NAMES, COUNTRY_NAMES_ZH } from "./country-names";

const STOREFRONTS = [
  ...new Set([...APP_STORE_STOREFRONTS, ...GOOGLE_PLAY_STOREFRONTS]),
];

describe("COUNTRY_NAMES", () => {
  it.each(STOREFRONTS)("names the storefront %s", (code) => {
    expect(COUNTRY_NAMES[code]).toBeTruthy();
  });

  it.each(Object.entries(COUNTRY_NAMES))(
    "names %s with words, not its own code",
    (code, name) => {
      expect(name.toLowerCase()).not.toBe(code);
      expect(name).toBe(name.trim());
    },
  );

  it("names only storefronts", () => {
    expect(Object.keys(COUNTRY_NAMES).sort()).toEqual([...STOREFRONTS].sort());
  });
});

describe("COUNTRY_NAMES_ZH", () => {
  it("covers exactly the same storefronts as English", () => {
    expect(Object.keys(COUNTRY_NAMES_ZH).sort()).toEqual(
      Object.keys(COUNTRY_NAMES).sort(),
    );
  });

  it.each([
    ["cn", "中国"],
    ["tw", "台湾"],
    ["hk", "香港"],
    ["us", "美国"],
    ["gb", "英国"],
    ["de", "德国"],
    ["jp", "日本"],
  ])("names %s in Simplified Chinese", (code, expected) => {
    expect(COUNTRY_NAMES_ZH[code]).toBe(expected);
  });
});
