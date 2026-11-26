import { describe, expect, it } from "vitest";
import { DEFAULT_LOCALE, isLocale, LOCALES, resolveLocale } from "./locale";

describe("locale contract", () => {
  it("supports only English and Simplified Chinese", () => {
    expect(LOCALES).toEqual(["en", "zh-CN"]);
    expect(DEFAULT_LOCALE).toBe("en");
    expect(isLocale("en")).toBe(true);
    expect(isLocale("zh-CN")).toBe(true);
    expect(isLocale("zh-TW")).toBe(false);
    expect(isLocale("fr")).toBe(false);
    expect(isLocale("")).toBe(false);
  });

  it.each([
    [undefined, "zh", "zh-CN"],
    [undefined, "zh-CN", "zh-CN"],
    [undefined, "zh-Hans", "zh-CN"],
    [undefined, "zh-Hans-CN", "zh-CN"],
    [undefined, "zh-SG", "zh-CN"],
    [undefined, "ZH-hans", "zh-CN"],
    [undefined, "en-US,en;q=0.9", "en"],
    [undefined, "fr;q=0.9,zh-CN;q=0.8", "zh-CN"],
    [undefined, "en;q=0.5,zh-CN;q=0.9", "zh-CN"],
    [undefined, "zh-TW", "en"],
    [undefined, "zh-Hant,en;q=0.8", "en"],
    [undefined, "ja,fr;q=0.9", "en"],
    [undefined, null, "en"],
    [undefined, "", "en"],
    ["en", "zh-CN", "en"],
    ["zh-CN", "en-US", "zh-CN"],
    ["zh-TW", "zh-CN", "zh-CN"],
    ["fr", "en-GB", "en"],
    ["", "zh-CN", "zh-CN"],
  ] as const)(
    "resolves cookie %s and header %s to %s",
    (cookieValue, acceptLanguage, expected) => {
      expect(resolveLocale(cookieValue, acceptLanguage)).toBe(expected);
    },
  );

  it("ignores a language with zero quality", () => {
    expect(resolveLocale(undefined, "zh-CN;q=0,en;q=0.5")).toBe("en");
  });
});
