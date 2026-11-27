import { APP_STORE_LOCALIZATIONS } from "@asobeast/shared";
import { describe, expect, it } from "vitest";
import {
  draftableLocalizations,
  LOCALIZED_FIELDS_NOTE,
  localizedFieldsNote,
  localizationName,
  localizationNameInLocale,
  localizedLabel,
  storefrontRows,
} from "./localizations";

describe("storefrontRows", () => {
  it("puts the home storefront first and keeps the markets in order", () => {
    const rows = storefrontRows("us", ["us", "pl", "gb"]);

    expect(rows).toMatchObject([
      { country: "us", home: true, primary: "en-US" },
      { country: "pl", home: false, primary: "en-GB", additional: ["pl"] },
      { country: "gb", home: false, primary: "en-GB", additional: [] },
    ]);
    expect(rows[0].additional).toHaveLength(9);
  });

  it("skips a code with no storefront and lists the home first wherever it appears", () => {
    expect(
      storefrontRows("us", ["zz", "pl"]).map((row) => row.country),
    ).toEqual(["us", "pl"]);
    expect(
      storefrontRows("pl", ["us", "pl"]).map((row) => row.country),
    ).toEqual(["pl", "us"]);
  });
});

describe("LOCALIZED_FIELDS_NOTE", () => {
  it("reads every limit from the shared field limits", () => {
    expect(LOCALIZED_FIELDS_NOTE).toBe(
      "Each localization has its own 30 character title, 30 character subtitle and 100 character keyword field.",
    );
  });

  it("translates the field limits for Simplified Chinese", () => {
    expect(localizedFieldsNote("zh-CN")).toBe(
      "每个本地化版本分别包含 30 个字符的标题、30 个字符的副标题和 100 个字符的关键词字段。",
    );
  });
});

const US_IDS = [
  "ar",
  "zh-Hans",
  "zh-Hant",
  "fr",
  "ko",
  "pt-BR",
  "ru",
  "es-MX",
  "vi",
];

describe("draftableLocalizations", () => {
  it.each([
    ["us", ["us", "pl", "gb"], [...US_IDS, "pl"]],
    ["us", ["us", "jp"], US_IDS],
    ["us", ["us", "mx", "ca"], [...US_IDS, "en-GB", "fr-CA"]],
    ["gb", ["gb"], []],
    ["jp", ["jp"], ["en-US"]],
  ])(
    "offers what %s with %j reads beyond the primary listing",
    (home, markets, expected) => {
      expect(draftableLocalizations(storefrontRows(home, markets))).toEqual(
        expected,
      );
    },
  );
});

describe("localizationName", () => {
  it("names an app store localization", () => {
    expect(localizationName("pl")).toBe("Polish");
    expect(localizationName("zh-Hans")).toBe("Chinese (Simplified)");
  });

  it("keeps every shared App Store localization name", () => {
    for (const [tag, name] of Object.entries(APP_STORE_LOCALIZATIONS)) {
      expect(localizationName(tag)).toBe(name);
    }
  });

  it("passes a tag it does not know through", () => {
    expect(localizationName("xx")).toBe("xx");
  });

  it("translates App Store localization names", () => {
    expect(localizationNameInLocale("zh-Hans", "zh-CN")).toBe("简体中文");
    expect(localizationNameInLocale("en-US", "zh-CN")).toBe("英语（美国）");
  });
});

describe("localizedLabel", () => {
  it("names the language of a localized value", () => {
    expect(localizedLabel("Title", "pl")).toBe("Title · Polish");
  });

  it("keeps the label of a default value", () => {
    expect(localizedLabel("Title")).toBe("Title");
    expect(localizedLabel("Title", null)).toBe("Title");
  });
});
