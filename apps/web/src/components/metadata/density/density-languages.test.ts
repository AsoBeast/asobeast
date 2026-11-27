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

  it("reads the language of the localizations that have function words", () => {
    expect(densityLanguage("APP_STORE", "ru", "ru")).toBe("ru");
    expect(densityLanguage("APP_STORE", "ua", "uk")).toBe("uk");
    expect(densityLanguage("APP_STORE", "kr", "ko")).toBe("ko");
    expect(densityLanguage("APP_STORE", "sa", "ar")).toBe("ar");
    expect(densityLanguage("APP_STORE", "th", "th")).toBe("th");
  });

  it("reads the default localization of a Russian or Korean market", () => {
    expect(densityLanguage("APP_STORE", "ru", undefined)).toBe("ru");
    expect(densityLanguage("APP_STORE", "kr", undefined)).toBe("ko");
  });

  it("reads the storefront language on Google Play", () => {
    expect(densityLanguage("GOOGLE_PLAY", "de", null)).toBe("de");
    expect(densityLanguage("GOOGLE_PLAY", "zz", null)).toBeNull();
  });

  it("reads the storefront language of the Google Play markets that have function words", () => {
    expect(densityLanguage("GOOGLE_PLAY", "ru", null)).toBe("ru");
    expect(densityLanguage("GOOGLE_PLAY", "ua", null)).toBe("uk");
    expect(densityLanguage("GOOGLE_PLAY", "kr", null)).toBe("ko");
    expect(densityLanguage("GOOGLE_PLAY", "sa", null)).toBe("ar");
    expect(densityLanguage("GOOGLE_PLAY", "th", null)).toBe("th");
  });
});
