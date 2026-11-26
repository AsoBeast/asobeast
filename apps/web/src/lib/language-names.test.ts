import { describe, expect, it } from "vitest";
import { languageName } from "./language-names";

describe("languageName", () => {
  it("keeps English names by default", () => {
    expect(languageName("en-US")).toBe("English");
    expect(languageName("pl")).toBe("Polish");
  });

  it("translates language names for Simplified Chinese", () => {
    expect(languageName("zh-Hans", "zh-CN")).toBe("中文");
    expect(languageName("en-US", "zh-CN")).toBe("英语");
    expect(languageName("pl", "zh-CN")).toBe("波兰语");
  });

  it("passes unknown tags through", () => {
    expect(languageName("xx", "zh-CN")).toBe("xx");
  });
});
