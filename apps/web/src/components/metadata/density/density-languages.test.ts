import { describe, expect, it } from "vitest";
import { densityLanguage } from "./density-languages";

describe("densityLanguage", () => {
  it("reads the language of an App Store localization", () => {
    expect(densityLanguage("APP_STORE", "us", "en-US")).toBe("en");
    expect(densityLanguage("APP_STORE", "br", "pt-BR")).toBe("pt");
    expect(densityLanguage("APP_STORE", "cn", "zh-Hans")).toBe("zh");
  });

  it("reads the default localization of the market when none is open", () => {
    expect(densityLanguage("APP_STORE", "us", undefined)).toBe("en");
    expect(densityLanguage("APP_STORE", "de", undefined)).toBe("de");
  });

  it("reads the storefront language on Google Play", () => {
    expect(densityLanguage("GOOGLE_PLAY", "de", null)).toBe("de");
    expect(densityLanguage("GOOGLE_PLAY", "zz", null)).toBeNull();
  });
});
