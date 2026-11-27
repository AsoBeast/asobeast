import { describe, expect, it } from "vitest";
import { translationContext } from "@/test/translation-context";
import { localizationsNote, marketListingsNote } from "./market-listings-note";

const en = translationContext("en", "settings").translator;
const zh = translationContext("zh-CN", "settings").translator;

describe("marketListingsNote", () => {
  it("says nothing when no market listing is refreshed", () => {
    expect(marketListingsNote(0, en)).toBeNull();
    expect(marketListingsNote(undefined, en)).toBeNull();
  });

  it("names one market listing", () => {
    expect(marketListingsNote(1, en)).toBe(
      "1 of the app requests refreshes the listing of a market you track keywords in.",
    );
  });

  it("counts several market listings", () => {
    expect(marketListingsNote(12, en)).toBe(
      "12 of the app requests refresh the listing of a market you track keywords in.",
    );
  });

  it("localizes the count in Chinese", () => {
    expect(marketListingsNote(1, zh)).toBe(
      "1 次应用请求用于刷新您跟踪关键词的市场的应用详情。",
    );
  });
});

describe("localizationsNote", () => {
  it("says nothing when no native localization is read", () => {
    expect(localizationsNote(0, en)).toBeNull();
    expect(localizationsNote(undefined, en)).toBeNull();
  });

  it("names one localization read", () => {
    expect(localizationsNote(1, en)).toBe(
      "1 of the app requests reads a native localization of a storefront whose default is English.",
    );
  });

  it("counts several localization reads", () => {
    expect(localizationsNote(3, en)).toBe(
      "3 of the app requests read a native localization of a storefront whose default is English.",
    );
  });

  it("localizes the count in Chinese", () => {
    expect(localizationsNote(3, zh)).toBe(
      "3 次应用请求用于读取默认语言为英语的应用商店地区的原生本地化内容。",
    );
  });
});
