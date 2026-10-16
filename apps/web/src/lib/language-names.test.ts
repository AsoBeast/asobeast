import { describe, expect, it } from "vitest";
import {
  APP_STORE_LOCALIZATION_IDS,
  localizationLanguage,
} from "@asobeast/shared";
import { LANGUAGE_NAMES } from "./language-names";

describe("LANGUAGE_NAMES", () => {
  it("holds no language the app store names", () => {
    const named = new Set(APP_STORE_LOCALIZATION_IDS.map(localizationLanguage));

    expect(
      Object.keys(LANGUAGE_NAMES).filter((code) => named.has(code)),
    ).toEqual([]);
  });

  it("keys are lower case two or three letter codes with a name", () => {
    for (const [code, name] of Object.entries(LANGUAGE_NAMES)) {
      expect(code).toMatch(/^[a-z]{2,3}$/);
      expect(name.trim()).not.toBe("");
    }
  });
});
