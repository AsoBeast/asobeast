import {
  APP_STORE_STOREFRONTS,
  GOOGLE_PLAY_STOREFRONTS,
} from "@asobeast/shared";
import { describe, expect, it } from "vitest";
import { COUNTRY_NAMES } from "./country-names";

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
